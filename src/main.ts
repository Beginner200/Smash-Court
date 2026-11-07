import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildCourtScene } from "./scene/court.js";
import type { MatchMode } from "./rules/types.js";
import { SHOT_PROFILES, createShotState, type ShotType } from "./physics/shots.js";
import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, metresPerSecondToKmh, simulateTrajectory, type TrajectoryResult } from "./physics/shuttle.js";
import { chooseAiReturnShot, createAiReturnState, getAiLandingTarget } from "./physics/ai.js";
import { canPlayerHitShuttle } from "./physics/hit-detection.js";
import { awardRallyPoint, createMatchScore, type MatchScoreState, type MatchSide } from "./rules/match-scoring.js";
import "./style.css";

const mount = document.querySelector<HTMLDivElement>("#scene");
const status = document.querySelector<HTMLDivElement>("#flight-status");
const speedReadout = document.querySelector<HTMLDivElement>("#speed-readout");
const timeReadout = document.querySelector<HTMLDivElement>("#time-readout");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode");
const launchButton = document.querySelector<HTMLButtonElement>("#launch");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const shotReadout = document.querySelector<HTMLDivElement>("#shot-readout");
const opponentReadout = document.querySelector<HTMLDivElement>("#opponent-readout");
const playerScoreReadout = document.querySelector<HTMLSpanElement>("#score-player");
const opponentScoreReadout = document.querySelector<HTMLSpanElement>("#score-opponent");
const playerGamesReadout = document.querySelector<HTMLSpanElement>("#games-player");
const opponentGamesReadout = document.querySelector<HTMLSpanElement>("#games-opponent");
const matchMessage = document.querySelector<HTMLDivElement>("#match-message");
const newMatchButton = document.querySelector<HTMLButtonElement>("#new-match");
const nextRallyButton = document.querySelector<HTMLButtonElement>("#next-rally");
if (!mount) throw new Error("Missing #scene mount!.");
if (!status) throw new Error("Missing #flight-status!.");
if (!speedReadout) throw new Error("Missing #speed-readout.");
if (!timeReadout) throw new Error("Missing #time-readout.");
if (!modeSelect) throw new Error("Missing #mode.");
if (!launchButton) throw new Error("Missing #launch.");
if (!resetButton) throw new Error("Missing #reset.");
if (!shotReadout) throw new Error("Missing #shot-readout.");
if (!opponentReadout) throw new Error("Missing #opponent-readout.");
if (!playerScoreReadout || !opponentScoreReadout || !playerGamesReadout || !opponentGamesReadout || !matchMessage || !newMatchButton || !nextRallyButton) throw new Error("Missing match scoreboard controls.");

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
const opponent = makePlayer(0xe2a34a, "simple-ai-opponent");
opponent.position.set(0, 0, -4.8);
scene.add(opponent);
let playerMoveTimer = 0;
let playerSwingTimer = 0;
let aiSwingTimer = 0;
let impactTimer = 0;
let impactRing: THREE.Mesh | null = null;
const moveStep = 0.45;
function movePlayer(dx: number, dz: number) {
  player.position.x = THREE.MathUtils.clamp(player.position.x + dx, -2.35, 2.35);
  player.position.z = THREE.MathUtils.clamp(player.position.z + dz, 0.45, 6.25);
  playerMoveTimer = 0.24;
}
document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach(button => {
  button.addEventListener("click", () => {
    const direction = button.dataset.move;
    if (direction === "left") movePlayer(-moveStep, 0);
    if (direction === "right") movePlayer(moveStep, 0);
    if (direction === "forward") movePlayer(0, -moveStep);
    if (direction === "back") movePlayer(0, moveStep);
  });
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
let aiTarget: THREE.Vector3 | null = null;
let matchScore: MatchScoreState = createMatchScore();
let pointResolved = false;
let rallyState: "ready" | "player-flight" | "ai-flight" | "point-over" = "ready";
const clock = new THREE.Clock();

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
  pointResolved = false;
  nextRallyButton.disabled = true;
  rallyState = "ready";
  updateScoreboard();
  matchMessage!.textContent = "Best of 3 · First to 21, win by 2 (cap 30)";
  clearTrajectory();
  player.position.set(0,0,4.8);
  opponent.position.set(0,0,-4.8);
}
function clearTrajectory() {
  if(trajectoryLine) { scene.remove(trajectoryLine); trajectoryLine.geometry.dispose(); trajectoryLine=null; }
  shuttle.visible=false; result=null; playing=false; lastElapsed=0;
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

  let launchPosition: THREE.Vector3;
  if (isReturn) {
    const shuttlePosition = { x: shuttle.position.x, y: shuttle.position.y, z: shuttle.position.z };
    if (!canPlayerHitShuttle(player.position, shuttlePosition)) {
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

  const initial = createShotState(type, {
    x: launchPosition.x,
    y: launchPosition.y,
    z: launchPosition.z,
  });
  startFlight(
    initial,
    isReturn ? `Return · ${SHOT_PROFILES[type].label}` : SHOT_PROFILES[type].label,
    isReturn ? `You reached the shuttle and returned a ${type}.` : SHOT_PROFILES[type].description,
    "player",
  );
}
function makeAiReturn() {
  const aiShot = chooseAiReturnShot(player.position);
  const initial = createAiReturnState(
    { x: opponent.position.x, y: 1.55, z: Math.min(-0.65, opponent.position.z + 0.35) },
    { x: player.position.x, y: player.position.y, z: player.position.z },
    aiShot,
  );
  startFlight(initial, `AI ${aiShot}`, `The opponent chose a ${aiShot} based on your court position.`, "ai");
}
function magnitude(v: {x:number;y:number;z:number}) { return Math.hypot(v.x,v.y,v.z); }
function resize() {
  const w=mount!.clientWidth, h=mount!.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false);
}
const resizeObserver=new ResizeObserver(resize); resizeObserver.observe(mount); resize();
launchButton.addEventListener("click",()=>makeShot("clear"));
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
  rallyState = "ready";
  player.position.set(0,0,4.8);
  opponent.position.set(0,0,-4.8);
  matchMessage!.textContent = `Game ${matchScore.gameNumber} · Start the next rally`;
  status!.textContent = "Ready · serve to begin the next rally";
  nextRallyButton.disabled = true;
});
updateScoreboard();
modeSelect!.addEventListener("change",()=>{ clearTrajectory(); });

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
  playerSwingTimer = Math.max(0, playerSwingTimer - delta);
  aiSwingTimer = Math.max(0, aiSwingTimer - delta);
  animateAvatar(player, playerSwingTimer, playerMoveTimer, 0);
  animateAvatar(opponent, aiSwingTimer, playing && flightSource === "player" && !!aiTarget ? 0.24 : 0, Math.PI);
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
      const distance = opponent.position.distanceTo(target);
      const step = 9 * Math.max(delta,0);
      if(distance > 0.04) {
        opponent.position.lerp(target,Math.min(1,step/distance));
        opponent.rotation.y = THREE.MathUtils.damp(opponent.rotation.y, Math.atan2(target.x - opponent.position.x, target.z - opponent.position.z), 7, delta);
      }
      const returnMoment = Math.max(0.12,flightResult.durationSeconds * 0.82);
      if(elapsed >= returnMoment) {
        aiReturnAttempted=true;
        if(opponent.position.distanceTo(target) <= 1.35) {
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
            awardPoint("player", aiReturnAttempted ? "AI could not reach the shuttle" : "AI failed to return");
          } else {
            awardPoint("opponent", flightResult.end === "net" ? "Your shot hit the net" : "Your shot landed out");
          }
        } else {
          const validPlayerLanding = flightResult.end === "ground" && !!flightResult.landing && flightResult.landing.z > 0;
          awardPoint(validPlayerLanding ? "opponent" : "player", validPlayerLanding ? "You did not return the shuttle" : "AI return was a fault");
        }
      }
    }
  }
  renderer.render(scene,camera);
}
render();
