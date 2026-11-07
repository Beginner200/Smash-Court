import * as THREE from "three";
import { COURT_LENGTH_M, DOUBLES_WIDTH_M, SINGLES_WIDTH_M, SHORT_SERVICE_LINE_FROM_NET_M, DOUBLES_LONG_SERVICE_LINE_INSET_M } from "../rules/service.js";

export interface CourtSceneOptions { showSinglesLines?: boolean; showDoublesLines?: boolean }

function line(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material): void {
  const geometry = new THREE.BufferGeometry().setFromPoints([a,b]);
  group.add(new THREE.Line(geometry, material));
}

export function buildCourtScene(options: CourtSceneOptions = {}): THREE.Group {
  const { showSinglesLines = true, showDoublesLines = true } = options;
  const group = new THREE.Group();
  group.name = "regulation-badminton-court";
  const halfLength = COURT_LENGTH_M / 2;
  const halfDoubles = DOUBLES_WIDTH_M / 2;
  const halfSingles = SINGLES_WIDTH_M / 2;
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const netTapeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f2e9, roughness: 0.72 });
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(DOUBLES_WIDTH_M, 0.08, COURT_LENGTH_M),
    new THREE.MeshStandardMaterial({ color: 0x176c55, roughness: 0.88 }),
  );
  floor.position.y = -0.04;
  floor.receiveShadow = true;
  floor.name = "court-surface";
  group.add(floor);

  const y = 0.006;
  const addRect = (halfW: number, halfL: number) => {
    line(group,new THREE.Vector3(-halfW,y,-halfL),new THREE.Vector3(halfW,y,-halfL),lineMaterial);
    line(group,new THREE.Vector3(-halfW,y,halfL),new THREE.Vector3(halfW,y,halfL),lineMaterial);
    line(group,new THREE.Vector3(-halfW,y,-halfL),new THREE.Vector3(-halfW,y,halfL),lineMaterial);
    line(group,new THREE.Vector3(halfW,y,-halfL),new THREE.Vector3(halfW,y,halfL),lineMaterial);
  };
  // BWF Law 1: 13.40 m x 6.10 m court; all boundary lines are part of the court.
  addRect(halfDoubles,halfLength);
  if (showSinglesLines) {
    line(group,new THREE.Vector3(-halfSingles,y,-halfLength),new THREE.Vector3(-halfSingles,y,halfLength),lineMaterial);
    line(group,new THREE.Vector3(halfSingles,y,-halfLength),new THREE.Vector3(halfSingles,y,halfLength),lineMaterial);
  }
  if (showDoublesLines) {
    for (const z of [-SHORT_SERVICE_LINE_FROM_NET_M, SHORT_SERVICE_LINE_FROM_NET_M]) {
      line(group,new THREE.Vector3(-halfDoubles,y,z),new THREE.Vector3(halfDoubles,y,z),lineMaterial);
    }
    const doublesLong = halfLength - DOUBLES_LONG_SERVICE_LINE_INSET_M;
    for (const z of [-doublesLong,doublesLong]) {
      line(group,new THREE.Vector3(-halfDoubles,y,z),new THREE.Vector3(halfDoubles,y,z),lineMaterial);
    }
  }
  // Centre service lines stop at the short service line and doubles long service line.
  const doublesLong = halfLength - DOUBLES_LONG_SERVICE_LINE_INSET_M;
  for (const sign of [-1,1]) {
    const near = sign < 0 ? -doublesLong : SHORT_SERVICE_LINE_FROM_NET_M;
    const far = sign < 0 ? -SHORT_SERVICE_LINE_FROM_NET_M : doublesLong;
    line(group,new THREE.Vector3(0,y,near),new THREE.Vector3(0,y,far),lineMaterial);
  }

  // Net is 1.524 m at centre and 1.55 m at the posts (BWF Law 1.2).
  const netHeight = 1.524;
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(DOUBLES_WIDTH_M,netHeight,24,12),
    new THREE.MeshStandardMaterial({ color:0x152a25, side:THREE.DoubleSide, transparent:true, opacity:0.48, roughness:1 }),
  );
  net.position.set(0,netHeight/2,0);
  group.add(net);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(DOUBLES_WIDTH_M+0.04,0.075,0.035),netTapeMaterial);
  tape.position.set(0,netHeight+0.025,0);
  group.add(tape);
  const postMaterial = new THREE.MeshStandardMaterial({ color:0xd7dbe0, metalness:0.45, roughness:0.35 });
  for (const x of [-halfDoubles,halfDoubles]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.55,12),postMaterial);
    post.position.set(x,0.775,0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}
