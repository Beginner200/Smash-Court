import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildCourtScene } from "./scene/court.js";
import type { MatchMode } from "./rules/types.js";
import { SHOT_PROFILES, createShotState, type ShotType } from "./physics/shots.js";
import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, metresPerSecondToKmh, simulateTrajectory, type TrajectoryResult } from "./physics/shuttle.js";
import "./style.css";

const mount = document.querySelector<HTMLDivElement>("#scene");
const status = document.querySelector<HTMLDivElement>("#flight-status");
const speedReadout = document.querySelector<HTMLDivElement>("#speed-readout");
const timeReadout = document.querySelector<HTMLDivElement>("#time-readout");
const modeSelect = document.querySelector<HTMLSelectElement>("#mode");
const launchButton = document.querySelector<HTMLButtonElement>("#launch");
const resetButton = document.querySelector<HTMLButtonElement>("#reset");
const shotReadout = document.querySelector<HTMLDivElement>("#shot-readout");
if (!mount) throw new Error("Missing #scene mount!.");
if (!status) throw new Error("Missing #flight-status!.");
if (!speedReadout) throw new Error("Missing #speed-readout.");
if (!timeReadout) throw new Error("Missing #time-readout.");
if (!modeSelect) throw new Error("Missing #mode.");
if (!launchButton) throw new Error("Missing #launch.");
if (!resetButton) throw new Error("Missing #reset.");
if (!shotReadout) throw new Error("Missing #shot-readout.");

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

// Phase 3: simple court avatars. The player starts on the near half.
function makePlayer(color: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.72, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
  body.position.y = 0.62;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0c9a5, roughness: 0.8 }));
  head.position.y = 1.18;
  head.castShadow = true;
  const racket = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 18), new THREE.MeshStandardMaterial({ color: 0xe9e4d4, metalness: 0.25 }));
  racket.position.set(0.28, 0.8, -0.08);
  racket.rotation.y = 0.25;
  group.add(body, head, racket);
  return group;
}
const player = makePlayer(0x39c58d, "human-player");
player.position.set(0, 0, 4.8);
scene.add(player);
const opponent = makePlayer(0xe2a34a, "simple-ai-opponent");
opponent.position.set(0, 0, -4.8);
scene.add(opponent);
const moveStep = 0.45;
function movePlayer(dx: number, dz: number) {
  player.position.x = THREE.MathUtils.clamp(player.position.x + dx, -2.35, 2.35);
  player.position.z = THREE.MathUtils.clamp(player.position.z + dz, 0.45, 6.25);
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
const clock = new THREE.Clock();

function clearTrajectory() {
  if(trajectoryLine) { scene.remove(trajectoryLine); trajectoryLine.geometry.dispose(); trajectoryLine=null; }
  shuttle.visible=false; result=null; playing=false; lastElapsed=0;
  status!.textContent="Ready to launch";
  speedReadout!.textContent="—";
  timeReadout!.textContent="—";
}
function makeShot(type: ShotType = "clear") {
  clearTrajectory();
  const mode: MatchMode = modeSelect!.value === "doubles" ? "doubles" : "singles";
  const config = { ...DEFAULT_SHUTTLE_CONFIG, courtMode:mode };
  // Launch from just in front of the player toward the far court.
  const initial = createShotState(type, {
    x: player.position.x,
    y: 1.25,
    z: Math.max(0.65, player.position.z - 0.45),
  });
  result = simulateTrajectory(initial,config);
  const points = result.samples.map(s=>new THREE.Vector3(s.position.x,s.position.y,s.position.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  trajectoryLine = new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x75e6c2,transparent:true,opacity:0.88}));
  scene.add(trajectoryLine);
  shuttle.visible=true;
  shuttle.position.set(initial.position.x,initial.position.y,initial.position.z);
  const endLabel = result.end === "net" ? "NET FAULT" : result.end === "out" ? "OUT" : result.end === "ground" ? "LANDED IN" : "FLIGHT TIMEOUT";
  status!.textContent = `${SHOT_PROFILES[type].label.toUpperCase()} · ${endLabel}`;
  shotReadout!.textContent = SHOT_PROFILES[type].description;
  speedReadout!.textContent = `${Math.round(metresPerSecondToKmh(magnitude(initial.velocity)))} km/h launch`;
  timeReadout!.textContent = `${result.durationSeconds.toFixed(2)} s · ${result.samples.length} steps`;
  animationStart=clock.elapsedTime;
  playing=true;
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
resetButton.addEventListener("click",clearTrajectory);
modeSelect!.addEventListener("change",()=>{ clearTrajectory(); });

function render() {
  requestAnimationFrame(render);
  const delta=clock.getDelta();
  controls.update();
  if(playing && result) {
    const elapsed=clock.elapsedTime-animationStart;
    const sampleIndex=Math.min(result.samples.length-1,Math.floor(elapsed/Math.max(result.durationSeconds,0.001)*(result.samples.length-1)));
    const sample=result.samples[sampleIndex];
    if(sample) {
      shuttle.position.set(sample.position.x,sample.position.y,sample.position.z);
      const velocity=new THREE.Vector3(sample.velocity.x,sample.velocity.y,sample.velocity.z);
      if(velocity.lengthSq()>0.0001) shuttle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),velocity.normalize());
    }
    if(elapsed>=result.durationSeconds) playing=false;
  }
  renderer.render(scene,camera);
}
render();
