// 시작 화면: 인원, 이름, 색, 선공, 카메라 모드
import { PAWN_COLORS } from '../render/pieces.js';

const PREF_KEY = 'kuorido3d.setup.v1';
const SEAT_NAMES = {
  2: ['아래', '위'],
  4: ['아래', '왼쪽', '위', '오른쪽'],
};
const DEFAULT_COLORS = {
  2: ['ivory', 'ebony'],
  4: ['ivory', 'crimson', 'ebony', 'teal'],
};

const $ = (s) => document.querySelector(s);

export function initSetup({ onStart, onResume, onRules, hasSave }) {
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  } catch {
    prefs = {};
  }
  let count = prefs.count === 4 ? 4 : 2;
  let cameraMode = prefs.cameraMode === 'top' ? 'top' : 'auto';
  let allowUndo = prefs.allowUndo === true;
  const players = {
    2: prefs.players2 ?? DEFAULT_COLORS[2].map((c, i) => ({ name: `플레이어 ${i + 1}`, color: c })),
    4: prefs.players4 ?? DEFAULT_COLORS[4].map((c, i) => ({ name: `플레이어 ${i + 1}`, color: c })),
  };

  const rows = $('#player-rows');
  const first = $('#first-player');

  function renderRows() {
    rows.innerHTML = '';
    players[count].forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.style.animationDelay = `${i * 0.05}s`;
      row.innerHTML = `
        <div class="seat"><b>P${i + 1}</b>${SEAT_NAMES[count][i]}</div>
        <input type="text" maxlength="12" value="" />
        <div class="swatches"></div>`;
      const input = row.querySelector('input');
      input.value = p.name;
      input.addEventListener('input', () => {
        p.name = input.value;
        renderFirst();
      });
      const sw = row.querySelector('.swatches');
      for (const c of PAWN_COLORS) {
        const b = document.createElement('button');
        b.className = 'swatch' + (p.color === c.id ? ' active' : '');
        b.style.background = c.hex;
        b.title = c.name;
        b.addEventListener('click', () => {
          // 다른 플레이어가 쓰는 색이면 서로 교환
          const other = players[count].find((q) => q !== p && q.color === c.id);
          if (other) other.color = p.color;
          p.color = c.id;
          renderRows();
        });
        sw.appendChild(b);
      }
      rows.appendChild(row);
    });
    renderFirst();
  }

  function renderFirst() {
    const prev = first.value;
    first.innerHTML = '<option value="random">🎲 무작위</option>';
    players[count].forEach((p, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = p.name.trim() || `플레이어 ${i + 1}`;
      first.appendChild(o);
    });
    first.value = [...first.options].some((o) => o.value === prev) ? prev : 'random';
  }

  $('#player-count').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    count = Number(b.dataset.n);
    $('#player-count').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    renderRows();
  });

  $('#camera-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    cameraMode = b.dataset.mode;
    $('#camera-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  $('#undo-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    allowUndo = b.dataset.undo === 'on';
    $('#undo-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  $('#undo-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('active', (x.dataset.undo === 'on') === allowUndo));
  $('#player-count').querySelectorAll('button').forEach((x) => x.classList.toggle('active', Number(x.dataset.n) === count));
  $('#camera-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.mode === cameraMode));

  $('#btn-start').addEventListener('click', () => {
    const list = players[count].map((p, i) => ({ name: p.name.trim() || `플레이어 ${i + 1}`, color: p.color }));
    const firstPlayer = first.value === 'random' ? Math.floor(Math.random() * count) : Number(first.value);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ count, cameraMode, allowUndo, players2: players[2], players4: players[4] }));
    } catch {
      /* 무시 */
    }
    onStart({ numPlayers: count, firstPlayer, players: list, cameraMode, allowUndo });
  });

  $('#btn-resume').addEventListener('click', onResume);
  $('#btn-rules-open').addEventListener('click', onRules);

  renderRows();

  return {
    show() {
      $('#btn-resume').hidden = !hasSave();
      $('#setup').classList.add('show');
    },
    hide() {
      $('#setup').classList.remove('show');
    },
  };
}
