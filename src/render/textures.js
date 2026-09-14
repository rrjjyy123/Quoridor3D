// 절차적 원목 텍스처 (외부 이미지 없이 Canvas로 생성)
import * as THREE from 'three';

function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256).map((_, i) => i);
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => rand());
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  // 주기적 value noise (periodX/periodY 로 타일링)
  return (x, y, px = 256, py = 256) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const h = (a, b) => vals[perm[(((a % px) + px) % px & 255) + perm[(((b % py) + py) % py) & 255]]];
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), xf), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf);
  };
}

/**
 * @param {object} o
 * @param {number[]} o.light  밝은 나무색 [r,g,b]
 * @param {number[]} o.dark   나이테색 [r,g,b]
 * @param {number} o.rings    나이테 밀도
 * @param {number} o.seed
 * @param {number} o.size     캔버스 크기
 */
export function createWood({ light, dark, rings = 10, seed = 1, size = 512, streak = 0.35, knots = 0 }) {
  const noise = makeNoise(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const ctx = canvas.getContext('2d');
  const bctx = bump.getContext('2d');
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);

  const knotList = [];
  const rnd = makeNoise(seed + 7);
  for (let k = 0; k < knots; k++) knotList.push([rnd(k * 3.1, 0.5) * size, rnd(0.5, k * 5.7) * size, 10 + rnd(k, k) * 18]);

  for (let j = 0; j < size; j++) {
    const v = j / size;
    for (let i = 0; i < size; i++) {
      const u = i / size;
      // 결은 u(가로) 방향으로 길게
      let warp =
        noise(u * 4, v * 6, 4, 6) * 0.9 + noise(u * 8, v * 12, 8, 12) * 0.4 + noise(u * 16, v * 24, 16, 24) * 0.15;
      for (const [kx, ky, kr] of knotList) {
        const dx = i - kx;
        const dy = (j - ky) * 2.2;
        const d2 = dx * dx + dy * dy;
        warp += (kr * kr * 1.5) / (d2 + kr * kr) * 0.8;
      }
      const d = v * rings + warp * 2.2;
      const ring = d - Math.floor(d);
      const ringT = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 6);
      const fine = noise(u * 3, v * 180, 3, 180);
      const t = Math.min(1, ringT * 0.55 + fine * streak + noise(u * 40, v * 40, 40, 40) * 0.08);
      const idx = (i + j * size) * 4;
      img.data[idx] = light[0] + (dark[0] - light[0]) * t;
      img.data[idx + 1] = light[1] + (dark[1] - light[1]) * t;
      img.data[idx + 2] = light[2] + (dark[2] - light[2]) * t;
      img.data[idx + 3] = 255;
      const b = 255 - t * 110;
      bimg.data[idx] = bimg.data[idx + 1] = bimg.data[idx + 2] = b;
      bimg.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

// 텍스처 오프셋만 다른 복제본 (칸마다 다른 나뭇결)
export function variant(tex, { offset = [0, 0], repeat = [1, 1], rotation = 0 } = {}) {
  const t = tex.clone();
  t.offset.set(offset[0], offset[1]);
  t.repeat.set(repeat[0], repeat[1]);
  t.rotation = rotation;
  t.needsUpdate = true;
  return t;
}

export const WOODS = {
  walnut: { light: [112, 70, 42], dark: [58, 33, 18], rings: 14, streak: 0.4 },
  maple: { light: [226, 188, 138], dark: [176, 128, 80], rings: 9, streak: 0.3 },
  cherry: { light: [190, 104, 62], dark: [118, 52, 26], rings: 11, streak: 0.35 },
  table: { light: [74, 44, 28], dark: [34, 19, 11], rings: 22, streak: 0.45 },
};
