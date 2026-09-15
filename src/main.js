import './ui/styles.css';
import { BoardView } from './render/view.js';
import { GameSession } from './game/state.js';
import { legalPawnMoves, checkWall } from './game/rules.js';
import { resolveTap } from './game/input.js';
import { worldToCell, worldToAnchor } from './render/layout.js';
import { colorById } from './render/pieces.js';
import { initSetup } from './ui/setup.js';
import { Hud } from './ui/hud.js';
import { sfx, isMuted, setMuted } from './audio/sfx.js';

const $ = (s) => document.querySelector(s);
const overlay = (id, show) => $(id).classList.toggle('show', show);

// 텍스처 생성이 무거우므로 로딩 화면을 먼저 그린 뒤 시작
await new Promise((r) => setTimeout(r, 50));

const view = new BoardView($('#stage'));
const hud = new Hud();

let session = null;
let mode = null; // null(선택 전) | 'move'(말 선택) | 'wall'(벽 선택)
let orientation = 'h';
let pending = null; // 터치: 미리보기 중인 벽
let hoverWall = null;
let busy = false;

const game = () => session.game;
const nameOf = (i) => session.config.players[i].name;
const colorOf = (i) => colorById(session.config.players[i].color).hex;
const playing = () => session && !busy && game().winner === null;

// ---------- 게임 시작 / 종료 ----------
function startSession(s) {
  session = s;
  busy = false;
  hud.setBusy(false);
  overlay('#win', false);
  setup.hide();
  hud.show();
  view.setupGame(game(), s.config.players);
  view.cameraMode = s.config.cameraMode;
  view.stage.controls.enableRotate = s.config.cameraMode !== 'top';
  view.focusCamera(game().players[game().current].seat, 1.4);
  orientation = 'h';
  onTurnStart(true);
}

function onTurnStart(first = false) {
  const g = game();
  view.setTurn(g);
  hud.update(g, session.config);
  hud.setOrientation(orientation);
  setMode(null, { silent: true, instant: true });
  updateUndo();
  hud.turnBanner(`${nameOf(g.current)} 차례`, colorOf(g.current));
  if (!first) sfx.turn();
  if (g.skipped?.length) {
    hud.toast(`${g.skipped.map(nameOf).join(', ')}: 움직일 수 없어 차례를 건너뜁니다`, 'info');
  }
}

function refreshHints() {
  view.clearHints();
  if (!playing()) return;
  if (mode === 'move') {
    view.showMoveMarkers(legalPawnMoves(game()), game().current);
  } else if (mode === 'wall') {
    const w = pending ?? hoverWall;
    if (w) view.showGhost(w, checkWall(game(), w).ok);
  }
}

async function perform(action) {
  if (busy) return;
  const s = session;
  const prev = game();
  let next;
  try {
    next = session.play(action);
  } catch (err) {
    hud.toast(err.message);
    sfx.error();
    return;
  }
  busy = true;
  pending = null;
  hoverWall = null;
  hud.setBusy(true);
  hud.setConfirm(false);
  view.clearHints();
  view.dropSelection();
  view.stage.renderer.domElement.style.cursor = '';

  if (action.type === 'move') {
    const me = prev.players[prev.current];
    const jump = Math.abs(action.x - me.x) + Math.abs(action.y - me.y) > 1;
    await view.animateMove(prev.current, action, jump);
  } else {
    await view.animateWall(prev.current, action);
  }
  // 애니메이션 도중 메뉴에서 다시 시작/새 게임을 누른 경우: 옛 게임의 후속 처리를 하지 않음
  if (session !== s) return;

  busy = false;
  hud.setBusy(false);
  if (next.winner !== null) onWin(next.winner);
  else onTurnStart();
}

// ---------- 무르기 (설정에서 켰을 때만) ----------
function updateUndo() {
  const on = !!session?.config.allowUndo;
  hud.setUndo(on, on && session.canUndo());
  $('#btn-undo-toggle').textContent = `무르기: ${on ? '켬' : '끔 (공식 규칙)'}`;
}

async function undo() {
  if (busy || !session?.canUndo()) return;
  setMode(null, { silent: true, instant: true });
  const s = session;
  const a = session.undo();
  busy = true;
  hud.setBusy(true);
  view.clearHints();
  if (a.type === 'move') await view.undoMove(a.player, game().players[a.player]);
  else await view.undoWall(a.player);
  if (session !== s) return;
  busy = false;
  hud.setBusy(false);
  onTurnStart(true);
  hud.toast('한 수 물렀습니다', 'info');
}

async function onWin(pi) {
  const s = session;
  const g = game();
  hud.update(g, session.config);
  hud.setMode(null, 0);
  updateUndo();
  hud.setBusy(true);
  view.setTurn(g);
  sfx.win();
  $('#win-title').textContent = `${nameOf(pi)} 승리!`;
  $('#win-title').style.setProperty('--pc', colorOf(pi));
  $('#win-sub').textContent = `총 ${g.turn}수 · 남은 벽 ${g.players[pi].walls}개`;
  await view.celebrate(pi);
  if (session === s) overlay('#win', true);
}

// ---------- 선택 상태 ----------
function setMode(m, { silent = false, instant = false } = {}) {
  if (!session || game().winner !== null) return;
  const me = game().players[game().current];
  if (m === 'wall' && me.walls <= 0) {
    hud.toast('남은 벽이 없습니다');
    sfx.error();
    return;
  }
  mode = m;
  pending = null;
  hoverWall = null;
  view.setSelection(m === 'move' ? 'pawn' : m === 'wall' ? 'walls' : null, game().current, { instant });
  hud.setMode(mode, me.walls);
  hud.setConfirm(false);
  if (!silent) sfx.click();
  refreshHints();
}

function rotate() {
  if (!session || mode !== 'wall') return;
  orientation = orientation === 'h' ? 'v' : 'h';
  hud.setOrientation(orientation);
  if (pending) pending = { ...pending, o: orientation };
  if (hoverWall) hoverWall = { ...hoverWall, o: orientation };
  hud.setConfirm(!!pending && checkWall(game(), pending).ok);
  sfx.click();
  refreshHints();
}

const legalMoveAt = (p) => {
  if (!p) return null;
  const c = worldToCell(p.x, p.z);
  return legalPawnMoves(game()).find((m) => m.x === c.x && m.y === c.y) ?? null;
};

// 포인터 위치 → 해석 결과 (클릭과 마우스 올림이 같은 규칙을 사용)
function interpret(p, targets) {
  const moveAt = mode === 'move' ? legalMoveAt(p) : null;
  const anchor = p ? worldToAnchor(p.x, p.z) : null;
  const result = resolveTap({ mode, current: game().current, targets, moveAt, anchor });
  return { result, moveAt, anchor };
}

view.on('hover', (p, targets) => {
  if (!playing()) return;
  const { result, anchor } = interpret(p, targets);
  if (mode === 'move') view.setHoverCell(p ? worldToCell(p.x, p.z) : null);
  if (mode === 'wall' && !pending) {
    hoverWall = result.type === 'wall' ? { x: anchor.x, y: anchor.y, o: orientation } : null;
    refreshHints();
  }
  const pointer = ['move', 'wall', 'select'].includes(result.type);
  view.stage.renderer.domElement.style.cursor = pointer ? 'pointer' : '';
});

view.on('tap', (p, targets, pointerType) => {
  if (!playing()) return;
  sfx.unlock();
  const { result, moveAt, anchor } = interpret(p, targets);

  switch (result.type) {
    case 'move':
      perform({ type: 'move', x: moveAt.x, y: moveAt.y });
      return;
    case 'select':
      if (result.kind === 'pawn') setMode(mode === 'move' ? null : 'move');
      else setMode(mode === 'wall' ? null : 'wall');
      return;
    case 'notYourTurn':
      hud.toast(`지금은 ${nameOf(game().current)} 차례입니다`, 'info');
      sfx.error();
      return;
    case 'cancelPending':
      pending = null;
      hud.setConfirm(false);
      refreshHints();
      return;
    case 'deselect':
      setMode(null);
      return;
    case 'hint':
      hud.toast('버튼을 누르거나, 내 말 / 내 벽 보관대를 눌러 선택하세요', 'info');
      return;
  }

  // 벽 선택 중: 홈 위치를 눌러 벽 놓기
  {
    const wall = { x: anchor.x, y: anchor.y, o: orientation };
    const res = checkWall(game(), wall);
    if (pointerType !== 'mouse') {
      const same = pending && pending.x === wall.x && pending.y === wall.y && pending.o === wall.o;
      if (same && res.ok) {
        perform({ type: 'wall', ...wall });
        return;
      }
      pending = wall;
      hud.setConfirm(res.ok);
      if (!res.ok) {
        hud.toast(res.reason);
        sfx.error();
      } else sfx.click();
      refreshHints();
    } else if (res.ok) {
      perform({ type: 'wall', ...wall });
    } else {
      hud.toast(res.reason);
      sfx.error();
    }
  }
});

view.on('rotate', () => rotate());
view.on('land', (kind) => (kind === 'wall' ? sfx.wall() : sfx.pawn()));

// 모드 버튼: 화면에서 말/보관대를 누르는 것과 같은 선택 상태를 공유
$('#mode-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !playing()) return;
  setMode(b.dataset.mode === mode ? null : b.dataset.mode);
});
$('#btn-undo').addEventListener('click', undo);
$('#btn-undo-toggle').addEventListener('click', () => {
  if (!session) return;
  session.config.allowUndo = !session.config.allowUndo;
  session.save();
  updateUndo();
  hud.toast(session.config.allowUndo ? '무르기를 켰습니다' : '무르기를 껐습니다 (공식 규칙)', 'info');
});
$('#btn-rotate').addEventListener('click', rotate);
$('#btn-confirm').addEventListener('click', () => {
  if (pending && !busy) perform({ type: 'wall', ...pending });
});
// 버튼 포커스가 남아 스페이스/엔터로 다시 눌리는 것 방지
document.addEventListener('click', (e) => e.target.closest?.('button')?.blur());

window.addEventListener('keydown', (e) => {
  if (!session || e.target.tagName === 'INPUT') return;
  if ($('#setup').classList.contains('show')) return;
  if (e.key === 'r' || e.key === 'R') rotate();
  else if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (playing()) setMode(mode === 'move' ? 'wall' : 'move');
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key === 'Escape') {
    if (mode && playing()) setMode(null);
    else toggleMenu();
  } else if (e.key === 'Enter' && pending && !busy) {
    perform({ type: 'wall', ...pending });
  }
});

// ---------- 상단 버튼 / 메뉴 ----------
const updateSoundBtn = () => ($('#btn-sound').textContent = isMuted() ? '🔇' : '🔊');
updateSoundBtn();
$('#btn-sound').addEventListener('click', () => {
  setMuted(!isMuted());
  updateSoundBtn();
  sfx.click();
});

$('#btn-camera').addEventListener('click', () => {
  if (!session) return;
  const next = view.cameraMode === 'auto' ? 'top' : 'auto';
  session.config.cameraMode = next;
  session.save();
  view.setCameraMode(next);
  if (next === 'auto') view.focusCamera(game().players[game().current].seat);
  hud.toast(next === 'top' ? '카메라: 위에서 고정' : '카메라: 차례마다 회전', 'info');
});

$('#btn-fullscreen').addEventListener('click', () => {
  const d = document;
  if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {});
  else d.exitFullscreen?.();
});

function toggleMenu(force) {
  const show = force ?? !$('#menu').classList.contains('show');
  overlay('#menu', show);
}
$('#btn-menu').addEventListener('click', () => toggleMenu(true));
$('#menu').addEventListener('click', (e) => {
  if (e.target.id === 'menu') toggleMenu(false);
});
$('#btn-continue').addEventListener('click', () => toggleMenu(false));
$('#btn-restart').addEventListener('click', () => {
  toggleMenu(false);
  startSession(new GameSession({ ...session.config }));
});
$('#btn-new').addEventListener('click', () => {
  toggleMenu(false);
  goToSetup();
});
$('#btn-rules').addEventListener('click', () => {
  toggleMenu(false);
  overlay('#rules', true);
});

const QUALITY_KEY = 'kuorido3d.quality';
let highQuality = true;
try {
  highQuality = localStorage.getItem(QUALITY_KEY) !== 'low';
} catch {
  /* 무시 */
}
const applyQuality = () => {
  view.stage.setQuality(highQuality);
  $('#btn-quality').textContent = `그래픽 품질: ${highQuality ? '높음' : '낮음 (태블릿 절전)'}`;
};
applyQuality();
$('#btn-quality').addEventListener('click', () => {
  highQuality = !highQuality;
  try {
    localStorage.setItem(QUALITY_KEY, highQuality ? 'high' : 'low');
  } catch {
    /* 무시 */
  }
  applyQuality();
});

$('#btn-rules-close').addEventListener('click', () => overlay('#rules', false));
$('#rules').addEventListener('click', (e) => {
  if (e.target.id === 'rules') overlay('#rules', false);
});

$('#btn-win-again').addEventListener('click', () => {
  const cfg = { ...session.config, firstPlayer: (session.config.firstPlayer + 1) % session.config.numPlayers };
  startSession(new GameSession(cfg));
});
$('#btn-win-new').addEventListener('click', goToSetup);
$('#btn-win-view').addEventListener('click', () => overlay('#win', false));

// ---------- 시작 화면 ----------
function goToSetup() {
  session = null;
  overlay('#win', false);
  hud.hide();
  view.startAttract();
  setup.show();
}

const setup = initSetup({
  onStart: (config) => {
    sfx.unlock();
    GameSession.clearSave();
    startSession(new GameSession(config));
  },
  onResume: () => {
    sfx.unlock();
    const s = GameSession.load();
    if (s) startSession(s);
    else hud.toast('저장된 게임을 불러올 수 없습니다');
  },
  onRules: () => overlay('#rules', true),
  hasSave: () => GameSession.hasSave(),
});

overlay('#loading', false);
goToSetup();

if (import.meta.env.DEV) window.__q = { view, perform, setMode, undo, get session() { return session; } };
