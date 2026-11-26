import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import { ChannelToolAnnouncementProcessor } from './tool-announcement-processor';

function toolResult(payload: Record<string, unknown>): ChunkType {
  return { type: 'tool-result', runId: 'r', from: 'AGENT', payload: { toolCallId: 'c1', ...payload } } as ChunkType;
}

const announce = ({ toolName, result }: { toolName: string; result: unknown }) =>
  toolName === 'open_pr' ? `Pull request opened: ${(result as { url: string }).url}` : undefined;

async function run(part: ChunkType, requestContext = new RequestContext(), channels?: () => never) {
  const processor = new ChannelToolAnnouncementProcessor({ announce, channels });
  const out = await processor.processOutputStream({ part, requestContext, state: {} } as never);
  await new Promise(resolve => setTimeout(resolve, 0));
  return out;
}

describe('ChannelToolAnnouncementProcessor', () => {
  it("posts the host's announcement into the run's thread and passes the chunk through", async () => {
    const post = vi.fn(async () => ({}));
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { chatThread: { post } });
    const part = toolResult({ toolName: 'open_pr', result: { url: 'https://github.com/a/b/pull/1' } });

    expect(await run(part, requestContext)).toBe(part);
    expect(post).toHaveBeenCalledWith({ markdown: 'Pull request opened: https://github.com/a/b/pull/1' });
  });

  it('announces on a run that did not start in the channel, through its linked thread', async () => {
    const post = vi.fn(async () => ({}));
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1' });
    const channels = () => ({ buildRenderContextForThread: async () => ({ chatThread: { post } }) }) as never;

    await run(toolResult({ toolName: 'open_pr', result: { url: 'u' } }), requestContext, channels);
    expect(post).toHaveBeenCalledWith({ markdown: 'Pull request opened: u' });
  });

  it('stays quiet for failed, partial or unannounced calls, and when the thread is gone', async () => {
    const post = vi.fn(async () => ({}));
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, { chatThread: { post } });

    await run(toolResult({ toolName: 'open_pr', result: { url: 'u' }, isError: true }), requestContext);
    await run(toolResult({ toolName: 'open_pr', result: { url: 'u' }, preliminary: true }), requestContext);
    await run(toolResult({ toolName: 'list_files', result: [] }), requestContext);
    await run(toolResult({ toolName: 'open_pr', result: { url: 'u' } }));
    expect(post).not.toHaveBeenCalled();
  });

  it("doesn't fail the run when the post fails", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, {
      chatThread: { post: async () => Promise.reject(new Error('down')) },
    });
    const part = toolResult({ toolName: 'open_pr', result: { url: 'u' } });

    expect(await run(part, requestContext)).toBe(part);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
