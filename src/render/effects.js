// 연출: 이동 가능 칸 표시, 현재 차례 링, 먼지 파티클, 승리 꽃가루
import * as THREE from 'three';
import { BOARD_TOP, cellToWorld, CELL } from './layout.js';

function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', ring = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, ring ? 30 : 0, 64, 64, 62);
  if (ring) {
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, inner);
    g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, outer);
  } else {
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(stage) {
    this.stage = stage;
    this.scene = stage.scene;
    this.glowTex = radialTexture();
    this.ringTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', true);

    // 이동 가능 칸 마커 풀
    this.markers = [];
    this.markerGeo = new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95);
    this.hovered = null;

    // 현재 차례 말 아래 링
    this.turnRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.ringTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffd27a,
      }),
    );
    this.turnRing.rotation.x = -Math.PI / 2;
    this.turnRing.renderOrder = 3;
    this.scene.add(this.turnRing);

    this.particles = [];
    stage.onFrame.add((dt, t) => this.update(dt, t));
  }

  setTurnRing(obj, colorHex) {
    this.turnRingTarget = obj;
    this.turnRing.material.color.set(colorHex).lerp(new THREE.Color(0xffe2a0), 0.35);
    this.turnRing.visible = !!obj;
  }

  showMarkers(moves, colorHex) {
    this.clearMarkers();
    const col = new THREE.Color(colorHex).lerp(new THREE.Color(0xfff0c0), 0.4);
    for (const mv of moves) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.glowTex,
        color: col,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(this.markerGeo, mat);
      const p = cellToWorld(mv.x, mv.y);
      m.position.set(p.x, BOARD_TOP + 0.012, p.z);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 4;
      m.userData.move = mv;
      m.userData.born = performance.now();
      this.scene.add(m);
      this.markers.push(m);
    }
  }

  setHoverCell(cell) {
    this.hovered = cell;
  }

  clearMarkers() {
    for (const m of this.markers) {
      this.scene.remove(m);
      m.material.dispose();
    }
    this.markers = [];
  }

  burst(pos, { color = 0xe9d2a8, count = 26, speed = 2.2, size = 0.22, life = 0.9, up = 1.2 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      vel.push(new THREE.Vector3(Math.cos(a) * s, Math.random() * up, Math.sin(a) * s));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.glowTex,
      color,
      size,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.particles.push({ kind: 'points', obj: pts, vel, age: 0, life, drag: 3.5, gravity: -1.5 });
  }

  confetti(colors) {
    const count = 420;
    const geo = new THREE.PlaneGeometry(0.16, 0.26);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const data = [];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 3;
      data.push({
        p: new THREE.Vector3(Math.cos(a) * r, 1 + Math.random() * 2, Math.sin(a) * r),
        v: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 5), 8 + Math.random() * 9, Math.sin(a) * (2 + Math.random() * 5)),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      });
      mesh.setColorAt(i, color.set(colors[i % colors.length]));
    }
    mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.particles.push({ kind: 'confetti', obj: mesh, data, age: 0, life: 7 });
  }

  clearAll() {
    for (const p of this.particles) {
      this.scene.remove(p.obj);
      p.obj.geometry.dispose();
      p.obj.material.dispose();
    }
    this.particles = [];
    this.clearMarkers();
  }

  update(dt, t) {
    // 마커: 페이드인 + 맥동, 호버 시 밝게
    for (const m of this.markers) {
      const born = Math.min(1, (performance.now() - m.userData.born) / 250);
      const mv = m.userData.move;
      const hot = this.hovered && this.hovered.x === mv.x && this.hovered.y === mv.y;
      m.material.opacity = born * (hot ? 1 : 0.5 + Math.sin(t * 4) * 0.15);
      const s = hot ? 1.08 : 0.9 + Math.sin(t * 4) * 0.03;
      m.scale.set(s, s, s);
    }

    if (this.turnRing.visible && this.turnRingTarget) {
      const p = this.turnRingTarget.position;
      this.turnRing.position.set(p.x, Math.max(BOARD_TOP + 0.015, p.y + 0.015), p.z);
      const s = 1 + Math.sin(t * 3) * 0.08;
      this.turnRing.scale.set(s, s, s);
      this.turnRing.material.opacity = 0.75 + Math.sin(t * 3) * 0.2;
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.kind === 'points') {
        const arr = p.obj.geometry.attributes.position.array;
        p.vel.forEach((v, k) => {
          v.multiplyScalar(Math.exp(-p.drag * dt));
          v.y += p.gravity * dt;
          arr[k * 3] += v.x * dt;
          arr[k * 3 + 1] = Math.max(BOARD_TOP, arr[k * 3 + 1] + v.y * dt);
          arr[k * 3 + 2] += v.z * dt;
        });
        p.obj.geometry.attributes.position.needsUpdate = true;
        p.obj.material.opacity = 1 - p.age / p.life;
      } else {
        p.data.forEach((d, k) => {
          d.v.y -= 9 * dt;
          d.v.multiplyScalar(Math.exp(-1.6 * dt));
          if (d.v.y < -2.2) d.v.y = -2.2; // 팔랑팔랑
          d.p.addScaledVector(d.v, dt);
          if (d.p.y < 0.52) {
            d.p.y = 0.52;
            d.v.set(0, 0, 0);
          } else {
            d.rot.x += d.spin.x * dt;
            d.rot.y += d.spin.y * dt;
            d.rot.z += d.spin.z * dt;
          }
          q.setFromEuler(d.rot);
          const fade = Math.min(1, (p.life - p.age) / 1.2);
          m4.compose(d.p, q, one.clone().multiplyScalar(Math.max(0.001, fade)));
          p.obj.setMatrixAt(k, m4);
        });
        p.obj.instanceMatrix.needsUpdate = true;
      }
      if (p.age >= p.life) {
        this.scene.remove(p.obj);
        p.obj.geometry.dispose();
        p.obj.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
