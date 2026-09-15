// 탭/클릭 해석 — 렌더링과 분리된 순수 함수 (테스트 가능)
//
// ctx:
//   mode     : null | 'move' | 'wall'
//   current  : 현재 플레이어 번호
//   targets  : 광선에 맞은 말/벽 보관대 목록 (가까운 순) [{ kind: 'pawn'|'walls', player, precise }]
//              precise = 투명 판정 영역이 아니라 실제 말 모양에 맞았는지
//   moveAt   : 누른 칸이 이동 가능한 칸이면 그 이동, 아니면 null
//   anchor   : 누른 지점의 벽 교차점 { x, y, inside } | null
//
// 반환: { type: 'move' } | { type: 'wall' } | { type: 'select', kind }
//      | { type: 'notYourTurn' } | { type: 'cancelPending' } | { type: 'hint' } | { type: 'deselect' }
export function resolveTap({ mode, current, targets = [], moveAt = null, anchor = null }) {
  const own = targets.find((t) => t.player === current);
  const other = targets.find((t) => t.player !== current);
  const onBoard = !!anchor?.inside;

  // 1) 말 선택 중: 빛나는 칸이 우선 (말 판정 영역에 가려져도)
  if (mode === 'move' && moveAt && !(own?.kind === 'walls')) return { type: 'move' };

  // 2) 벽 선택 중 보드 위를 누름: 벽 설치가 우선.
  //    판정 영역은 홈을 가리므로 무시하고, 내 말 "실제 모양"을 누른 경우만 말 선택으로 전환
  if (mode === 'wall' && onBoard) {
    if (own?.kind === 'pawn' && own.precise) return { type: 'select', kind: 'pawn' };
    return { type: 'wall' };
  }

  // 3) 내 말 / 내 벽 보관대
  if (own) return { type: 'select', kind: own.kind };

  // 4) 다른 플레이어의 말 / 보관대
  if (other) return { type: 'notYourTurn' };

  if (mode === 'wall') return { type: 'cancelPending' };
  if (mode === 'move') return { type: 'deselect' };
  return { type: 'hint' };
}
