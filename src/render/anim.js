// 가벼운 트윈 매니저
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

const tweens = new Set();

export function tween({ duration = 0.4, delay = 0, easing = ease.inOut, update, complete }) {
  return new Promise((resolve) => {
    tweens.add({ t: -delay, duration, easing, update, complete, resolve });
  });
}

export function updateTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.duration);
    tw.update?.(tw.easing(k), k);
    if (k >= 1) {
      tweens.delete(tw);
      tw.complete?.();
      tw.resolve();
    }
  }
}

export const isAnimating = () => tweens.size > 0;
