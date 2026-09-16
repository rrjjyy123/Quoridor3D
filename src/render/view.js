// 3D 보드 뷰: 게임 상태를 화면에 반영하고 애니메이션, 포인터 입력, 카메라를 담당
import * as THREE from 'three';
import { createStage } from './scene.js';
import { createBoard, createWoodSet, BASE_TOP } from './board.js';
import { createPawn, createWallMesh, createGhostWall, colorById } from './pieces.js';
import { Effects } from './effects.js';
import { tween, ease } from './anim.js';
import { BOARD_TOP, BOARD_SIZE, INNER, SEAT_ANGLE, cellToWorld, wallToWorld, PITCH } from './layout.js';

const TRAY_DIST = INNER / 2 + 1.9;
const STORE_GAP = 0.48;
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

const shortestAngle = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

export class BoardView {
  constructor(container) {
    this.container = container;
    this.stage = createStage(container);
    this.woods = createWoodSet();
    this.board = createBoard(this.woods);
    this.stage.scene.add(this.board.group);
    this.effects = new Effects(this.stage);
    this.ghost = createGhostWall();
    this.stage.scene.add(this.ghost);

    this.pawns = [];
    this.storage = []; // 플레이어별 보관 중인 벽 메시
    this.placed = []; // 놓인 벽 메시 (game.walls 순서)
    this.goalStrips = [];
    this.cameraMode = 'auto';
    this.attract = true;
    this.handlers = {};

    this.hitTargets = []; // 말/벽 보관대 클릭 판정용 투명 메시
    this.trayHits = [];
    this.selected = null; // { kind: 'pawn' | 'walls', player }

    // 현재 플레이어의 벽 보관대 발광
    this.trayGlow = new THREE.Object3D();
    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 3.2),
      new THREE.MeshBasicMaterial({
        map: this.effects.glowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffc870,
      }),
    );
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = BASE_TOP + 0.03;
    glowPlane.renderOrder = 3;
    this.trayGlow.add(glowPlane);
    this.trayGlow.visible = false;
    this.stage.scene.add(this.trayGlow);
    this.trayGlowMat = glowPlane.material;

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
    this.bindPointer();

    this.stage.onFrame.add((dt, t) => {
      if (this.trayGlow.visible) {
        const sel = this.selected?.kind === 'walls';
        this.trayGlowMat.opacity = sel ? 0.85 + Math.sin(t * 5) * 0.1 : 0.3 + Math.sin(t * 3) * 0.15;
      }
      if (this.attract) {
        const c = this.stage.controls;
        const off = this.stage.camera.position.clone().sub(c.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.12);
        this.stage.camera.position.copy(c.target).add(off);
      }
    });
    this.stage.resizeHandlers.add(() => {
      if (!this.attract && !this.cameraTweening) this.focusCamera(this.lastSeat ?? 0, 0.3);
    });

    const c = this.stage.controls;
    this.stage.camera.position.set(0, 16, 22);
    c.update();
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  // ---------- 포인터 ----------
  bindPointer() {
    const el = this.stage.renderer.domElement;
    let down = null;
    const activePointers = new Set();
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.stage.camera);
      const hit = new THREE.Vector3();
      const point = this.raycaster.ray.intersectPlane(this.plane, hit) ? hit : null;
      // 맞은 판정 영역 전부 (가까운 순, 중복 제거). 말은 실제 모양에도 맞았는지(precise) 표시
      const targets = [];
      for (const h of this.raycaster.intersectObjects(this.hitTargets, false)) {
        const t = h.object.userData.hit;
        if (targets.some((x) => x.kind === t.kind && x.player === t.player)) continue;
        const precise =
          t.kind === 'pawn' &&
          this.raycaster.intersectObjects(
            this.pawns[t.player].children.filter((c) => !c.userData.hit),
            false,
          ).length > 0;
        targets.push({ ...t, precise });
      }
      return { point, targets };
    };
    const release = (e) => activePointers.delete(e.pointerId);
    // 캔버스 밖에서 손을 떼도 누락되지 않게 (남아 있으면 이후 모든 탭이 멀티터치로 오인됨)
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    el.addEventListener('pointerdown', (e) => {
      activePointers.add(e.pointerId);
      // 두 손가락(확대/회전) 제스처는 탭으로 보지 않음
      down = activePointers.size > 1 ? { multi: true } : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      if (e.button === 2) this.handlers.rotate?.();
    });
    el.addEventListener('pointercancel', (e) => {
      release(e);
      down = null;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const { point, targets } = pick(e);
      this.handlers.hover?.(point, targets);
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.handlers.hover?.(null, []);
    });
    el.addEventListener('pointerup', (e) => {
      const wasMulti = activePointers.size > 1;
      release(e);
      if (!down || down.multi || wasMulti || down.id !== e.pointerId || e.button === 2) {
        if (activePointers.size === 0) down = null;
        return;
      }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      down = null;
      if (moved > 10 || dt > 600) return;
      const { point, targets } = pick(e);
      if (point || targets.length) this.handlers.tap?.(point, targets, e.pointerType);
    });
  }

  // ---------- 게임 구성 ----------
  clearGame() {
    for (const p of this.pawns) this.stage.scene.remove(p);
    for (const list of this.storage) for (const w of list) this.stage.scene.remove(w);
    for (const w of this.placed) this.stage.scene.remove(w);
    for (const s of this.goalStrips) this.stage.scene.remove(s);
    for (const h of this.trayHits) this.stage.scene.remove(h);
    this.hitTargets = [];
    this.trayHits = [];
    this.selected = null;
    this.trayGlow.visible = false;
    this.pawns = [];
    this.storage = [];
    this.placed = [];
    this.goalStrips = [];
    this.ghost.visible = false;
    this.effects.clearAll();
    this.effects.setTurnRing(null);
    this.effects.setGoalLine(null);
  }

  setupGame(game, playerConfigs) {
    this.clearGame();
    this.colors = playerConfigs.map((p) => colorById(p.color).hex);
    const wallsEach = 20 / game.numPlayers;
    game.players.forEach((pl, i) => {
      const pawn = createPawn(playerConfigs[i].color, this.woods);
      const w = cellToWorld(pl.x, pl.y);
      pawn.position.set(w.x, BOARD_TOP, w.z);
      this.stage.scene.add(pawn);

      // 클릭 판정 (말 모양과 비슷한 원기둥)
      const pawnHit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.45, 12), HIT_MAT);
      pawnHit.position.y = 0.72;
      pawnHit.userData.hit = { kind: 'pawn', player: i };
      pawn.add(pawnHit);
      this.hitTargets.push(pawnHit);

      const a = SEAT_ANGLE[pl.seat];
      // 보관대 판정: 서 있는 벽 높이 정도로 낮게 (보드의 홈을 가리지 않도록)
      const trayHit = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.8, 2.6), HIT_MAT);
      trayHit.position.set(Math.sin(a) * TRAY_DIST, BASE_TOP + 0.4, Math.cos(a) * TRAY_DIST);
      trayHit.rotation.y = a;
      trayHit.userData.hit = { kind: 'walls', player: i };
      this.stage.scene.add(trayHit);
      this.hitTargets.push(trayHit);
      this.trayHits.push(trayHit);
      this.pawns.push(pawn);

      // 목표 변 표시 (플레이어 색 발광 띠)
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(INNER + 0.3, 0.03, 0.07),
        new THREE.MeshStandardMaterial({
          color: this.colors[i],
          emissive: new THREE.Color(this.colors[i]).lerp(new THREE.Color(0xffc870), 0.45),
          emissiveIntensity: 0.9,
          roughness: 0.4,
        }),
      );
      const ga = SEAT_ANGLE[(pl.seat + 2) % 4];
      const gd = INNER / 2 + 0.27;
      strip.position.set(Math.sin(ga) * gd, BASE_TOP + 0.03, Math.cos(ga) * gd);
      strip.rotation.y = ga;
      this.stage.scene.add(strip);
      this.goalStrips.push(strip);

      this.storage.push([]);
      for (let k = 0; k < wallsEach; k++) {
        const m = createWallMesh(this.woods);
        this.stage.scene.add(m);
        this.storage[i].push(m);
      }
    });
    this.game = game;
    // 이미 진행된 게임 (이어하기): 놓인 벽 배치
    for (const wall of game.walls) {
      const m = this.storage[wall.owner].pop();
      const t = wallToWorld(wall);
      m.position.set(t.x, BASE_TOP, t.z);
      m.rotation.set(0, t.rotY, 0);
      this.placed.push(m);
    }
    game.players.forEach((_, i) => this.layoutStorage(i, 0));
    this.attract = false;
  }

  storageSlot(pi, k) {
    const seat = this.game.players[pi].seat;
    const a = SEAT_ANGLE[seat];
    const max = 20 / this.game.numPlayers;
    const t = (k - (max - 1) / 2) * STORE_GAP;
    return {
      x: Math.sin(a) * TRAY_DIST + Math.cos(a) * t,
      z: Math.cos(a) * TRAY_DIST - Math.sin(a) * t,
      rotY: a + Math.PI / 2,
    };
  }

  layoutStorage(pi, duration = 0.35) {
    this.storage[pi].forEach((m, k) => {
      const s = this.storageSlot(pi, k);
      if (!duration) {
        m.position.set(s.x, BASE_TOP + 0.04, s.z);
        m.rotation.set(0, s.rotY, 0);
        return;
      }
      const from = m.position.clone();
      tween({
        duration,
        update: (e) => {
          m.position.set(from.x + (s.x - from.x) * e, BASE_TOP + 0.04, from.z + (s.z - from.z) * e);
        },
      });
    });
  }

  // ---------- 턴 표시 ----------
  setTurn(game) {
    this.game = game;
    const pi = game.current;
    this.effects.setTurnRing(game.winner === null ? this.pawns[pi] : null, this.colors[pi]);
    this.pawns.forEach((p, i) => {
      p.userData.material.emissiveIntensity = i === pi && game.winner === null ? 0.12 : 0;
    });
    this.goalStrips.forEach((s, i) => {
      s.material.emissiveIntensity = i === pi ? 1.6 : 0.25;
      s.scale.y = i === pi ? 1.6 : 1;
    });
    // 목표 변(도달해야 하는 끝줄) 표시
    const goalAngle = SEAT_ANGLE[(game.players[pi].seat + 2) % 4];
    this.effects.setGoalLine(game.winner === null ? goalAngle : null, this.colors[pi]);

    const a = SEAT_ANGLE[game.players[pi].seat];
    this.trayGlow.position.set(Math.sin(a) * TRAY_DIST, 0, Math.cos(a) * TRAY_DIST);
    this.trayGlow.rotation.y = a;
    this.trayGlow.visible = game.winner === null && game.players[pi].walls > 0;
    this.trayGlowMat.color.set(this.colors[pi]).lerp(new THREE.Color(0xffc870), 0.55);
    if (this.cameraMode === 'auto') this.focusCamera(game.players[pi].seat);
  }

  // 행동 직전: 들어올린 말/벽을 제자리로 돌리지 않고 선택만 해제 (이어서 애니메이션)
  dropSelection() {
    this.selToken = (this.selToken ?? 0) + 1;
    this.selected = null;
  }

  // 선택 표시: 'pawn' 이면 말을 살짝 들어올리고, 'walls' 면 보관대 맨 위 벽을 들어올림
  setSelection(kind, player, { instant = false } = {}) {
    const prev = this.selected;
    const token = (this.selToken = (this.selToken ?? 0) + 1);
    const lift = (obj, toY, rotX = 0) => {
      if (!obj) return;
      if (instant) {
        obj.position.y = toY;
        obj.rotation.x = rotX;
        return;
      }
      const fromY = obj.position.y;
      const fromRot = obj.rotation.x;
      tween({
        duration: 0.22,
        easing: ease.out,
        update: (e) => {
          if (token !== this.selToken) return;
          obj.position.y = fromY + (toY - fromY) * e;
          obj.rotation.x = fromRot + (rotX - fromRot) * e;
        },
      });
    };
    const topWall = (p) => this.storage[p]?.[this.storage[p].length - 1];
    if (prev && !(prev.kind === kind && prev.player === player)) {
      if (prev.kind === 'pawn') lift(this.pawns[prev.player], BOARD_TOP);
      else lift(topWall(prev.player), BASE_TOP + 0.04);
    }
    this.selected = kind ? { kind, player } : null;
    if (kind === 'pawn') lift(this.pawns[player], BOARD_TOP + 0.3);
    else if (kind === 'walls') lift(topWall(player), BASE_TOP + 0.7, 0.18);
  }

  // ---------- 애니메이션 ----------
  async animateMove(pi, to, jump) {
    const pawn = this.pawns[pi];
    const from = pawn.position.clone();
    const w = cellToWorld(to.x, to.y);
    const height = jump ? 1.5 : 0.8;
    await tween({
      duration: jump ? 0.55 : 0.42,
      easing: ease.inOut,
      update: (e, k) => {
        pawn.position.x = from.x + (w.x - from.x) * e;
        pawn.position.z = from.z + (w.z - from.z) * e;
        pawn.position.y = BOARD_TOP + Math.sin(k * Math.PI) * height;
        const stretch = 1 + Math.sin(k * Math.PI) * 0.08;
        pawn.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
      },
    });
    this.handlers.land?.('pawn');
    this.effects.burst(new THREE.Vector3(w.x, BOARD_TOP + 0.05, w.z), { color: 0xffe0b0, count: 18, size: 0.18 });
    await tween({
      duration: 0.22,
      easing: ease.out,
      update: (e, k) => {
        const s = Math.sin(k * Math.PI) * 0.12;
        pawn.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
      },
    });
    pawn.scale.set(1, 1, 1);
  }

  async animateWall(pi, wall) {
    const m = this.storage[pi].pop();
    this.placed.push(m);
    this.layoutStorage(pi);
    const from = m.position.clone();
    const fromRot = m.rotation.y;
    const t = wallToWorld(wall);
    const toRot = shortestAngle(fromRot, t.rotY);
    const lift = 2.4;
    await tween({
      duration: 0.6,
      easing: ease.inOut,
      update: (e, k) => {
        m.position.x = from.x + (t.x - from.x) * e;
        m.position.z = from.z + (t.z - from.z) * e;
        m.position.y = from.y + (1.4 - from.y) * e + Math.sin(k * Math.PI) * lift * 0.5;
        m.rotation.y = fromRot + (toRot - fromRot) * e;
        m.rotation.x = Math.sin(k * Math.PI) * 0.25;
      },
    });
    const startY = m.position.y;
    await tween({
      duration: 0.42,
      easing: ease.outBounce,
      update: (e) => {
        m.position.y = startY + (BASE_TOP - startY) * e;
        m.rotation.x = 0;
      },
    });
    m.position.y = BASE_TOP;
    this.handlers.land?.('wall');
    const dir = wall.o === 'h' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    for (const s of [-0.8, 0, 0.8]) {
      this.effects.burst(new THREE.Vector3(t.x, BOARD_TOP, t.z).addScaledVector(dir, s * PITCH), {
        color: 0xd9b98a,
        count: 14,
        size: 0.2,
        speed: 1.6,
      });
    }
    this.shake(0.12);
  }

  // ---------- 무르기 ----------
  async undoMove(pi, to) {
    const pawn = this.pawns[pi];
    const from = pawn.position.clone();
    const w = cellToWorld(to.x, to.y);
    await tween({
      duration: 0.35,
      update: (e, k) => {
        pawn.position.set(from.x + (w.x - from.x) * e, BOARD_TOP + Math.sin(k * Math.PI) * 0.6, from.z + (w.z - from.z) * e);
      },
    });
    pawn.position.y = BOARD_TOP;
  }

  async undoWall(pi) {
    const m = this.placed.pop();
    this.storage[pi].push(m);
    const s = this.storageSlot(pi, this.storage[pi].length - 1);
    const from = m.position.clone();
    const fromRot = m.rotation.y;
    const toRot = shortestAngle(fromRot, s.rotY);
    await tween({
      duration: 0.5,
      update: (e, k) => {
        m.position.set(
          from.x + (s.x - from.x) * e,
          from.y + (BASE_TOP + 0.04 - from.y) * e + Math.sin(k * Math.PI) * 2,
          from.z + (s.z - from.z) * e,
        );
        m.rotation.y = fromRot + (toRot - fromRot) * e;
      },
    });
    this.layoutStorage(pi, 0);
  }

  async celebrate(pi) {
    this.clearHints();
    const pawn = this.pawns[pi];
    const base = pawn.position.clone();
    this.effects.confetti([this.colors[pi], '#f5d27a', '#fff4dc', '#c9953f']);
    this.effects.burst(base.clone().setY(BOARD_TOP + 0.3), { color: 0xffd27a, count: 60, speed: 4, size: 0.35, up: 4, life: 1.4 });
    const light = this.stage.lights.warmSpot;
    // 연출이 겹쳐도 밝기가 누적되지 않도록 기준값 고정
    this.baseSpotIntensity ??= light.intensity;
    const baseIntensity = this.baseSpotIntensity;
    tween({
      duration: 3,
      easing: ease.linear,
      update: (e, k) => {
        light.intensity = baseIntensity * (1 + Math.sin(k * Math.PI) * 2.5);
      },
    });
    await tween({
      duration: 1.6,
      easing: ease.inOut,
      update: (e, k) => {
        pawn.position.y = base.y + Math.sin(k * Math.PI) * 1.8;
        pawn.rotation.y = e * Math.PI * 4;
      },
    });
    pawn.rotation.y = 0;
    if (!pawn.parent) return; // 연출 도중 새 게임이 시작됨
    this.stage.controls.autoRotate = true;
    this.stage.controls.autoRotateSpeed = 0.8;
  }

  shake(amount) {
    const cam = this.stage.camera;
    tween({
      duration: 0.25,
      easing: ease.linear,
      update: (e, k) => {
        const a = amount * (1 - k);
        cam.position.x += (Math.random() - 0.5) * a;
        cam.position.y += (Math.random() - 0.5) * a;
      },
    });
  }

  // ---------- 힌트 (마커, 고스트 벽) ----------
  showMoveMarkers(moves, pi) {
    this.effects.showMarkers(moves, this.colors[pi]);
  }

  setHoverCell(cell) {
    this.effects.setHoverCell(cell);
  }

  showGhost(wall, ok) {
    if (!wall) {
      this.ghost.visible = false;
      return;
    }
    const t = wallToWorld(wall);
    this.ghost.visible = true;
    this.ghost.position.set(t.x, BASE_TOP + 0.02, t.z);
    this.ghost.rotation.set(0, t.rotY, 0);
    const mat = this.ghost.material;
    mat.color.set(ok ? 0x3dff7a : 0xff4a3a);
    mat.emissive.set(ok ? 0x1aff5a : 0xff1a0a);
  }

  clearHints() {
    this.effects.clearMarkers();
    this.effects.setHoverCell(null);
    this.showGhost(null);
  }

  // ---------- 카메라 ----------
  setCameraMode(mode) {
    this.cameraMode = mode;
    const c = this.stage.controls;
    c.enableRotate = mode !== 'top';
    this.focusCamera(mode === 'top' ? 0 : (this.lastSeat ?? 0));
  }

  fitDistance(polar) {
    const cam = this.stage.camera;
    const halfFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const half = BOARD_SIZE * 0.5;
    const tilt = Math.cos(polar) * 0.55 + 0.45; // 기울면 세로로 짧아 보임
    const dV = (half * tilt) / Math.tan(halfFov) + half * 0.6;
    const dH = half / (Math.tan(halfFov) * cam.aspect) + half * 0.4;
    return Math.min(46, Math.max(dV, dH) * 1.02);
  }

  focusCamera(seat, duration = 1.1) {
    this.lastSeat = seat;
    this.stage.controls.autoRotate = false;
    const c = this.stage.controls;
    const cam = this.stage.camera;
    const offset = cam.position.clone().sub(c.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    const top = this.cameraMode === 'top';
    const targetPolar = top ? 0.001 : 0.78;
    const targetTheta = shortestAngle(sph.theta, top ? 0 : SEAT_ANGLE[seat]);
    const targetR = this.fitDistance(targetPolar) * (top ? 0.92 : 0.9);
    const start = { r: sph.radius, phi: sph.phi, theta: sph.theta };
    this.cameraTweening = true;
    return tween({
      duration,
      easing: ease.inOut,
      update: (e) => {
        const s = new THREE.Spherical(
          start.r + (targetR - start.r) * e,
          start.phi + (targetPolar - start.phi) * e,
          start.theta + (targetTheta - start.theta) * e,
        );
        cam.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(s));
      },
      complete: () => {
        this.cameraTweening = false;
      },
    });
  }

  startAttract() {
    this.clearGame();
    this.attract = true;
    this.stage.controls.autoRotate = false;
    this.stage.controls.enableRotate = true;
  }
}
