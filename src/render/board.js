// 보드(원목 프레임 + 81칸 + 황동 트림 + 좌표 각인 + 벽 보관대) 와 테이블
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createWood, variant, WOODS } from './textures.js';
import { CELL, GROOVE, PITCH, BOARD_TOP, INNER, FRAME, BOARD_SIZE, WALL_LEN, cellToWorld } from './layout.js';

export const BASE_TOP = BOARD_TOP - 0.15;

export function createWoodSet() {
  return {
    walnut: createWood({ ...WOODS.walnut, seed: 3, size: 1024, knots: 2 }),
    maple: createWood({ ...WOODS.maple, seed: 11, size: 512 }),
    cherry: createWood({ ...WOODS.cherry, seed: 21, size: 512 }),
    table: createWood({ ...WOODS.table, seed: 5, size: 1024, knots: 3 }),
  };
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '600 84px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8c27a';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBoard(woods) {
  const group = new THREE.Group();

  // 테이블
  const tableMat = new THREE.MeshStandardMaterial({
    map: variant(woods.table.map, { repeat: [3, 3] }),
    bumpMap: variant(woods.table.bumpMap, { repeat: [3, 3] }),
    bumpScale: 0.6,
    roughness: 0.62,
    color: 0xb89a88,
  });
  const table = new THREE.Mesh(new THREE.CircleGeometry(60, 64), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  group.add(table);

  // 보드 받침 (프레임)
  const frameMat = new THREE.MeshPhysicalMaterial({
    map: woods.walnut.map,
    bumpMap: woods.walnut.bumpMap,
    bumpScale: 0.5,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  });
  const base = new THREE.Mesh(new RoundedBoxGeometry(BOARD_SIZE, BASE_TOP, BOARD_SIZE, 6, 0.35), frameMat);
  base.position.y = BASE_TOP / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 홈 바닥 (칸 사이 어두운 부분)
  const grooveMat = new THREE.MeshStandardMaterial({ color: 0x2a170c, roughness: 0.9 });
  const groove = new THREE.Mesh(new THREE.BoxGeometry(INNER + 0.1, 0.02, INNER + 0.1), grooveMat);
  groove.position.y = BASE_TOP + 0.005;
  groove.receiveShadow = true;
  group.add(groove);

  // 황동 트림
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9953f, metalness: 1, roughness: 0.28 });
  const trimW = 0.08;
  const edge = INNER / 2 + 0.16;
  for (let s = 0; s < 4; s++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(edge * 2 + trimW, 0.05, trimW), brass);
    const a = (s * Math.PI) / 2;
    bar.position.set(Math.sin(a) * edge, BASE_TOP + 0.02, Math.cos(a) * edge);
    bar.rotation.y = a;
    bar.castShadow = true;
    group.add(bar);
  }

  // 81칸 — 칸마다 나뭇결 위치를 달리함
  const cellGeo = new RoundedBoxGeometry(CELL, 0.2, CELL, 3, 0.06);
  const cells = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const rot = (x * 7 + y * 3) % 2 ? 0 : Math.PI / 2;
      const off = [((x * 37 + y * 11) % 17) / 17, ((x * 13 + y * 29) % 19) / 19];
      const mat = new THREE.MeshPhysicalMaterial({
        map: variant(woods.maple.map, { offset: off, repeat: [0.35, 0.35], rotation: rot }),
        bumpMap: variant(woods.maple.bumpMap, { offset: off, repeat: [0.35, 0.35], rotation: rot }),
        bumpScale: 0.35,
        roughness: 0.48,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        emissive: new THREE.Color(0x000000),
      });
      const m = new THREE.Mesh(cellGeo, mat);
      const p = cellToWorld(x, y);
      m.position.set(p.x, BOARD_TOP - 0.1, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.cell = { x, y };
      group.add(m);
      cells.push(m);
    }
  }

  // 좌표 각인 (a~i, 1~9)
  const labelGeo = new THREE.PlaneGeometry(0.6, 0.6);
  const labelOffset = INNER / 2 + 0.62;
  for (let i = 0; i < 9; i++) {
    const letter = new THREE.Mesh(
      labelGeo,
      new THREE.MeshBasicMaterial({ map: labelTexture('abcdefghi'[i]), transparent: true, depthWrite: false }),
    );
    letter.rotation.x = -Math.PI / 2;
    letter.position.set((i - 4) * PITCH, BASE_TOP + 0.012, labelOffset);
    group.add(letter);
    const num = new THREE.Mesh(
      labelGeo,
      new THREE.MeshBasicMaterial({ map: labelTexture(String(i + 1)), transparent: true, depthWrite: false }),
    );
    num.rotation.x = -Math.PI / 2;
    num.position.set(-labelOffset, BASE_TOP + 0.012, (4 - i) * PITCH);
    group.add(num);
  }

  // 벽 보관대 4면
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x3a2314, roughness: 0.7, transparent: true, opacity: 0.55 });
  const trayGeo = new RoundedBoxGeometry(5.1, 0.02, WALL_LEN + 0.24, 2, 0.01);
  const trayDist = INNER / 2 + 1.9;
  for (let s = 0; s < 4; s++) {
    const a = (s * Math.PI) / 2;
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.set(Math.sin(a) * trayDist, BASE_TOP + 0.01, Math.cos(a) * trayDist);
    tray.rotation.y = a;
    tray.receiveShadow = true;
    group.add(tray);
  }

  return { group, cells, frameMat };
}

export { GROOVE };
