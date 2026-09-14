// 게임 진행 관리: 행동 기록, 자동 저장 (공식 규칙에 무르기 없음)
import { createGame, applyAction } from './rules.js';

const SAVE_KEY = 'kuorido3d.save.v1';

export class GameSession {
  constructor(config) {
    // config: { numPlayers, firstPlayer, players: [{ name, color }], cameraMode }
    this.config = config;
    this.actions = [];
    this.states = [createGame(config.numPlayers, config.firstPlayer)];
  }

  get game() {
    return this.states[this.states.length - 1];
  }

  play(action) {
    const next = applyAction(this.game, action);
    this.actions.push({ ...action, player: this.game.current });
    this.states.push(next);
    this.save();
    return next;
  }

  save() {
    try {
      if (this.game.winner !== null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ config: this.config, actions: this.actions }));
    } catch {
      /* 저장 불가 환경 무시 */
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const { config, actions } = JSON.parse(raw);
      const s = new GameSession(config);
      for (const a of actions) s.play(a);
      return s;
    } catch {
      return null;
    }
  }

  static hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  static clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* 무시 */
    }
  }
}
