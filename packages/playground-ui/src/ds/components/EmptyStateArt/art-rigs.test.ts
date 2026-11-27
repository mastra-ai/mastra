// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playRigs, restFrame, rigFrame, rigPeriod } from './art-rigs';
import type { RigMode, RigName } from './art-rigs';

const names: RigName[] = ['radar', 'hourglass', 'padlock', 'turnstile'];
const modes: RigMode[] = ['working', 'failed'];

function mount(name: RigName) {
  const art = document.createElement('span');
  art.dataset.slot = 'empty-state-art';
  art.dataset.state = 'idle';
  art.innerHTML = `<svg><g data-rig="${name}">${restFrame(name)}</g></svg>`;
  document.body.append(art);
  const part = art.querySelector('g[data-rig]');
  if (!part) throw new Error('missing rig');
  return { art, part };
}

function stubFrames() {
  const queue: FrameRequestCallback[] = [];
  let now = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => queue.splice(0));
  return {
    pending: () => queue.length,
    run(frames: number) {
      for (let i = 0; i < frames; i++) {
        const callback = queue.shift();
        if (!callback) return;
        now += 1000 / 60;
        callback(now);
      }
    },
  };
}

function rendered(name: RigName) {
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  holder.innerHTML = restFrame(name);
  return holder.innerHTML;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('EmptyStateArt rigs', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it.each(names)('draws every frame of %s in both states', name => {
    for (const mode of modes) {
      for (let time = 0; time < rigPeriod(name, mode); time += 1 / 30) {
        expect(rigFrame(name, mode, time)).toMatch(/^<(g|path|circle)/);
      }
    }
  });

  it('stays still until the drawing is live, plays while live, and returns to rest when it stops', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const frames = stubFrames();
    const { art, part } = mount('radar');
    const stop = playRigs(art);
    frames.run(2);
    expect(frames.pending()).toBe(0);
    expect(part.innerHTML).toBe(rendered('radar'));

    art.setAttribute('data-live', '');
    await settle();
    frames.run(30);
    expect(part.innerHTML).not.toBe(rendered('radar'));
    expect(frames.pending()).toBe(1);

    art.removeAttribute('data-live');
    await settle();
    frames.run(120);
    expect(part.innerHTML).toBe(rendered('radar'));
    expect(frames.pending()).toBe(0);
    stop();
  });

  it('keeps the rest frame when reduced motion is on', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const frames = stubFrames();
    const { art, part } = mount('turnstile');
    playRigs(art);
    art.setAttribute('data-live', '');
    await settle();
    frames.run(30);
    expect(part.innerHTML).toBe(rendered('turnstile'));
  });
});
