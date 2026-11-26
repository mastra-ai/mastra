import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import { resolveChannelRenderContext } from './thread-lookup';

const render = { platform: 'slack' } as never;

function channelsFor(threadId: string) {
  const buildRenderContextForThread = vi.fn(async (id: string) => (id === threadId ? render : null));
  return { buildRenderContextForThread, channels: () => ({ buildRenderContextForThread }) as never };
}

describe('resolveChannelRenderContext', () => {
  it('uses the render context a platform message stashed, without a thread read', async () => {
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, render);
    const { channels, buildRenderContextForThread } = channelsFor('t');

    expect(await resolveChannelRenderContext(requestContext, channels)).toBe(render);
    expect(buildRenderContextForThread).not.toHaveBeenCalled();
  });

  it("rebuilds a web or woken run's thread from the controller's thread id", async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1' });

    expect(await resolveChannelRenderContext(requestContext, channelsFor('thread-1').channels)).toBe(render);
  });

  it("rebuilds from the run's memory thread when there is no controller", async () => {
    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: 'thread-2' }, resourceId: 'r' });

    expect(await resolveChannelRenderContext(requestContext, channelsFor('thread-2').channels)).toBe(render);
  });

  it('resolves nothing for an unlinked thread, a run with no thread, or no channels', async () => {
    const linked = new RequestContext();
    linked.set('controller', { threadId: 'thread-1' });
    const unlinked = new RequestContext();
    unlinked.set('controller', { threadId: 'other' });

    expect(await resolveChannelRenderContext(unlinked, channelsFor('thread-1').channels)).toBeUndefined();
    expect(await resolveChannelRenderContext(new RequestContext(), channelsFor('thread-1').channels)).toBeUndefined();
    expect(await resolveChannelRenderContext(linked)).toBeUndefined();
    expect(await resolveChannelRenderContext(undefined, channelsFor('thread-1').channels)).toBeUndefined();
  });
});
