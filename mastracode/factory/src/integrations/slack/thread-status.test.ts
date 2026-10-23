import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { REPLY_TOOL_NAME } from './reply-tool.js';
import { FactoryThreadDoneProcessor, swapThreadReaction } from './thread-status.js';

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

describe('FactoryThreadDoneProcessor', () => {
  function setup({ boundToCard = false, openedPullRequest = false } = {}) {
    const adapter = fakeAdapter();
    const channels = {
      buildRenderContextForThread: vi.fn(async () => ({ platform: 'slack', chatThread: { id: THREAD }, adapter })),
    };
    const findActiveRunBindingByThread = vi.fn(async () => (boundToCard ? ({ workItemId: 'wi-1' } as any) : null));
    const processor = new FactoryThreadDoneProcessor({
      channels: () => channels as any,
      workItems: () => ({ findActiveRunBindingByThread }),
      markers: () => ({
        create: vi.fn(),
        listBySession: vi.fn(async () => (openedPullRequest ? [{ status: 'opened-pull-request' } as any] : [])),
      }),
    });
    const requestContext = new RequestContext();
    requestContext.set('controller', { threadId: 'thread-1', resourceId: 'res-1', sessionId: 'sess-1' });
    requestContext.set('user', { id: 'user-1', organizationId: 'org-1' });
    return { processor, adapter, requestContext };
  }

  function run(processor: FactoryThreadDoneProcessor, requestContext: RequestContext, toolNames: string[]) {
    const steps = [{ toolResults: toolNames.map(toolName => ({ payload: { toolName, isError: false } })) }];
    return processor.processOutputResult({ messages: [], result: { steps }, requestContext } as any);
  }

  it('adds ✅ to the thread root when the run replied in the thread', async () => {
    const { processor, adapter, requestContext } = setup();

    await run(processor, requestContext, [REPLY_TOOL_NAME]);

    await vi.waitFor(() => expect(adapter.addReaction).toHaveBeenCalledWith(THREAD, ROOT_TS, 'white_check_mark'));
  });

  it('leaves the thread alone when the run never replied', async () => {
    const { processor, adapter, requestContext } = setup();

    await run(processor, requestContext, ['execute_command']);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(adapter.addReaction).not.toHaveBeenCalled();
  });

  it('waits for the merge when the session opened a pull request', async () => {
    const { processor, adapter, requestContext } = setup({ openedPullRequest: true });

    await run(processor, requestContext, [REPLY_TOOL_NAME]);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(adapter.addReaction).not.toHaveBeenCalled();
  });

  it('leaves the reaction to the card stage when the run works on a card', async () => {
    const { processor, adapter, requestContext } = setup({ boundToCard: true });

    await run(processor, requestContext, [REPLY_TOOL_NAME]);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(adapter.addReaction).not.toHaveBeenCalled();
  });
});
