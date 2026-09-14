// 쿼리도 규칙 (Gigamic 공식 규칙 기준) — 렌더링과 무관한 순수 로직
//
// 좌표계: 칸 (x, y), x = 0..8 (a..i 열), y = 0..8 (1..9 행)
// 벽: { x, y, o }, x/y = 0..7 은 칸 사이 교차점, o = 'h' | 'v'
//   'h' (가로벽): y행과 y+1행 사이, x열과 x+1열에 걸침
//   'v' (세로벽): x열과 x+1열 사이, y행과 y+1행에 걸침

export const SIZE = 9;
export const WALL_GRID = SIZE - 1;
export const WALLS_TOTAL = 20;

const DIRS = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

// 시작 위치와 목표. 4인은 시계방향(아래 → 왼쪽 → 위 → 오른쪽)
const SEATS_2 = [
  { x: 4, y: 0, goal: { axis: 'y', value: 8 }, seat: 0 },
  { x: 4, y: 8, goal: { axis: 'y', value: 0 }, seat: 2 },
];
const SEATS_4 = [
  { x: 4, y: 0, goal: { axis: 'y', value: 8 }, seat: 0 },
  { x: 0, y: 4, goal: { axis: 'x', value: 8 }, seat: 1 },
  { x: 4, y: 8, goal: { axis: 'y', value: 0 }, seat: 2 },
  { x: 8, y: 4, goal: { axis: 'x', value: 0 }, seat: 3 },
];

export function createGame(numPlayers = 2, firstPlayer = 0) {
  if (numPlayers !== 2 && numPlayers !== 4) throw new Error('인원은 2명 또는 4명입니다');
  const seats = numPlayers === 2 ? SEATS_2 : SEATS_4;
  const wallsEach = WALLS_TOTAL / numPlayers;
  return {
    numPlayers,
    players: seats.map((s) => ({ x: s.x, y: s.y, goal: { ...s.goal }, seat: s.seat, walls: wallsEach })),
    walls: [],
    current: firstPlayer,
    winner: null,
    turn: 0,
  };
}

export function cloneGame(g) {
  return {
    ...g,
    players: g.players.map((p) => ({ ...p, goal: { ...p.goal } })),
    walls: g.walls.map((w) => ({ ...w })),
  };
}

const wallKey = (x, y, o) => `${o}${x},${y}`;

function wallSet(g) {
  const s = new Set();
  for (const w of g.walls) s.add(wallKey(w.x, w.y, w.o));
  return s;
}

const inBoard = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

// 인접한 두 칸 사이가 벽으로 막혀 있는지
function blockedBy(ws, ax, ay, bx, by) {
  if (ax === bx) {
    const y = Math.min(ay, by);
    return ws.has(wallKey(ax, y, 'h')) || ws.has(wallKey(ax - 1, y, 'h'));
  }
  const x = Math.min(ax, bx);
  return ws.has(wallKey(x, ay, 'v')) || ws.has(wallKey(x, ay - 1, 'v'));
}

export function isBlocked(g, ax, ay, bx, by) {
  return blockedBy(wallSet(g), ax, ay, bx, by);
}

export function isAtGoal(p) {
  return p.goal.axis === 'y' ? p.y === p.goal.value : p.x === p.goal.value;
}

// 현재 말이 갈 수 있는 칸 목록
export function legalPawnMoves(g, pi = g.current, ws = wallSet(g)) {
  const me = g.players[pi];
  const occupied = (x, y) => g.players.some((p, i) => i !== pi && p.x === x && p.y === y);
  const result = [];
  const add = (x, y, jump) => {
    if (!result.some((m) => m.x === x && m.y === y)) result.push({ x, y, jump });
  };

  for (const [dx, dy] of DIRS) {
    const nx = me.x + dx;
    const ny = me.y + dy;
    if (!inBoard(nx, ny) || blockedBy(ws, me.x, me.y, nx, ny)) continue;
    if (!occupied(nx, ny)) {
      add(nx, ny, false);
      continue;
    }
    // 인접한 말이 있음 → 곧게 점프
    const jx = nx + dx;
    const jy = ny + dy;
    if (inBoard(jx, jy) && !blockedBy(ws, nx, ny, jx, jy) && !occupied(jx, jy)) {
      add(jx, jy, true);
      continue;
    }
    // 뒤가 막힘 → 그 말의 좌/우 대각선 (말 2개 이상은 넘을 수 없음)
    for (const [px, py] of [
      [dy, dx],
      [-dy, -dx],
    ]) {
      const sx = nx + px;
      const sy = ny + py;
      if (inBoard(sx, sy) && !blockedBy(ws, nx, ny, sx, sy) && !occupied(sx, sy)) add(sx, sy, true);
    }
  }
  return result;
}

// 벽이 서로 겹치거나 교차하는지 (경로 검사 제외)
export function wallFits(g, w, ws = wallSet(g)) {
  const { x, y, o } = w;
  if (o !== 'h' && o !== 'v') return false;
  if (x < 0 || x >= WALL_GRID || y < 0 || y >= WALL_GRID) return false;
  if (ws.has(wallKey(x, y, 'h')) || ws.has(wallKey(x, y, 'v'))) return false; // 같은 자리 or 교차
  if (o === 'h') return !ws.has(wallKey(x - 1, y, 'h')) && !ws.has(wallKey(x + 1, y, 'h'));
  return !ws.has(wallKey(x, y - 1, 'v')) && !ws.has(wallKey(x, y + 1, 'v'));
}

// 목표 변까지 최단 거리 (말은 장애물로 보지 않음). 경로 없으면 -1
export function shortestPathLength(g, pi, ws = wallSet(g)) {
  const p = g.players[pi];
  if (isAtGoal(p)) return 0;
  const dist = new Int8Array(SIZE * SIZE).fill(-1);
  const queue = [p.x + p.y * SIZE];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const x = idx % SIZE;
    const y = (idx - x) / SIZE;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBoard(nx, ny)) continue;
      const ni = nx + ny * SIZE;
      if (dist[ni] !== -1 || blockedBy(ws, x, y, nx, ny)) continue;
      dist[ni] = dist[idx] + 1;
      if ((p.goal.axis === 'y' ? ny : nx) === p.goal.value) return dist[ni];
      queue.push(ni);
    }
  }
  return -1;
}

// 벽 설치 가능 여부. { ok, reason }
export function checkWall(g, w, pi = g.current) {
  if (g.winner !== null) return { ok: false, reason: '게임이 끝났습니다' };
  if (g.players[pi].walls <= 0) return { ok: false, reason: '남은 벽이 없습니다' };
  const ws = wallSet(g);
  if (!wallFits(g, w, ws)) return { ok: false, reason: '다른 벽과 겹치거나 교차합니다' };
  ws.add(wallKey(w.x, w.y, w.o));
  for (let i = 0; i < g.players.length; i++) {
    if (shortestPathLength(g, i, ws) < 0) return { ok: false, reason: '누군가의 모든 길을 막을 수 없습니다' };
  }
  return { ok: true };
}

export function canPlaceWall(g, w, pi) {
  return checkWall(g, w, pi).ok;
}

function hasAnyLegalWall(g, pi) {
  if (g.players[pi].walls <= 0) return false;
  for (let x = 0; x < WALL_GRID; x++)
    for (let y = 0; y < WALL_GRID; y++)
      for (const o of ['h', 'v']) if (checkWall(g, { x, y, o }, pi).ok) return true;
  return false;
}

export function canAct(g, pi) {
  return legalPawnMoves(g, pi).length > 0 || hasAnyLegalWall(g, pi);
}

// 행동 적용 → 새 게임 상태. 불법이면 에러
// action: { type: 'move', x, y } | { type: 'wall', x, y, o }
export function applyAction(g, action) {
  if (g.winner !== null) throw new Error('게임이 끝났습니다');
  const n = cloneGame(g);
  const me = n.players[n.current];
  if (action.type === 'move') {
    const ok = legalPawnMoves(g).some((m) => m.x === action.x && m.y === action.y);
    if (!ok) throw new Error('갈 수 없는 칸입니다');
    me.x = action.x;
    me.y = action.y;
    if (isAtGoal(me)) n.winner = n.current;
  } else if (action.type === 'wall') {
    const res = checkWall(g, action);
    if (!res.ok) throw new Error(res.reason);
    n.walls.push({ x: action.x, y: action.y, o: action.o, owner: n.current });
    me.walls -= 1;
  } else {
    throw new Error('알 수 없는 행동');
  }
  n.turn += 1;
  n.skipped = [];
  if (n.winner === null) {
    // 다음 차례. 아무 행동도 할 수 없는 플레이어는 건너뜀
    for (let k = 0; k < n.numPlayers; k++) {
      n.current = (n.current + 1) % n.numPlayers;
      if (canAct(n, n.current)) break;
      n.skipped.push(n.current);
    }
  }
  return n;
}

// 표기법: 칸 'e2', 벽 'e3h' (교차점 왼쪽-아래 칸 기준)
const FILES = 'abcdefghi';
export const cellName = (x, y) => `${FILES[x]}${y + 1}`;
export function actionName(a) {
  return a.type === 'move' ? cellName(a.x, a.y) : `${cellName(a.x, a.y)}${a.o}`;
}
