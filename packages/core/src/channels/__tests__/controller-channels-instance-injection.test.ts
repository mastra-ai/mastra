/**
 * Regression test for the controller-channels instance-injection render-key clear.
 *
 * This is a driver-level test that exercises the *actual risk path* the
 * render-key clear defends: a forked subagent runs on the channel-bearing parent
 * agent instance (subagentToRun = parentAgent), inherits the parent request
 * context verbatim (including CHAT_CHANNEL_RENDER_CONTEXT_KEY, set exactly as the
 * real inbound-message path sets it at agent-channels.ts:1166), and so the
 * ChatChannelOutputProcessor IS attached to the forked run. Without the
 * render-key clear the fork hits the output processor's PRIMARY render path and
 * posts the fork's stream to the chat platform.
 *
 * It drives the REAL `createSubagentTool(...).execute({ forked: true }, ...)` code
 * path against a REAL Agent that carries REAL AgentControllerChannels (so the
 * output processor is genuinely attached), with a real render context on the
 * request context. It calls execute() directly rather than through the outer
 * controller session engine — the session engine's debounced save-queue
 * deadlocks a synthetic mid-run fork (flushMessages awaits a queue the suspended
 * parent stream never drains); calling execute() directly exercises the identical
 * tools.ts fork code (clone context -> delete render key -> parentAgent.stream())
 * and the identical output processor, deterministically.
 *
 * Claim (a) — RENDER: a channel run on the parent agent posts to the fake adapter
 *             (the parent agent's processor renders when the render key is set).
 * Claim (b) — SILENCE (load-bearing): the forked-subagent-on-parent-agent path
 *             produces zero posts. A distinctive FORK_SECRET string emitted only
 *             by the fork's stream must never appear in any post — proving the
 *             forked context cleared CHAT_CHANNEL_RENDER_CONTEXT_KEY.
 *
 * Run:
 *   NO_COLOR=1 pnpm --filter ./packages/core exec vitest run \
 *     src/channels/__tests__/controller-channels-instance-injection.test.ts --reporter=dot
 *
 * PASS = fork silent (render key cleared). If you delete the render-key clear in
 * packages/core/src/agent-controller/tools.ts, claim (b) FAILS (fork renders) —
 * that is the RED that proves the clear is load-bearing.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { createSubagentTool } from '../../agent-controller/tools';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { AgentChannels } from '../agent-channels';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';

const FORK_SECRET = 'FORK_SECRET_MUST_NOT_REACH_SLACK';
const PARENT_TEXT = 'Parent reply to the channel.';

function createMockAdapter(name: string) {
  return {
    name,
    postMessage: vi.fn().mockResolvedValue({ id: 'sent-1', text: 'ok' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok', { status: 200 })),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':')[0]),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

function createChatThread(adapter: any, threadId: string) {
  return {
    id: threadId,
    channelId: threadId.split(':')[0],
    isDM: true,
    adapter,
    isSubscribed: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    mentionUser: vi.fn((userId: string) => `<@${userId}>`),
    post: vi.fn().mockResolvedValue({ id: 'posted-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  } as any;
}

/** All text posted anywhere (the inbound mock thread + the adapter). */
function allPostedText(adapter: any, chatThread: any): string {
  return JSON.stringify([...chatThread.post.mock.calls, ...adapter.postMessage.mock.calls]);
}

/** A model that always emits the given text — used for the fork's stream. */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('controller-channels instance injection: forked-subagent render-key clear', () => {
  it('renders a parent-agent channel run but the forked subagent on the parent agent stays silent', async () => {
    const adapter = createMockAdapter('discord');
    const store = new InMemoryStore();
    const memory = new MockMemory({ storage: store });

    // The channel-bearing parent agent. Its model emits FORK_SECRET — this is the
    // stream the forked subagent runs. Real AgentControllerChannels-equivalent:
    // AgentChannels attaches the real ChatChannelOutputProcessor onto this agent.
    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'parent-agent',
      instructions: 'parent',
      model: createTextModel(FORK_SECRET),
      memory,
    });
    const channels = new AgentChannels({ adapters: { discord: adapter } });
    // Instance-based attachment — exactly the redesign under test.
    parentAgent.setChannels(channels);
    expect(parentAgent.getChannels()).toBe(channels);
    // The processor is attached because the channels live on the instance.
    expect(channels.getOutputProcessors([]).map((p: any) => p.id)).toContain('chat-channel-render');

    // A real render context, built the same way the inbound channel path builds
    // it, and stamped under the same key the inbound path uses.
    const chatThread = createChatThread(adapter, 'chan-1:t-proof');
    const renderContext = channels._buildRenderContext(chatThread as any, 'discord');

    // ---- Claim (a) RENDER: with the render key set, the parent agent's stream
    // posts to the fake adapter. ----
    const parentRunContext = new RequestContext();
    parentRunContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext);
    const renderAgent = new Agent({
      id: 'render-agent',
      name: 'render-agent',
      instructions: 'render',
      model: createTextModel(PARENT_TEXT),
    });
    renderAgent.setChannels(new AgentChannels({ adapters: { discord: adapter } }));
    const parentRun = await renderAgent.stream(PARENT_TEXT, { requestContext: parentRunContext });
    for await (const _ of parentRun.fullStream) {
      // drain
    }
    expect(allPostedText(adapter, chatThread)).toContain(PARENT_TEXT);

    // Seed a parent thread so cloneThreadForFork has something to clone.
    const memStore = (await store.getStore('memory'))!;
    await memStore.saveThread({
      thread: {
        id: 'parent-thread',
        resourceId: 'parent-resource',
        title: 'parent',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { channel_platform: 'discord', channel_externalThreadId: 'chan-1:t-proof' },
      },
    } as any);

    // Build the REAL subagent tool wired to the channel-bearing parent agent.
    const subagentTool = createSubagentTool({
      subagents: [
        { id: 'explore', name: 'Explore', description: 'Explore', instructions: 'Be exploratory.', forked: true },
      ],
      resolveModel: (m: string) => m,
      fallbackModelId: 'openai/gpt-4o',
      getParentAgent: () => parentAgent,
      getParentModelId: () => 'openai/gpt-4o',
      cloneThreadForFork: async ({
        sourceThreadId,
        resourceId,
        title,
      }: {
        sourceThreadId: string;
        resourceId: string;
        title?: string;
      }) => memory.cloneThread({ sourceThreadId, resourceId, title }).then(r => r.thread),
    } as any);

    // The parent run's request context, carrying the render key (as inherited by a
    // real fork) plus the controller ctx with the active parent thread id.
    const forkParentContext = new RequestContext();
    forkParentContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext);
    forkParentContext.set('controller', { threadId: 'parent-thread', resourceId: 'parent-resource' });

    // ---- Claim (b) SILENCE: run the REAL forked execute() on the parent agent. ----
    const result = await (subagentTool as any).execute(
      { agentType: 'explore', task: 'do sub work', forked: true },
      {
        requestContext: forkParentContext,
        agent: { toolCallId: 'tc-fork', flushMessages: async () => {} },
        workspace: createMockWorkspace(),
      },
    );

    // The fork actually ran (its stream produced FORK_SECRET as the tool result).
    expect(result.isError).toBe(false);
    expect(JSON.stringify(result)).toContain(FORK_SECRET);

    // Load-bearing: the fork ran on the parent agent (processor attached) and
    // inherited the render key, yet FORK_SECRET never posted — proving the forked
    // context cleared CHAT_CHANNEL_RENDER_CONTEXT_KEY.
    expect(allPostedText(adapter, chatThread)).not.toContain(FORK_SECRET);

    // ---- Claim (c) NO AUTO TOOLS: a channel-bearing agent's resolved toolset
    // does NOT include send_message/add_reaction — auto-injection is gone. ----
    const toolAgent = new Agent({
      id: 'tool-agent',
      name: 'tool-agent',
      instructions: 'tools',
      model: createTextModel('x'),
    });
    toolAgent.setChannels(new AgentChannels({ adapters: { discord: adapter } }));
    const resolvedTools = Object.keys(await toolAgent.getToolsForExecution({}));
    expect(resolvedTools).not.toContain('send_message');
    expect(resolvedTools).not.toContain('add_reaction');
  }, 40_000);
});
