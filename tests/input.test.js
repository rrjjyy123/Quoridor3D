import { describe, it, expect } from 'vitest';
import { resolveTap } from '../src/game/input.js';

const inside = { x: 3, y: 5, inside: true };
const outside = { x: 7, y: 7, inside: false };
const otherPawnProxy = { kind: 'pawn', player: 1, precise: false };
const otherPawnReal = { kind: 'pawn', player: 1, precise: true };
const myPawnProxy = { kind: 'pawn', player: 0, precise: false };
const myPawnReal = { kind: 'pawn', player: 0, precise: true };
const myTray = { kind: 'walls', player: 0 };
const otherTray = { kind: 'walls', player: 1 };

describe('탭 해석', () => {
  it('버그 재현: 벽 모드에서 상대 말 근처 홈을 누르면 벽 설치 (차례 안내 X)', () => {
    expect(resolveTap({ mode: 'wall', current: 0, targets: [otherPawnProxy], anchor: inside })).toEqual({ type: 'wall' });
    expect(resolveTap({ mode: 'wall', current: 0, targets: [otherPawnReal], anchor: inside })).toEqual({ type: 'wall' });
  });

  it('벽 모드에서 먼 쪽 보관대 판정 영역에 가려진 홈도 벽 설치', () => {
    expect(resolveTap({ mode: 'wall', current: 0, targets: [otherTray], anchor: inside })).toEqual({ type: 'wall' });
  });

  it('벽 모드에서 내 말 주변 홈은 벽 설치, 내 말 실제 모양은 말 선택', () => {
    expect(resolveTap({ mode: 'wall', current: 0, targets: [myPawnProxy], anchor: inside })).toEqual({ type: 'wall' });
    expect(resolveTap({ mode: 'wall', current: 0, targets: [myPawnReal], anchor: inside })).toEqual({
      type: 'select',
      kind: 'pawn',
    });
  });

  it('벽 모드에서 보드 밖 내 보관대를 누르면 선택 해제(토글)용 select', () => {
    expect(resolveTap({ mode: 'wall', current: 0, targets: [myTray], anchor: outside })).toEqual({
      type: 'select',
      kind: 'walls',
    });
  });

  it('이동 모드: 이동 가능한 칸이 말 판정 영역보다 우선', () => {
    const moveAt = { x: 4, y: 1 };
    expect(resolveTap({ mode: 'move', current: 0, targets: [otherPawnProxy], moveAt, anchor: inside })).toEqual({
      type: 'move',
    });
    expect(resolveTap({ mode: 'move', current: 0, targets: [myPawnProxy], moveAt, anchor: inside })).toEqual({
      type: 'move',
    });
  });

  it('선택 전: 내 말/보관대 선택, 상대 것은 차례 안내', () => {
    expect(resolveTap({ mode: null, current: 0, targets: [myPawnProxy], anchor: inside })).toEqual({
      type: 'select',
      kind: 'pawn',
    });
    expect(resolveTap({ mode: null, current: 0, targets: [myTray], anchor: outside })).toEqual({
      type: 'select',
      kind: 'walls',
    });
    expect(resolveTap({ mode: null, current: 0, targets: [otherPawnReal], anchor: inside })).toEqual({
      type: 'notYourTurn',
    });
    expect(resolveTap({ mode: null, current: 0, targets: [], anchor: inside })).toEqual({ type: 'hint' });
  });

  it('상대 말 뒤에 내 말이 겹쳐 맞아도 내 것이 우선', () => {
    expect(resolveTap({ mode: null, current: 0, targets: [otherPawnProxy, myPawnReal], anchor: inside })).toEqual({
      type: 'select',
      kind: 'pawn',
    });
  });

  it('빈 곳: 이동 모드는 선택 해제, 벽 모드 보드 밖은 미리보기 취소', () => {
    expect(resolveTap({ mode: 'move', current: 0, targets: [], anchor: inside })).toEqual({ type: 'deselect' });
    expect(resolveTap({ mode: 'wall', current: 0, targets: [], anchor: outside })).toEqual({ type: 'cancelPending' });
  });
});
