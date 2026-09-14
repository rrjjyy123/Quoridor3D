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

  // 선택 상태 표시: 모드 버튼, 안내 문구, 방향 버튼 (화면 직접 선택과 연동)
  setMode(mode, wallsLeft) {
    $('#mode-seg')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('#mode-seg').querySelector('[data-mode="wall"]').disabled = wallsLeft <= 0;
    $('#walls-left').textContent = wallsLeft;
    const hint = $('#action-hint');
    if (mode === 'move') hint.innerHTML = '<b>♟ 말 이동</b> 빛나는 칸을 누르세요';
    else if (mode === 'wall') hint.innerHTML = '<b>▮ 벽 놓기</b> 칸 사이 홈을 누르세요';
    else
      hint.innerHTML =
        wallsLeft > 0
          ? '버튼 또는 <b>내 말</b> · <b>내 벽 보관대</b>를 눌러 선택하세요'
          : '버튼 또는 <b>내 말</b>을 눌러 이동하세요 (남은 벽 없음)';
    $('#btn-rotate').hidden = mode !== 'wall';
  }

  setUndo(visible, enabled) {
    $('#btn-undo').hidden = !visible;
    $('#btn-undo').disabled = !enabled;
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
