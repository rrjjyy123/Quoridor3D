// 게임 중 HUD: 플레이어 카드, 행동 바, 배너, 토스트
import { colorById } from '../render/pieces.js';
import { shortestPathLength } from '../game/rules.js';

const $ = (s) => document.querySelector(s);

export class Hud {
  constructor() {
    this.bar = $('#players-bar');
    this.banner = $('#turn-banner');
    this.toastEl = $('#toast');
    this.actionBar = $('#action-bar');
  }

  show() {
    $('#hud').hidden = false;
  }
  hide() {
    $('#hud').hidden = true;
  }

  update(game, config) {
    const wallsEach = 20 / game.numPlayers;
    this.bar.innerHTML = '';
    game.players.forEach((p, i) => {
      const cfg = config.players[i];
      const card = document.createElement('div');
      card.className = 'pcard' + (i === game.current && game.winner === null ? ' current' : '');
      card.style.setProperty('--pc', colorById(cfg.color).hex);
      const pips = Array.from({ length: wallsEach }, (_, k) => `<i class="${k < p.walls ? '' : 'used'}"></i>`).join('');
      const dist = shortestPathLength(game, i);
      card.innerHTML = `
        <div class="dot"></div>
        <div class="info">
          <div class="name"></div>
          <div class="meta"><span class="pips" title="남은 벽 ${p.walls}개">${pips}</span><span>🏁 ${dist}칸</span></div>
        </div>`;
      card.querySelector('.name').textContent = cfg.name;
      this.bar.appendChild(card);
    });
  }

  // 선택 상태에 따라 안내 문구와 방향 버튼 표시
  setMode(mode, wallsLeft) {
    const hint = $('#action-hint');
    if (mode === 'move') hint.innerHTML = '<b>♟ 말 이동</b> 빛나는 칸을 누르세요';
    else if (mode === 'wall') hint.innerHTML = `<b>▮ 벽 놓기</b> 칸 사이 홈을 누르세요 <em>남은 벽 ${wallsLeft}</em>`;
    else
      hint.innerHTML =
        wallsLeft > 0
          ? '<b>내 말</b>을 누르면 이동 · <b>내 벽 보관대</b>를 누르면 벽 놓기'
          : '<b>내 말</b>을 눌러 이동하세요 <em>남은 벽 없음</em>';
    $('#btn-rotate').hidden = mode !== 'wall';
  }

  setOrientation(o) {
    $('#btn-rotate').classList.toggle('vertical', o === 'v');
  }

  setConfirm(visible) {
    $('#btn-confirm').hidden = !visible;
  }

  setBusy(busy) {
    this.actionBar.classList.toggle('disabled', busy);
  }

  turnBanner(text, color) {
    const b = this.banner;
    b.textContent = text;
    b.style.setProperty('--pc', color);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  toast(text, kind = 'error') {
    const t = this.toastEl;
    t.textContent = text;
    t.className = kind === 'info' ? 'info show' : 'show';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
}
