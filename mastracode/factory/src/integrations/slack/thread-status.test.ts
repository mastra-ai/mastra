import { describe, expect, it, vi } from 'vitest';

import { swapThreadReaction } from './thread-status.js';

const THREAD = 'slack:C123:1792771853.363419';
const ROOT_TS = '1792771853.363419';

function fakeAdapter() {
  return { addReaction: vi.fn(async () => {}), removeReaction: vi.fn(async () => {}) };
}

describe('swapThreadReaction', () => {
  it('replaces the old reaction with the new one on the thread root message', async () => {
    const adapter = fakeAdapter();

    await swapThreadReaction(adapter, THREAD, { remove: 'eyes', add: 'memo' });

    expect(adapter.removeReaction).toHaveBeenCalledWith(THREAD, ROOT_TS, 'eyes');
    expect(adapter.addReaction).toHaveBeenCalledWith(THREAD, ROOT_TS, 'memo');
  });

  it('still adds the new reaction when the old one was never there', async () => {
    const adapter = fakeAdapter();
    adapter.removeReaction.mockRejectedValueOnce(new Error('no_reaction'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await swapThreadReaction(adapter, THREAD, { remove: 'eyes', add: 'memo' });

    expect(adapter.addReaction).toHaveBeenCalledWith(THREAD, ROOT_TS, 'memo');
    warn.mockRestore();
  });

  it('applies overlapping swaps on one thread in the order they were started', async () => {
    const calls: string[] = [];
    let releaseFirstRemove!: () => void;
    const adapter = {
      removeReaction: vi.fn(async (_t: string, _ts: string, emoji: string) => {
        if (emoji === 'eyes') await new Promise<void>(resolve => (releaseFirstRemove = resolve));
        calls.push(`-${emoji}`);
      }),
      addReaction: vi.fn(async (_t: string, _ts: string, emoji: string) => {
        calls.push(`+${emoji}`);
      }),
    };

    const first = swapThreadReaction(adapter, THREAD, { remove: 'eyes', add: 'memo' });
    const second = swapThreadReaction(adapter, THREAD, { remove: 'memo', add: 'hammer' });
    await vi.waitFor(() => expect(adapter.removeReaction).toHaveBeenCalledTimes(1));
    releaseFirstRemove();
    await Promise.all([first, second]);

    expect(calls).toEqual(['-eyes', '+memo', '-memo', '+hammer']);
  });

  it('ignores thread ids that are not Slack threads', async () => {
    const adapter = fakeAdapter();

    await swapThreadReaction(adapter, 'discord:123', { add: 'memo' });

    expect(adapter.addReaction).not.toHaveBeenCalled();
  });
});
