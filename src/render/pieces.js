// 말(폰)과 벽 메시
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { variant } from './textures.js';
import { WALL_LEN, WALL_THICK, WALL_HEIGHT } from './layout.js';

export const PAWN_COLORS = [
  { id: 'ivory', name: '상아', hex: '#f6efe0', lacquer: false },
  { id: 'ebony', name: '흑단', hex: '#2b2320', lacquer: false },
  { id: 'crimson', name: '버건디', hex: '#9a1f2e', lacquer: true },
  { id: 'teal', name: '청록', hex: '#1d7a73', lacquer: true },
  { id: 'gold', name: '황금', hex: '#d19a2a', lacquer: true, metal: true },
  { id: 'navy', name: '남색', hex: '#26407e', lacquer: true },
];

export const colorById = (id) => PAWN_COLORS.find((c) => c.id === id) ?? PAWN_COLORS[0];

let pawnGeo = null;
function getPawnGeometry() {
  if (pawnGeo) return pawnGeo;
  // 체스 폰 느낌의 회전체 프로필 (반지름, 높이)
  const pts = [
    [0, 0],
    [0.36, 0],
    [0.38, 0.03],
    [0.38, 0.08],
    [0.33, 0.12],
    [0.3, 0.16],
    [0.24, 0.22],
    [0.19, 0.34],
    [0.15, 0.48],
    [0.14, 0.56],
    [0.23, 0.6],
    [0.24, 0.63],
    [0.16, 0.67],
    [0.13, 0.7],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const body = new THREE.LatheGeometry(pts, 48);
  const head = new THREE.SphereGeometry(0.21, 40, 24);
  head.translate(0, 0.86, 0);
  pawnGeo = { body, head };
  return pawnGeo;
}

export function createPawn(colorId, woods) {
  const c = colorById(colorId);
  const { body, head } = getPawnGeometry();
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(c.hex),
    roughness: c.metal ? 0.3 : c.lacquer ? 0.28 : 0.42,
    metalness: c.metal ? 0.85 : 0,
    clearcoat: 1,
    clearcoatRoughness: c.lacquer ? 0.06 : 0.2,
    sheen: c.lacquer ? 0 : 0.3,
    emissive: new THREE.Color(c.hex),
    emissiveIntensity: 0,
  });
  if (!c.lacquer) {
    mat.map = variant(woods.maple.map, { repeat: [0.6, 1.4] });
    mat.bumpMap = woods.maple.bumpMap;
    mat.bumpScale = 0.2;
  }
  const group = new THREE.Group();
  for (const g of [body, head]) {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.scale.setScalar(1.3);
    group.add(m);
  }
  group.userData.material = mat;
  return group;
}

let wallGeo = null;
export function getWallGeometry() {
  if (!wallGeo) {
    wallGeo = new RoundedBoxGeometry(WALL_LEN, WALL_HEIGHT, WALL_THICK, 3, 0.035);
    wallGeo.translate(0, WALL_HEIGHT / 2, 0); // 바닥 기준
  }
  return wallGeo;
}

let wallMatCache = null;
export function createWallMesh(woods) {
  if (!wallMatCache) {
    wallMatCache = new THREE.MeshPhysicalMaterial({
      map: variant(woods.cherry.map, { repeat: [0.9, 0.25] }),
      bumpMap: variant(woods.cherry.bumpMap, { repeat: [0.9, 0.25] }),
      bumpScale: 0.4,
      roughness: 0.4,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    });
  }
  const m = new THREE.Mesh(getWallGeometry(), wallMatCache);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createGhostWall() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3dff7a,
    emissive: 0x1aff5a,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const m = new THREE.Mesh(getWallGeometry(), mat);
  m.renderOrder = 5;
  m.visible = false;
  return m;
}
