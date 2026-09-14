// 보드 좌표 ↔ 3D 월드 좌표 변환
export const CELL = 1; // 칸 한 변
export const GROOVE = 0.24; // 홈 폭
export const PITCH = CELL + GROOVE;
export const BOARD_TOP = 0.5; // 칸 윗면 높이
export const WALL_LEN = CELL * 2 + GROOVE;
export const WALL_THICK = GROOVE * 0.78;
export const WALL_HEIGHT = 0.62;
export const INNER = 9 * CELL + 8 * GROOVE; // 칸 영역 한 변
export const FRAME = 3.4; // 칸 영역 바깥 테두리 폭 (벽 보관대)
export const BOARD_SIZE = INNER + FRAME * 2;

// 월드 좌표: 1행(y=0)이 +z(앞), a열(x=0)이 -x(왼쪽)
export const cellToWorld = (x, y) => ({ x: (x - 4) * PITCH, z: (4 - y) * PITCH });

export const wallToWorld = (w) => ({
  x: (w.x - 3.5) * PITCH,
  z: (3.5 - w.y) * PITCH,
  rotY: w.o === 'h' ? 0 : Math.PI / 2,
});

// 좌석별 방위각 (카메라가 플레이어 뒤에서 보도록). 0=아래(+z), 1=왼쪽(-x), 2=위(-z), 3=오른쪽(+x)
export const SEAT_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

// 월드 좌표 → 가장 가까운 칸 / 벽 교차점
export function worldToCell(px, pz) {
  const x = Math.round(px / PITCH + 4);
  const y = Math.round(4 - pz / PITCH);
  return { x, y, inside: x >= 0 && x < 9 && y >= 0 && y < 9 };
}

export function worldToAnchor(px, pz) {
  const fx = px / PITCH + 3.5;
  const fy = 3.5 - pz / PITCH;
  const x = Math.max(0, Math.min(7, Math.round(fx)));
  const y = Math.max(0, Math.min(7, Math.round(fy)));
  const half = INNER / 2 + GROOVE;
  return { x, y, inside: Math.abs(px) < half && Math.abs(pz) < half };
}
