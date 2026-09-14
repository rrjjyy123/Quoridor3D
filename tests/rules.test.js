import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyAction,
  legalPawnMoves,
  checkWall,
  shortestPathLength,
  actionName,
} from '../src/game/rules.js';

const cells = (moves) => moves.map((m) => `${m.x},${m.y}`).sort();

function withPawns(g, positions) {
  positions.forEach(([x, y], i) => Object.assign(g.players[i], { x, y }));
  return g;
}

describe('초기 설정', () => {
  it('2인: e1/e9, 벽 10개씩', () => {
    const g = createGame(2);
    expect(g.players.map((p) => [p.x, p.y, p.walls])).toEqual([
      [4, 0, 10],
      [4, 8, 10],
    ]);
  });
  it('4인: e1/a5/e9/i5, 벽 5개씩', () => {
    const g = createGame(4);
    expect(g.players.map((p) => [p.x, p.y, p.walls])).toEqual([
      [4, 0, 5],
      [0, 4, 5],
      [4, 8, 5],
      [8, 4, 5],
    ]);
  });
  it('3인은 지원하지 않음', () => {
    expect(() => createGame(3)).toThrow();
  });
});

describe('말 이동', () => {
  it('시작 위치에서 3방향', () => {
    expect(cells(legalPawnMoves(createGame(2)))).toEqual(['3,0', '4,1', '5,0']);
  });

  it('벽 너머로는 이동 불가', () => {
    const g = createGame(2);
    g.walls.push({ x: 4, y: 0, o: 'h' }); // e1-f1 위쪽 가로벽
    expect(cells(legalPawnMoves(g))).toEqual(['3,0', '5,0']);
    g.walls.push({ x: 3, y: 0, o: 'v' }); // d1|e1 사이 세로벽
    expect(cells(legalPawnMoves(g))).toEqual(['5,0']);
  });

  it('마주보면 곧게 점프', () => {
    const g = withPawns(createGame(2), [
      [4, 4],
      [4, 5],
    ]);
    expect(cells(legalPawnMoves(g))).toEqual(['3,4', '4,3', '4,6', '5,4']);
  });

  it('뒤에 벽이 있으면 대각선 점프', () => {
    const g = withPawns(createGame(2), [
      [4, 4],
      [4, 5],
    ]);
    g.walls.push({ x: 4, y: 5, o: 'h' }); // 상대 말 뒤
    expect(cells(legalPawnMoves(g))).toEqual(['3,4', '3,5', '4,3', '5,4', '5,5']);
  });

  it('상대가 보드 끝이면 대각선 점프', () => {
    const g = withPawns(createGame(2), [
      [4, 7],
      [4, 8],
    ]);
    expect(cells(legalPawnMoves(g))).toEqual(['3,7', '3,8', '4,6', '5,7', '5,8']);
  });

  it('대각선 한쪽이 벽으로 막힘', () => {
    const g = withPawns(createGame(2), [
      [4, 4],
      [4, 5],
    ]);
    g.walls.push({ x: 4, y: 5, o: 'h' });
    g.walls.push({ x: 4, y: 5, o: 'v' }); // 교차 배치지만 테스트용으로 직접 삽입
    g.walls.pop();
    g.walls.push({ x: 4, y: 4, o: 'v' }); // e6|f6 사이
    expect(cells(legalPawnMoves(g))).toEqual(['3,4', '3,5', '4,3']);
  });

  it('4인: 말 두 개 연속은 넘지 못함 → 대각선', () => {
    const g = withPawns(createGame(4), [
      [4, 4],
      [4, 5],
      [4, 6],
      [8, 0],
    ]);
    expect(cells(legalPawnMoves(g))).toEqual(['3,4', '3,5', '4,3', '5,4', '5,5']);
  });

  it('도착하면 승리', () => {
    let g = withPawns(createGame(2), [
      [0, 7],
      [8, 8],
    ]);
    g = applyAction(g, { type: 'move', x: 0, y: 8 });
    expect(g.winner).toBe(0);
    expect(() => applyAction(g, { type: 'move', x: 8, y: 7 })).toThrow();
  });

  it('불법 이동은 에러', () => {
    expect(() => applyAction(createGame(2), { type: 'move', x: 4, y: 2 })).toThrow();
  });
});

describe('벽 설치', () => {
  it('설치하면 벽 수 감소, 차례 넘김', () => {
    const g = applyAction(createGame(2), { type: 'wall', x: 3, y: 3, o: 'h' });
    expect(g.players[0].walls).toBe(9);
    expect(g.current).toBe(1);
    expect(g.walls).toHaveLength(1);
  });

  it('겹침/교차 금지, 반칸 어긋나면 겹침', () => {
    const g = applyAction(createGame(2), { type: 'wall', x: 3, y: 3, o: 'h' });
    expect(checkWall(g, { x: 3, y: 3, o: 'h' }).ok).toBe(false);
    expect(checkWall(g, { x: 3, y: 3, o: 'v' }).ok).toBe(false);
    expect(checkWall(g, { x: 2, y: 3, o: 'h' }).ok).toBe(false);
    expect(checkWall(g, { x: 4, y: 3, o: 'h' }).ok).toBe(false);
    expect(checkWall(g, { x: 5, y: 3, o: 'h' }).ok).toBe(true);
    expect(checkWall(g, { x: 3, y: 4, o: 'v' }).ok).toBe(true);
    expect(checkWall(g, { x: 3, y: 2, o: 'v' }).ok).toBe(true);
  });

  it('범위 밖 금지', () => {
    const g = createGame(2);
    expect(checkWall(g, { x: 8, y: 0, o: 'h' }).ok).toBe(false);
    expect(checkWall(g, { x: -1, y: 0, o: 'v' }).ok).toBe(false);
  });

  it('경로를 완전히 막는 벽 금지', () => {
    const g = createGame(2);
    // 1행과 2행 사이를 a~h 까지 막음 (x=0,2,4,6)
    for (const x of [0, 2, 4, 6]) g.walls.push({ x, y: 0, o: 'h' });
    expect(shortestPathLength(g, 0)).toBeGreaterThan(0);
    // i열 쪽 남은 틈: i1 → i2 → (h2 또는 i3)
    g.walls.push({ x: 7, y: 0, o: 'v' }); // i2 에서 왼쪽 막힘
    expect(checkWall(g, { x: 7, y: 1, o: 'h' }).ok).toBe(false); // i2 위까지 막으면 완전 차단
    g.walls.pop();
    expect(checkWall(g, { x: 7, y: 1, o: 'h' }).ok).toBe(true); // 왼쪽이 열려 있으면 허용
    expect(checkWall(g, { x: 7, y: 0, o: 'h' }).ok).toBe(false); // (6,0)h 와 겹침
  });

  it('경로 차단 판정', () => {
    const g = createGame(2);
    for (const x of [0, 2, 4, 6]) g.walls.push({ x, y: 0, o: 'h' });
    g.walls.push({ x: 7, y: 1, o: 'h' }); // h2-i2 위
    // i1→i2 로만 남은 길. i2 에서 왼쪽(h2)으로 나가는 길을 막으면?
    // (7,0)v: h1|i1, h2|i2 사이 → i2 에서 갈 곳 없음 → 전체 차단
    const res = checkWall(g, { x: 7, y: 0, o: 'v' });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/길/);
  });

  it('벽이 없으면 설치 불가', () => {
    const g = createGame(2);
    g.players[0].walls = 0;
    expect(checkWall(g, { x: 0, y: 0, o: 'h' }).ok).toBe(false);
  });
});

describe('표기법', () => {
  it('칸과 벽', () => {
    expect(actionName({ type: 'move', x: 4, y: 1 })).toBe('e2');
    expect(actionName({ type: 'wall', x: 0, y: 7, o: 'v' })).toBe('a8v');
  });
});
