import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildCourtScene } from "./scene/court.js";
import type { MatchMode } from "./rules/types.js";
import { SHOT_PROFILES, createShotState, type ShotType } from "./physics/shots.js";
import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, metresPerSecondToKmh, simulateTrajectory, type TrajectoryResult } from "./physics/shuttle.js";
import { chooseAiReturnPlan, createAiReturnState, getAiLandingTarget } from "./physics/ai.js";
import { canPlayerHitShuttle } from "./physics/hit-detection.js";
import { assessShotContact } from "./physics/contact-quality.js";
import { createServeState, evaluateServeFlight, type ServingSide } from "./physics/serve.js";
import { getServiceCourt } from "./rules/service.js";
import { advanceDoublesRotation, createDoublesRotation, getDoublesServer, type DoublesPlayer, type DoublesRotationState } from "./rules/doubles-rotation.js";
import { awardRallyPoint, createMatchScore, type MatchScoreState, type MatchSide } from "./rules/match-scoring.js";
import "./style.css";

const mount = document.querySelector<HTMLDivElement>("#scene");
const status = document.querySelector<HTMLDivElement>("#flight-status");
const speedReadout = document.querySelector<HTMLDivElement>("#speed-readout");
const timeReadout = document.querySelector<HTMLDivElement>("#time-readout");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode");
const difficultySelect = document.querySelector<HTMLSelectElement>("#difficulty");
const launchButton = document.querySelector<HTMLButtonElement>("#launch");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const shotReadout = document.querySelector<HTMLDivElement>("#shot-readout");
const contactReadout = document.querySelector<HTMLDivElement>("#contact-readout");
const practiceAssist = document.querySelector<HTMLInputElement>("#practice-assist");
const opponentReadout = document.querySelector<HTMLDivElement>("#opponent-readout");
const playerScoreReadout = document.querySelector<HTMLSpanElement>("#score-player");
const opponentScoreReadout = document.querySelector<HTMLSpanElement>("#score-opponent");
const playerGamesReadout = document.querySelector<HTMLSpanElement>("#games-player");
const opponentGamesReadout = document.querySelector<HTMLSpanElement>("#games-opponent");
const matchMessage = document.querySelector<HTMLDivElement>("#match-message");
const newMatchButton = document.querySelector<HTMLButtonElement>("#new-match");
const nextRallyButton = document.querySelector<HTMLButtonElement>("#next-rally");
const serveReadout = document.querySelector<HTMLDivElement>("#serve-readout");
if (!mount) throw new Error("Missing #scene mount!.");
if (!status) throw new Error("Missing #flight-status!.");
if (!speedReadout) throw new Error("Missing #speed-readout.");
if (!timeReadout) throw new Error("Missing #time-readout.");
if (!modeSelect) throw new Error("Missing #mode.");
if (!difficultySelect) throw new Error("Missing #difficulty.");
if (!launchButton) throw new Error("Missing #launch.");
if (!resetButton) throw new Error("Missing #reset.");
if (!shotReadout) throw new Error("Missing #shot-readout.");
if (!contactReadout) throw new Error("Missing #contact-readout.");
if (!practiceAssist) throw new Error("Missing #practice-assist.");
if (!opponentReadout) throw new Error("Missing #opponent-readout.");
if (!playerScoreReadout || !opponentScoreReadout || !playerGamesReadout || !opponentGamesReadout || !matchMessage || !newMatchButton || !nextRallyButton || !serveReadout) throw new Error("Missing match scoreboard controls.");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07120f);
scene.fog = new THREE.Fog(0x07120f, 18, 42);
const camera = new THREE.PerspectiveCamera(42,1,0.1,100);
camera.position.set(0,10.5,15.5);
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
mount!.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0.9,0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 7;
controls.maxDistance = 28;

scene.add(new THREE.HemisphereLight(0xd9f4ff,0x17271f,2.1));
const key = new THREE.DirectionalLight(0xfff1d7,3.0);
key.position.set(-5,13,-3); key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-12; key.shadow.camera.right=12; key.shadow.camera.top=18; key.shadow.camera.bottom=-18;
scene.add(key);
const fill = new THREE.DirectionalLight(0x8ab8ff,1.15); fill.position.set(7,8,9); scene.add(fill);
const arena = new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x101d1b,roughness:0.96}));
arena.rotation.x=-Math.PI/2; arena.position.y=-0.1; arena.receiveShadow=true; scene.add(arena);
const court = buildCourtScene();
court.traverse(o=>{ if(o instanceof THREE.Mesh) { o.castShadow=true; o.receiveShadow=true; }});
scene.add(court);

// Lightweight procedural badminton avatars with animated racket arms and legs.
type AvatarRig = {
  arm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  body: THREE.Mesh;
};
function makePlayer(color: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.72, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
  body.position.y = 0.62;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0c9a5, roughness: 0.8 }));
  head.position.y = 1.18;
  head.castShadow = true;
  const arm = new THREE.Group();
  arm.position.set(0.18, 0.94, 0);
  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 3, 6), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  upperArm.position.set(0.12, -0.12, 0);
  upperArm.rotation.z = -0.5;
  upperArm.castShadow = true;
  const racket = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 18), new THREE.MeshStandardMaterial({ color: 0xe9e4d4, metalness: 0.25 }));
  racket.position.set(0.26, -0.32, -0.08);
  racket.rotation.y = 0.25;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x9c7448 }));
  handle.position.set(0.22, -0.23, -0.02);
  handle.rotation.z = -0.55;
  arm.add(upperArm, racket, handle);
  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.35, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.35, 3, 6), new THREE.MeshStandardMaterial({ color: 0x263b36, roughness: 0.85 }));
    leg.position.y = -0.2;
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-0.12);
  const rightLeg = makeLeg(0.12);
  group.add(body, head, arm);
  group.userData.rig = { arm, leftLeg, rightLeg, body } satisfies AvatarRig;
  return group;
}
const player = makePlayer(0x39c58d, "human-player");
player.position.set(0, 0, 4.8);
scene.add(player);
const opponent = makePlayer(0xe2a34a, "ai-opponent-1");
opponent.position.set(0, 0, -4.8);
scene.add(opponent);
const playerPartner = makePlayer(0x53a9d7, "player-ai-partner");
playerPartner.position.set(-1.35, 0, 4.85);
scene.add(playerPartner);
const opponentPartner = makePlayer(0xc77a36, "ai-opponent-2");
opponentPartner.position.set(1.35, 0, -4.85);
scene.add(opponentPartner);
let doublesRotation: DoublesRotationState = createDoublesRotation();
function isDoublesMode() { return modeSelect!.value === "doubles"; }
function doublesServer(side: "player" | "opponent"): DoublesPlayer {
  return getDoublesServer(doublesRotation, side, matchScore.points[side]);
}
function updateDoublesFormation() {
  const doubles = isDoublesMode();
  playerPartner.visible = doubles;
  opponentPartner.visible = doubles;
  if (doubles) {
    const playerRight = doublesRotation.playerRight === "human" ? player : playerPartner;
    const playerLeft = playerRight === player ? playerPartner : player;
    const opponentRight = doublesRotation.opponentRight === "opponent1" ? opponent : opponentPartner;
    const opponentLeft = opponentRight === opponent ? opponentPartner : opponent;
    const playerServerIsRight = doublesServer("player") === doublesRotation.playerRight;
    const opponentServerIsRight = doublesServer("opponent") === doublesRotation.opponentRight;
    playerRight.position.set(0.78, 0, playerServerIsRight ? 5.8 : 4.25);
    playerLeft.position.set(-0.78, 0, playerServerIsRight ? 4.25 : 5.8);
    opponentRight.position.set(-0.78, 0, opponentServerIsRight ? -5.8 : -4.25);
    opponentLeft.position.set(0.78, 0, opponentServerIsRight ? -4.25 : -5.8);
  } else {
    player.position.set(0, 0, 4.8);
    playerPartner.position.set(0, 0, 4.8);
    opponent.position.set(0, 0, -4.8);
    opponentPartner.position.set(0, 0, -4.8);
  }
}
let playerMoveTimer = 0;
let playerStamina = 100;
const MAX_PLAYER_STAMINA = 100;
let playerSwingTimer = 0;
let aiSwingTimer = 0;
let impactTimer = 0;
let impactRing: THREE.Mesh | null = null;
const moveStep = 0.28;
const HOLD_MOVE_INTERVAL_MS = 105;
function updateStaminaHud() {
  const fill = document.querySelector<HTMLDivElement>("#stamina-fill");
  const value = document.querySelector<HTMLSpanElement>("#stamina-value");
  const track = document.querySelector<HTMLDivElement>(".stamina-track");
  if (!fill || !value) return;
  const percent = Math.round(playerStamina);
  if (track) track.setAttribute("aria-valuenow", String(percent));
  fill.style.width = `${percent}%`;
  fill.classList.toggle("low", percent <= 25);
  value.textContent = `${percent}%`;
}
function movePlayer(dx: number, dz: number) {
  const staminaFactor = 0.35 + 0.65 * (playerStamina / MAX_PLAYER_STAMINA);
  const scaledX = dx * staminaFactor;
  const scaledZ = dz * staminaFactor;
  const oldX = player.position.x;
  const oldZ = player.position.z;
  player.position.x = THREE.MathUtils.clamp(player.position.x + scaledX, -2.35, 2.35);
  player.position.z = THREE.MathUtils.clamp(player.position.z + scaledZ, 0.45, 6.25);
  const travelled = Math.hypot(player.position.x - oldX, player.position.z - oldZ);
  playerStamina = Math.max(0, playerStamina - travelled * 11);
  updateStaminaHud();
  playerMoveTimer = 0.24;
}
function moveInDirection(direction: string | undefined) {
  if (direction === "left") movePlayer(-moveStep, 0);
  if (direction === "right") movePlayer(moveStep, 0);
  if (direction === "forward") movePlayer(0, -moveStep);
  if (direction === "back") movePlayer(0, moveStep);
}
// Press once for a small step, or hold a direction to keep moving smoothly.
document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach(button => {
  let holdTimer: number | undefined;
  const stop = () => {
    if (holdTimer !== undefined) window.clearInterval(holdTimer);
    holdTimer = undefined;
  };
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    stop();
    moveInDirection(button.dataset.move);
    holdTimer = window.setInterval(() => moveInDirection(button.dataset.move), HOLD_MOVE_INTERVAL_MS);
  });
  for (const eventName of ["pointerup", "pointerleave", "pointercancel"]) {
    button.addEventListener(eventName, stop);
  }
  button.addEventListener("contextmenu", event => event.preventDefault());
});
window.addEventListener("keydown", event => {
  if (["ArrowLeft","a","A"].includes(event.key)) movePlayer(-moveStep, 0);
  if (["ArrowRight","d","D"].includes(event.key)) movePlayer(moveStep, 0);
  if (["ArrowUp","w","W"].includes(event.key)) movePlayer(0, -moveStep);
  if (["ArrowDown","s","S"].includes(event.key)) movePlayer(0, moveStep);
});

const shuttle = new THREE.Group();
const cork = new THREE.Mesh(new THREE.SphereGeometry(0.032,16,12),new THREE.MeshStandardMaterial({color:0xe8d8a6,roughness:0.7}));
const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.105,0.19,12,1,true),new THREE.MeshStandardMaterial({color:0xf3f0df,side:THREE.DoubleSide,roughness:0.9}));
skirt.rotation.x=Math.PI/2; skirt.position.z=0.085;
shuttle.add(cork,skirt);
shuttle.visible=false; scene.add(shuttle);

let trajectoryLine: THREE.Line | null = null;
let result: TrajectoryResult | null = null;
let animationStart = 0;
let playing = false;
let lastElapsed = 0;
let flightSource: "player" | "ai" = "player";
let aiReturnAttempted = false;
let aiRallyIndex = 0;
let aiContactPlayer: THREE.Group;
let aiTarget: THREE.Vector3 | null = null;
let matchScore: MatchScoreState = createMatchScore();
let pointResolved = false;
let servingSide: ServingSide = "player";
let rallyStarted = false;
let serveInProgress = false;
let rallyState: "ready" | "player-flight" | "ai-flight" | "point-over" = "ready";
const clock = new THREE.Clock();

function updateServeReadout() {
  const score = matchScore.points[servingSide];
  const court = getServiceCourt(score).toUpperCase();
  const server = isDoublesMode() ? doublesServer(servingSide) : null;
  const humanServing = servingSide === "player" && (!isDoublesMode() || server === "human");
  const serverName = servingSide === "opponent" ? (server === "opponent2" ? "AI PARTNER SERVES" : "AI SERVES")
    : server === "partner" ? "YOUR PARTNER SERVES" : "YOU SERVE";
  serveReadout!.textContent = `${isDoublesMode() ? serverName : servingSide === "player" ? "YOU SERVE" : "AI SERVES"} · ${court} SERVICE COURT · TEAM SCORE ${score}`;
  launchButton!.disabled = !humanServing || rallyStarted || !!matchScore.winner || pointResolved;
  launchButton!.textContent = humanServing ? "Serve ↗" : servingSide === "player" && server === "partner" ? "Partner will serve" : "AI will serve";
}
function updateScoreboard() {
  playerScoreReadout!.textContent = String(matchScore.points.player);
  opponentScoreReadout!.textContent = String(matchScore.points.opponent);
  playerGamesReadout!.textContent = String(matchScore.games.player);
  opponentGamesReadout!.textContent = String(matchScore.games.opponent);
}
function awardPoint(winner: MatchSide, reason: string) {
  if (pointResolved || matchScore.winner) return;
  pointResolved = true;
  nextRallyButton.disabled = false;
  rallyState = "point-over";
  playing = false;
  matchScore = awardRallyPoint(matchScore, winner);
  updateScoreboard();
  if (isDoublesMode()) doublesRotation = advanceDoublesRotation(doublesRotation, winner);
  servingSide = winner;
  updateDoublesFormation();
  rallyStarted = false;
  serveInProgress = false;
  updateServeReadout();
  if (matchScore.winner) {
    matchMessage!.textContent = `${matchScore.winner === "player" ? "YOU WIN" : "AI WINS"} THE MATCH · ${reason}`;
    status!.textContent = matchMessage!.textContent;
  } else if (matchScore.points.player === 0 && matchScore.points.opponent === 0 && (matchScore.games.player + matchScore.games.opponent) > 0) {
    matchMessage!.textContent = `Game ${matchScore.gameNumber} · ${winner === "player" ? "You" : "AI"} won the previous game`;
    status!.textContent = `GAME ${matchScore.gameNumber - 1} WON`;
  } else {
    matchMessage!.textContent = `${winner === "player" ? "Point to you" : "Point to AI"} · ${reason}`;
    status!.textContent = matchMessage!.textContent;
  }
}
function newMatch() {
  matchScore = createMatchScore();
  doublesRotation = createDoublesRotation();
  pointResolved = false;
  servingSide = "player";
  rallyStarted = false;
  serveInProgress = false;
  nextRallyButton.disabled = true;
  rallyState = "ready";
  updateScoreboard();
  updateServeReadout();
  matchMessage!.textContent = "Best of 3 · First to 21, win by 2 (cap 30)";
  clearTrajectory();
  updateDoublesFormation();
}
function clearTrajectory() {
  if(trajectoryLine) { scene.remove(trajectoryLine); trajectoryLine.geometry.dispose(); trajectoryLine=null; }
  shuttle.visible=false; result=null; playing=false; lastElapsed=0;
  serveInProgress=false;
  aiTarget=null; aiReturnAttempted=false; flightSource="player";
  opponentReadout!.textContent="Waiting for your shot";
  status!.textContent="Ready to launch";
  speedReadout!.textContent="—";
  timeReadout!.textContent="—";
}
function startFlight(initial: ReturnType<typeof createShuttleState>, label: string, description: string, source: "player" | "ai") {
  clearTrajectory();
  if (source === "player") playerSwingTimer = 0.34;
  else aiSwingTimer = 0.34;
  if (impactRing) {
    scene.remove(impactRing);
    impactRing.geometry.dispose();
    (impactRing.material as THREE.Material).dispose();
  }
  impactRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.025, 6, 24),
    new THREE.MeshBasicMaterial({ color: source === "ai" ? 0xffc477 : 0x75e6c2, transparent: true, opacity: 0.9 })
  );
  impactRing.position.set(initial.position.x, initial.position.y, initial.position.z);
  impactRing.quaternion.copy(camera.quaternion);
  scene.add(impactRing);
  impactTimer = 0.28;
  flightSource=source;
  rallyState = source === "player" ? "player-flight" : "ai-flight";
  const mode: MatchMode = modeSelect!.value === "doubles" ? "doubles" : "singles";
  const config = { ...DEFAULT_SHUTTLE_CONFIG, courtMode:mode };
  result = simulateTrajectory(initial,config);
  const points = result.samples.map(s=>new THREE.Vector3(s.position.x,s.position.y,s.position.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const color = source === "ai" ? 0xffc477 : 0x75e6c2;
  trajectoryLine = new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:0.88}));
  scene.add(trajectoryLine);
  shuttle.visible=true;
  shuttle.position.set(initial.position.x,initial.position.y,initial.position.z);
  const endLabel = result.end === "net" ? "NET FAULT" : result.end === "out" ? "OUT" : result.end === "ground" ? "LANDED IN" : "FLIGHT TIMEOUT";
  status!.textContent = `${label.toUpperCase()} · ${endLabel}`;
  shotReadout!.textContent = description;
  speedReadout!.textContent = `${Math.round(metresPerSecondToKmh(magnitude(initial.velocity)))} km/h launch`;
  timeReadout!.textContent = `${result.durationSeconds.toFixed(2)} s · ${result.samples.length} steps`;
  aiTarget = source === "player" ? (() => {
    const target = getAiLandingTarget(result!);
    return target ? new THREE.Vector3(target.x,0,target.z) : null;
  })() : null;
  aiReturnAttempted=false;
  opponentReadout!.textContent = source === "player" && aiTarget ? "Tracking shuttle…" : source === "ai" ? "Move close, then tap a shot to return" : "No return needed";
  animationStart=clock.elapsedTime;
  playing=true;
}
function makeShot(type: ShotType = "clear") {
  if (matchScore.winner || pointResolved) return;
  const isReturn = playing && flightSource === "ai";
  if (playing && !isReturn) return;
  if (!isReturn && !rallyStarted) return;

  let launchPosition: THREE.Vector3;
  if (isReturn) {
    const shuttlePosition = { x: shuttle.position.x, y: shuttle.position.y, z: shuttle.position.z };
    const hitReach = practiceAssist!.checked ? 2.25 : undefined;
    if (!canPlayerHitShuttle(player.position, shuttlePosition, hitReach)) {
      status!.textContent = "TOO FAR · MOVE CLOSER TO HIT";
      opponentReadout!.textContent = "Shuttle is outside your racket reach";
      return;
    }
    launchPosition = shuttle.position.clone();
  } else {
    launchPosition = new THREE.Vector3(
      player.position.x,
      1.25,
      Math.max(0.65, player.position.z - 0.45),
    );
  }

  const contact = assessShotContact(player.position, launchPosition, practiceAssist!.checked ? 2.25 : undefined);
  const initial = createShotState(type, {
    x: launchPosition.x,
    y: launchPosition.y,
    z: launchPosition.z,
  });
  initial.velocity.x += contact.lateralErrorMps;
  initial.velocity.y *= contact.powerMultiplier;
  initial.velocity.z *= contact.powerMultiplier;
  contactReadout!.textContent = `${contact.grade} · ${Math.round(contact.quality * 100)}%`;
  startFlight(
    initial,
    isReturn ? `Return · ${SHOT_PROFILES[type].label}` : SHOT_PROFILES[type].label,
    isReturn ? `You returned a ${type} · ${contact.grade.toLowerCase()} contact.` : `${SHOT_PROFILES[type].description} ${contact.grade} contact.`,
    "player",
  );
}
function makeServe(server: ServingSide) {
  if (playing || pointResolved || rallyStarted || matchScore.winner || server !== servingSide) return;
  const serverScore = matchScore.points[server];
  const initial = createServeState(server, serverScore);
  const mode: MatchMode = modeSelect!.value === "doubles" ? "doubles" : "singles";
  const check = evaluateServeFlight(initial, server, serverScore, mode);
  if (check.evaluation.kind !== "LEGAL") {
    const receiver: MatchSide = server === "player" ? "opponent" : "player";
    status!.textContent = `SERVICE FAULT · ${check.evaluation.reason}`;
    awardPoint(receiver, `Service fault · ${check.evaluation.reason}`);
    return;
  }
  const court = getServiceCourt(serverScore).toUpperCase();
  const servingPlayer = isDoublesMode() ? doublesServer(server) : null;
  const serverLabel = server === "opponent" ? (servingPlayer === "opponent2" ? "AI partner serve" : "AI serve")
    : servingPlayer === "partner" ? "Your partner's serve" : "Your serve";
  startFlight(initial, serverLabel, `Legal diagonal serve from the ${court.toLowerCase()} service court.`, server === "player" ? "player" : "ai");
  serveInProgress = true;
  rallyStarted = true;
  serveReadout!.textContent = `${server === "player" ? "YOUR SERVE" : "AI SERVE"} · ${court} SERVICE COURT`;
  status!.textContent = `${server === "player" ? "YOUR" : "AI"} SERVE · IN PLAY`;
  updateServeReadout();
}
function makeAiReturn() {
  const difficulty = difficultySelect!.value;
  const contactPosition = { x: aiContactPlayer.position.x, y: 1.55, z: Math.min(-0.65, aiContactPlayer.position.z + 0.35) };
  const plan = chooseAiReturnPlan(player.position, contactPosition, aiRallyIndex++);
  if (difficulty === "hard") {
    plan.target.x = THREE.MathUtils.clamp(plan.target.x * 1.08, -2.25, 2.25);
    plan.target.z = THREE.MathUtils.clamp(plan.target.z + (plan.shotType === "clear" ? 0.35 : -0.2), 0.65, 6.1);
  }
  const initial = createAiReturnState(contactPosition, plan.target, plan.shotType);
  startFlight(initial, `AI ${plan.shotType}`, `The opponent aimed for the open ${plan.target.x < 0 ? "left" : "right"}-${plan.target.z < 3 ? "front" : "back"} court.`, "ai");
}
function magnitude(v: {x:number;y:number;z:number}) { return Math.hypot(v.x,v.y,v.z); }
function resize() {
  const w=mount!.clientWidth, h=mount!.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false);
}
const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(mount); resize();
launchButton.addEventListener("click",()=>makeServe("player"));
document.querySelectorAll<HTMLButtonElement>("[data-shot]").forEach(button => {
  button.addEventListener("click", () => {
    const shot = button.dataset.shot as ShotType | undefined;
    if (shot && shot in SHOT_PROFILES) makeShot(shot);
  });
});
resetButton.addEventListener("click",()=>{
  if (playing && !pointResolved) awardPoint(flightSource === "ai" ? "player" : "opponent", "Rally reset");
  clearTrajectory();
});
newMatchButton.addEventListener("click",newMatch);
nextRallyButton.disabled = true;
nextRallyButton.addEventListener("click",()=>{
  if (!pointResolved || matchScore.winner) return;
  clearTrajectory();
  pointResolved = false;
  rallyStarted = false;
  serveInProgress = false;
  rallyState = "ready";
  updateDoublesFormation();
  matchMessage!.textContent = `Game ${matchScore.gameNumber} · Start the next rally`;
  status!.textContent = "Ready · serve to begin the next rally";
  nextRallyButton.disabled = true;
  updateServeReadout();
  updateDoublesFormation();
  if (servingSide === "opponent") makeServe("opponent");
  else if (isDoublesMode() && doublesServer("player") === "partner") makeServe("player");
});
updateScoreboard();
updateServeReadout();
modeSelect!.addEventListener("change",()=>{ clearTrajectory(); matchScore = createMatchScore(); doublesRotation = createDoublesRotation(); servingSide = "player"; rallyStarted = false; pointResolved = false; nextRallyButton.disabled = true; updateScoreboard(); updateDoublesFormation(); updateServeReadout(); status!.textContent = isDoublesMode() ? "Doubles mode · service rotation ready" : "Singles mode · one player per side"; });
practiceAssist!.addEventListener("change", () => {
  contactReadout!.textContent = practiceAssist!.checked ? "Practice assist ON" : "Standard contact";
});
difficultySelect!.addEventListener("change",()=>{
  clearTrajectory();
  const level = difficultySelect!.value;
  opponentReadout!.textContent = `AI difficulty: ${level.toUpperCase()}`;
});

function render() {
  requestAnimationFrame(render);
  const delta=clock.getDelta();
  controls.update();
  const animateAvatar = (avatar: THREE.Group, swing: number, moving: number, phase: number) => {
    const rig = avatar.userData.rig as AvatarRig;
    const swingProgress = swing > 0 ? 1 - swing / 0.34 : 0;
    const swingPose = swing > 0 ? Math.sin(Math.min(1, swingProgress) * Math.PI) : 0;
    const gait = moving > 0 ? Math.sin((0.24 - moving) * 34 + phase) : 0;
    rig.arm.rotation.x = -0.12 - swingPose * 0.95 + gait * 0.08;
    rig.arm.rotation.z = -0.18 - swingPose * 0.72;
    rig.leftLeg.rotation.x = gait * 0.42;
    rig.rightLeg.rotation.x = -gait * 0.42;
    rig.body.position.y = 0.62 + Math.abs(gait) * 0.025 + swingPose * 0.035;
    avatar.rotation.y = THREE.MathUtils.damp(avatar.rotation.y, swing > 0 ? -0.18 : 0, 8, delta);
  };
  playerMoveTimer = Math.max(0, playerMoveTimer - delta);
  if (playerMoveTimer === 0 && playerStamina < MAX_PLAYER_STAMINA) {
    playerStamina = Math.min(MAX_PLAYER_STAMINA, playerStamina + 14 * delta);
    updateStaminaHud();
  }
  playerSwingTimer = Math.max(0, playerSwingTimer - delta);
  aiSwingTimer = Math.max(0, aiSwingTimer - delta);
  animateAvatar(player, playerSwingTimer, playerMoveTimer, 0);
  animateAvatar(opponent, aiSwingTimer, playing && flightSource === "player" && !!aiTarget ? 0.24 : 0, Math.PI);
  animateAvatar(playerPartner, 0, 0, Math.PI / 2);
  animateAvatar(opponentPartner, 0, playing && flightSource === "player" && !!aiTarget && isDoublesMode() ? 0.24 : 0, Math.PI * 1.5);
  if (isDoublesMode() && playing && flightSource === "ai") {
    const partnerTargetX = player.position.x > 0 ? -1.35 : 1.35;
    const partnerTargetZ = shuttle.position.z > 3.2 ? 3.7 : 4.9;
    playerPartner.position.x = THREE.MathUtils.damp(playerPartner.position.x, partnerTargetX, 2.8, delta);
    playerPartner.position.z = THREE.MathUtils.damp(playerPartner.position.z, partnerTargetZ, 2.8, delta);
  }
  if (isDoublesMode() && playing && flightSource === "player" && aiTarget) {
    const chasing = opponentPartner.position.distanceTo(aiTarget) < opponent.position.distanceTo(aiTarget) ? opponentPartner : opponent;
    const cover = chasing === opponent ? opponentPartner : opponent;
    const coverX = chasing.position.x > 0 ? -1.25 : 1.25;
    const coverZ = aiTarget.z < -3.2 ? -3.7 : -4.9;
    cover.position.x = THREE.MathUtils.damp(cover.position.x, coverX, 2.2, delta);
    cover.position.z = THREE.MathUtils.damp(cover.position.z, coverZ, 2.2, delta);
  }
  if (impactRing && impactTimer > 0) {
    impactTimer = Math.max(0, impactTimer - delta);
    const progress = 1 - impactTimer / 0.28;
    impactRing.scale.setScalar(1 + progress * 2.6);
    (impactRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - progress));
    if (impactTimer === 0) {
      scene.remove(impactRing);
      impactRing.geometry.dispose();
      (impactRing.material as THREE.Material).dispose();
      impactRing = null;
    }
  }
  if(playing && result) {
    const flightResult = result;
    const activeSource = flightSource;
    const flightWasServe = serveInProgress;
    const elapsed=clock.elapsedTime-animationStart;
    const sampleIndex=Math.min(flightResult.samples.length-1,Math.floor(elapsed/Math.max(flightResult.durationSeconds,0.001)*(flightResult.samples.length-1)));
    const sample=flightResult.samples[sampleIndex];
    if(sample) {
      shuttle.position.set(sample.position.x,sample.position.y,sample.position.z);
      const velocity=new THREE.Vector3(sample.velocity.x,sample.velocity.y,sample.velocity.z);
      if(velocity.lengthSq()>0.0001) shuttle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),velocity.normalize());
    }
    let replacedFlight = false;
    if(activeSource === "player" && aiTarget && !aiReturnAttempted) {
      const target = new THREE.Vector3(aiTarget.x,0,aiTarget.z);
      const difficulty = difficultySelect!.value;
      const activeOpponent = isDoublesMode() && opponentPartner.position.distanceTo(target) < opponent.position.distanceTo(target) ? opponentPartner : opponent;
      aiContactPlayer = activeOpponent;
      const distance = activeOpponent.position.distanceTo(target);
      const aiSpeed = difficulty === "easy" ? 6 : difficulty === "hard" ? 12 : 9;
      const aiReach = difficulty === "easy" ? 1.55 : difficulty === "hard" ? 1.05 : 1.35;
      const reactionRatio = difficulty === "easy" ? 0.9 : difficulty === "hard" ? 0.72 : 0.82;
      const step = aiSpeed * Math.max(delta,0);
      if(distance > 0.04) {
        activeOpponent.position.lerp(target,Math.min(1,step/distance));
        activeOpponent.rotation.y = THREE.MathUtils.damp(activeOpponent.rotation.y, Math.atan2(target.x - activeOpponent.position.x, target.z - activeOpponent.position.z), 7, delta);
      }
      const returnMoment = Math.max(0.12,flightResult.durationSeconds * reactionRatio);
      if(elapsed >= returnMoment) {
        aiReturnAttempted=true;
        if(activeOpponent.position.distanceTo(target) <= aiReach) {
          opponentReadout!.textContent="AI reached it · returning…";
          makeAiReturn();
          replacedFlight = true;
        } else {
          opponentReadout!.textContent="AI missed the shuttle";
          status!.textContent="AI MISSED · WAITING FOR LANDING";
        }
      }
    }
    // A newly launched AI return replaces the old player flight; never score the old flight.
    if(!replacedFlight && elapsed>=flightResult.durationSeconds) {
      playing=false;
      if (!pointResolved) {
        if (activeSource === "player") {
          const validOpponentLanding = flightResult.end === "ground" && !!flightResult.landing && flightResult.landing.z < 0;
          if (validOpponentLanding) {
            awardPoint("player", flightWasServe ? "AI failed to receive the serve" : aiReturnAttempted ? "AI could not reach the shuttle" : "AI failed to return");
          } else {
            awardPoint("opponent", flightResult.end === "net" ? "Your shot hit the net" : "Your shot landed out");
          }
        } else {
          const validPlayerLanding = flightResult.end === "ground" && !!flightResult.landing && flightResult.landing.z > 0;
          awardPoint(validPlayerLanding ? "opponent" : "player", validPlayerLanding ? (flightWasServe ? "You failed to receive the serve" : "You did not return the shuttle") : "AI return was a fault");
        }
      }
    }
  }
  renderer.render(scene,camera);
}
render();
