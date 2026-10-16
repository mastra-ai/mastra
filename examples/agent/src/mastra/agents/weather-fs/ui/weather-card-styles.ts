/**
 * Styles for the weather card. Kept as a string and rendered through a React 19 `<style>`
 * resource, because tool components ship as a single JS module with no stylesheet.
 */
export const WEATHER_CARD_CSS = `
.wx-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  height: 480px;
  border-radius: 28px;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
  background: #0b1020;
  -webkit-font-smoothing: antialiased;
  transform: perspective(1000px) rotateX(var(--wx-rx, 0deg)) rotateY(var(--wx-ry, 0deg));
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 1s ease;
  box-shadow: 0 40px 80px -30px var(--wx-shadow, rgba(0, 0, 0, 0.5));
  animation: wx-enter 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}
@keyframes wx-enter {
  from { opacity: 0; scale: 0.9; filter: blur(14px); clip-path: circle(0% at 82% 16%); }
  60% { filter: blur(0); }
  to { opacity: 1; scale: 1; clip-path: circle(140% at 82% 16%); }
}

.wx-scene { position: absolute; inset: 0; animation: wx-scene-in 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; }
@keyframes wx-scene-in { from { opacity: 0; scale: 1.12; filter: saturate(1.6) blur(6px); } }
.wx-shake { position: absolute; inset: 0; }
.wx-scene[data-scene='stormy'] .wx-shake { animation: wx-shake 7s infinite; }
@keyframes wx-shake {
  0%, 58%, 64%, 100% { translate: 0 0; }
  59% { translate: -4px 2px; }
  60% { translate: 4px -2px; }
  61% { translate: -3px 1px; }
  62.5% { translate: 2px 0; }
}

.wx-sky { position: absolute; inset: -10%; background-size: 100% 180%; animation: wx-sky 16s ease-in-out infinite alternate; }
@keyframes wx-sky { to { background-position: 0 100%; } }
.wx-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 38%),
    radial-gradient(120% 90% at 30% 10%, transparent 45%, rgba(0, 0, 0, 0.28));
}
.wx-par {
  position: absolute; inset: 0;
  translate: calc(var(--wx-px, 0) * var(--d, 0) * 1px) calc(var(--wx-py, 0) * var(--d, 0) * 1px);
  transition: translate 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.wx-sun { position: absolute; top: 30px; right: 30px; width: 84px; height: 84px; }
.wx-sun > div { position: absolute; border-radius: 50%; }
.wx-sun-core {
  inset: 0;
  background: radial-gradient(circle at 35% 35%, #fffbe8 0%, #ffe27a 40%, #ffb020 100%);
  box-shadow: 0 0 30px 8px rgba(255, 214, 90, 0.8), 0 0 90px 30px rgba(255, 170, 50, 0.5);
  animation: wx-pulse 4s ease-in-out infinite;
}
@keyframes wx-pulse {
  50% { scale: 1.06; box-shadow: 0 0 44px 14px rgba(255, 214, 90, 0.95), 0 0 130px 50px rgba(255, 170, 50, 0.55); }
}
.wx-sun-halo { inset: -40px; background: radial-gradient(circle, rgba(255, 236, 160, 0.6), transparent 65%); animation: wx-breathe 3.2s ease-in-out infinite; }
@keyframes wx-breathe { 50% { opacity: 0.55; scale: 1.18; } }
.wx-sun-rays {
  inset: -80px;
  background: repeating-conic-gradient(rgba(255, 240, 190, 0.5) 0deg 3deg, transparent 3deg 15deg);
  -webkit-mask-image: radial-gradient(circle, transparent 22%, #000 32%, transparent 70%);
  mask-image: radial-gradient(circle, transparent 22%, #000 32%, transparent 70%);
  animation: wx-spin 50s linear infinite;
}
.wx-sun-rays-2 {
  inset: -60px;
  background: repeating-conic-gradient(from 7deg, rgba(255, 255, 255, 0.45) 0deg 1.5deg, transparent 1.5deg 22deg);
  animation-duration: 30s;
  animation-direction: reverse;
}
@keyframes wx-spin { to { rotate: 360deg; } }
.wx-sun-veiled { top: 44px; right: 76px; scale: 0.85; }
.wx-sun-veiled .wx-sun-rays { opacity: 0.45; }
.wx-sun-pale { opacity: 0.6; filter: blur(3px); }
.wx-sun-pale .wx-sun-rays { display: none; }
.wx-sun-pale .wx-sun-core { background: radial-gradient(circle, #fff, #eef2f7 70%); box-shadow: 0 0 60px 24px rgba(255, 255, 255, 0.55); }

.wx-flare {
  position: absolute; left: var(--x); top: var(--y); width: var(--s); height: var(--s);
  border-radius: 50%; background: radial-gradient(circle, var(--c), transparent 70%);
  mix-blend-mode: screen; animation: wx-flare 5s ease-in-out infinite alternate; animation-delay: var(--delay);
}
@keyframes wx-flare { from { opacity: 0.25; scale: 0.9; } to { opacity: 1; scale: 1.15; } }

.wx-mote {
  position: absolute; bottom: 130px; left: var(--x); width: var(--s); height: var(--s); border-radius: 50%;
  background: #fff6d8; box-shadow: 0 0 10px 2px rgba(255, 220, 140, 0.9); opacity: 0;
  animation: wx-float var(--dur) linear infinite; animation-delay: var(--delay);
}
@keyframes wx-float { 15% { opacity: 1; } 100% { translate: var(--drift) -340px; opacity: 0; } }

.wx-cloud {
  position: absolute; left: 0; top: var(--y); width: var(--w); height: calc(var(--w) * 0.34);
  border-radius: 999px; background: var(--c); opacity: var(--o); filter: blur(var(--b));
  animation: wx-drift var(--dur) linear infinite; animation-delay: var(--delay);
}
.wx-cloud::before, .wx-cloud::after { content: ''; position: absolute; border-radius: 50%; background: inherit; }
.wx-cloud::before { width: 50%; height: 165%; left: 16%; bottom: 22%; }
.wx-cloud::after { width: 38%; height: 128%; right: 14%; bottom: 28%; }
@keyframes wx-drift { from { translate: calc(var(--w) * -1) 0; } to { translate: 420px 0; } }

.wx-drop {
  position: absolute; top: -60px; left: var(--x); width: 1.5px; height: var(--l); border-radius: 2px;
  background: linear-gradient(to bottom, transparent, rgba(210, 230, 255, 0.95)); opacity: var(--o);
  rotate: 9deg; animation: wx-fall var(--dur) linear infinite; animation-delay: var(--delay);
}
@keyframes wx-fall { to { translate: -90px 580px; } }
.wx-ripple {
  position: absolute; left: var(--x); bottom: var(--b); width: 26px; height: 7px; margin-left: -13px;
  border-radius: 50%; border: 1.5px solid rgba(220, 235, 255, 0.75); opacity: 0;
  animation: wx-ripple 1.3s ease-out infinite; animation-delay: var(--delay);
}
@keyframes wx-ripple { 0% { scale: 0.2; opacity: 0.9; } 100% { scale: 1.9; opacity: 0; } }

.wx-flash {
  position: absolute; inset: 0; opacity: 0; mix-blend-mode: screen; pointer-events: none;
  background: radial-gradient(circle at 60% 18%, rgba(235, 240, 255, 0.95), rgba(170, 180, 255, 0.4) 60%, transparent);
  animation: wx-flash 7s infinite;
}
.wx-bolt {
  position: absolute; top: 30px; left: 46%; width: 70px; height: 150px; opacity: 0;
  filter: drop-shadow(0 0 8px #fff) drop-shadow(0 0 24px #a5b4fc);
  animation: wx-flash 7s infinite;
}
.wx-bolt-2 { top: 60px; left: 12%; width: 40px; height: 90px; scale: -1 1; animation-delay: -3.4s; }
@keyframes wx-flash {
  0%, 58%, 100% { opacity: 0; }
  59% { opacity: 0.95; }
  60% { opacity: 0.15; }
  61.5% { opacity: 0.8; }
  64% { opacity: 0; }
}

.wx-flake { position: absolute; top: -12px; left: var(--x); animation: wx-snow var(--dur) linear infinite; animation-delay: var(--delay); }
.wx-flake i {
  display: block; width: var(--s); height: var(--s); border-radius: 50%; background: #fff;
  opacity: var(--o); filter: blur(var(--b)); box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
  animation: wx-sway var(--sw) ease-in-out infinite alternate;
}
@keyframes wx-snow { to { translate: 0 520px; } }
@keyframes wx-sway { from { translate: calc(var(--dx) * -1) 0; } to { translate: var(--dx) 0; } }

.wx-fog {
  position: absolute; left: -40%; width: 180%; top: var(--y); height: var(--h); filter: blur(8px);
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, var(--o)), transparent 70%);
  animation: wx-fog var(--dur) ease-in-out infinite alternate; animation-delay: var(--delay);
}
@keyframes wx-fog { from { translate: -12% 0; } to { translate: 12% 0; } }

.wx-waves { position: absolute; left: -12px; right: -12px; bottom: -8px; height: 190px; }
.wx-wave { position: absolute; inset: 0; animation: wx-bob var(--bob) ease-in-out infinite alternate; }
.wx-wave svg { display: block; width: 200%; height: 100%; animation: wx-slide var(--dur) linear infinite; }
.wx-wave-reverse svg { animation-direction: reverse; }
@keyframes wx-slide { to { translate: -50% 0; } }
@keyframes wx-bob { from { translate: 0 -5px; } to { translate: 0 5px; } }
.wx-glint {
  position: absolute; left: var(--x); bottom: var(--b); width: 3px; height: 3px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.9); opacity: 0;
  animation: wx-twinkle var(--dur) ease-in-out infinite; animation-delay: var(--delay);
}
@keyframes wx-twinkle { 50% { opacity: 1; scale: 1.7; } }

.wx-glare {
  position: absolute; inset: 0; z-index: 4; pointer-events: none; mix-blend-mode: soft-light;
  background: radial-gradient(circle at var(--wx-gx, 50%) var(--wx-gy, 0%), rgba(255, 255, 255, 0.55), transparent 50%);
  opacity: var(--wx-glare, 0); transition: opacity 0.4s;
}
.wx-rim {
  position: absolute; inset: 0; z-index: 5; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.wx-sweep {
  position: absolute; inset: 0; z-index: 4; pointer-events: none;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.35) 50%, transparent 65%);
  animation: wx-sweep 1.1s ease-in-out infinite;
}
@keyframes wx-sweep { from { translate: -100% 0; } to { translate: 100% 0; } }

.wx-content {
  position: absolute; inset: 0; z-index: 3; padding: 24px; display: flex; flex-direction: column;
  text-shadow: 0 1px 14px rgba(0, 0, 0, 0.28);
}
.wx-rise { animation: wx-rise-in 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 90ms + 350ms); }
@keyframes wx-rise-in { from { opacity: 0; translate: 0 16px; filter: blur(6px); } }
.wx-city { display: flex; align-items: center; gap: 6px; max-width: 62%; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
.wx-city span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wx-city svg { flex: none; width: 16px; height: 16px; }
.wx-sub { margin-top: 2px; font-size: 13px; opacity: 0.85; }
.wx-temp {
  display: flex; align-items: flex-start; margin-top: 12px;
  font-size: 104px; font-weight: 200; line-height: 0.95; letter-spacing: -0.06em; font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, #fff 30%, rgba(255, 255, 255, 0.62)); -webkit-background-clip: text; background-clip: text;
  color: transparent; text-shadow: none; filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.28));
  animation: wx-pop 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) backwards;
}
.wx-deg { margin: 14px 0 0 6px; font-size: 32px; font-weight: 400; letter-spacing: 0; }
@keyframes wx-pop { from { opacity: 0; scale: 0.85; filter: blur(8px); } }
.wx-cond {
  display: inline-flex; align-items: center; gap: 8px; width: fit-content; margin-top: 10px; padding: 6px 12px;
  border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.16);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  font-size: 13px; font-weight: 550; text-transform: capitalize;
}
.wx-dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: wx-ping 2s infinite; }
@keyframes wx-ping {
  0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
  70%, 100% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
}
.wx-tag { padding: 1px 6px; border-radius: 6px; background: rgba(15, 23, 42, 0.45); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.wx-chips { display: flex; gap: 6px; margin-top: 14px; }
.wx-chip {
  display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border-radius: 50%; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.12); color: #fff;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  transition: transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1), background 0.25s, color 0.25s;
}
.wx-chip:hover { transform: translateY(-2px) scale(1.1); }
.wx-chip:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.wx-chip[aria-pressed='true'] { background: #fff; color: #1e293b; }
.wx-chip svg { width: 15px; height: 15px; }
.wx-panel {
  display: flex; flex-direction: column; gap: 10px; margin-top: auto; padding: 12px 14px; border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.26); background: rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(18px) saturate(170%); backdrop-filter: blur(18px) saturate(170%);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.35); text-shadow: none;
}
.wx-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.wx-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 10px; border: 0; border-radius: 999px;
  background: #fff; color: #0f172a; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer;
  box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.45); transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.wx-btn:hover { transform: scale(1.05); }
.wx-btn:active { transform: scale(0.96); }
.wx-btn:disabled { cursor: progress; }
.wx-btn svg { width: 14px; height: 14px; }
.wx-busy .wx-btn svg { animation: wx-spin 0.8s linear infinite; }
.wx-meta { font-size: 12px; opacity: 0.88; }
.wx-agents { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.wx-avatars { display: flex; }
.wx-avatar {
  display: grid; place-items: center; width: 24px; height: 24px; margin-left: -8px; border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.9); color: #fff; font-size: 10px; font-weight: 700;
  animation: wx-pop-in 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) backwards; animation-delay: calc(var(--i) * 70ms + 700ms);
}
.wx-avatar:first-child { margin-left: 0; }
.wx-more { background: rgba(15, 23, 42, 0.6); }
@keyframes wx-pop-in { from { opacity: 0; scale: 0.3; } }

.wx-status { display: grid; place-items: center; align-content: center; gap: 18px; height: 100%; text-align: center; font-size: 14px; }
.wx-radar { position: relative; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 0 20px #fff; }
.wx-radar::before, .wx-radar::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.85);
  animation: wx-radar 2s ease-out infinite;
}
.wx-radar::after { animation-delay: 1s; }
@keyframes wx-radar { to { scale: 9; opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .wx-card * { animation-play-state: paused !important; }
  .wx-card, .wx-card .wx-scene, .wx-card .wx-rise, .wx-card .wx-temp, .wx-card .wx-avatar { animation: none !important; }
  .wx-card, .wx-card .wx-par { transition: none !important; }
}
`;
