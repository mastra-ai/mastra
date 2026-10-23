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

  it('ignores thread ids that are not Slack threads', async () => {
    const adapter = fakeAdapter();

    await swapThreadReaction(adapter, 'discord:123', { add: 'memo' });

    expect(adapter.addReaction).not.toHaveBeenCalled();
  });
});
