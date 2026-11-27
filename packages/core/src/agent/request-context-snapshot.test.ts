import { describe, it, expect } from 'vitest';

import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../channels/output-processor';
import { MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';
import { restoreRequestContext, snapshotRequestContextEntries } from './request-context-snapshot';

describe('snapshotRequestContextEntries', () => {
  it('omits the channel render context so a replica never restores a method-less husk (#31310)', () => {
    // A live render context carries platform adapters, the chat-SDK thread and
    // bound driver callbacks. It is per-run state, so a snapshot must not carry
    // it: JSON drops every method and a resumed run would call
    // `render.wrapStream` on the husk.
    const renderContext = {
      platform: 'slack',
      adapter: { name: 'slack' },
      wrapStream: () => {},
      onApprovalPosted: () => {},
    };
    const ctx = new RequestContext<unknown>([
      ['userId', 'u1'],
      [CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext],
    ]);

    const snapshot = snapshotRequestContextEntries(ctx);

    expect(snapshot).toEqual({ userId: 'u1' });
    expect(snapshot).not.toHaveProperty(CHAT_CHANNEL_RENDER_CONTEXT_KEY);
  });

  it('still persists the thread id a resumed run needs to rebuild from', () => {
    const ctx = new RequestContext<unknown>([
      [MASTRA_THREAD_ID_KEY, 'thread-1'],
      ['userId', 'u1'],
    ]);

    expect(snapshotRequestContextEntries(ctx)).toEqual({ [MASTRA_THREAD_ID_KEY]: 'thread-1', userId: 'u1' });
  });

  it('restores the method-less husk from a snapshot written before the render key was excluded (#31310)', () => {
    // Why the output processor also needs a guard: snapshots written before this
    // fix already contain the JSON husk, and restoring returns it verbatim.
    const legacySnapshot = { [CHAT_CHANNEL_RENDER_CONTEXT_KEY]: { platform: 'slack', adapter: { name: 'slack' } } };

    const restored = restoreRequestContext(legacySnapshot);
    const husk = Object.fromEntries(restored.entries())[CHAT_CHANNEL_RENDER_CONTEXT_KEY] as { wrapStream?: unknown };

    expect(husk).toBeDefined();
    expect(typeof husk.wrapStream).toBe('undefined');
  });
});
