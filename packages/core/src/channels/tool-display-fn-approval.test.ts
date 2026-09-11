import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('gray-matter', () => ({
  default: () => ({ data: {}, content: '', matter: '', language: '', stringify: () => '' }),
  __esModule: true,
}));

import { getChatModule } from './chat-lazy';
import { AgentChannels } from './agent-channels';
import type { ToolDisplayEvent, ToolDisplayFn } from './types';

function makeAdapter(name: string) {
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
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

function makeAgent() {
  return {
    id: 'agent',
    name: 'agent',
    stream: vi.fn().mockResolvedValue({ textStream: new ReadableStream({ start(c) { c.close(); } }) }),
    sendMessage: vi.fn().mockReturnValue({ accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }) }),
    subscribeToThread: vi.fn().mockResolvedValue({
      stream: (async function* () {})(),
      activeRunId: () => null,
      abort: () => false,
      unsubscribe: vi.fn(),
    }),
    getMemory: vi.fn().mockResolvedValue(null),
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as any;
}

const FALLBACK_STORAGE = {
  getStorage: () => ({ getStore: () => ({ listMessages: async () => ({ messages: [] }) }) }),
  getServer: () => null,
};

describe('#23512: ToolDisplayFn owns the approval card resolved state', () => {
  beforeAll(async () => {
    await getChatModule();
  });

  function buildChannels(
    adapter: any,
    toolDisplay: ToolDisplayFn | 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden' | undefined,
    streaming = true,
  ): AgentChannels {
    const channels = new AgentChannels({
      adapters: {
        [adapter.name]: {
          adapter,
          streaming,
          ...(toolDisplay !== undefined ? { toolDisplay } : {}),
        },
      },
    });
    channels.__setAgent(makeAgent());
    channels.__setLogger({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
    return channels;
  }

  function seedApprovalState(channels: AgentChannels, adapter: any) {
    (channels as any).findThreadMapping = vi
      .fn()
      .mockResolvedValue({ thread: { id: 'mastra-thread-1', resourceId: 'resource-1' } });
    (channels as any).pendingApprovalCards.set('tool-call-1', {
      runId: 'run-1',
      toolName: 'deleteCustomerTool',
      args: { id: 42 },
    });
    (channels as any).dispatchApproval = vi.fn().mockResolvedValue(undefined);
    (channels as any).dispatchDecline = vi.fn().mockResolvedValue(undefined);
    adapter.channelIdFromThreadId.mockImplementation((id: string) => id.split(':')[0]);
  }

  function makeActionEvent(adapter: any, actionId: string, isDM = false) {
    return {
      actionId,
      adapter,
      messageId: 'card-1',
      threadId: 'channel-1:thread-1',
      thread: { id: 'channel-1:thread-1', channelId: 'channel-1', isDM },
      user: { userId: 'clicker-1', userName: 'clicker', fullName: 'Clicker' },
      raw: {},
    } as any;
  }

  it('routes the post-approve edit through the function-form toolDisplay', async () => {
    const adapter = makeAdapter('slack');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM LOCALIZED APPROVAL CARD' };
      if (event.kind === 'approved') return { kind: 'post', message: 'CUSTOM LOCALIZED APPROVED ✓' };
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

    const approvedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'approved');
    expect(approvedCall).toBeDefined();
    expect(approvedCall![0]).toMatchObject({
      kind: 'approved',
      toolCallId: 'tool-call-1',
      toolName: 'deleteCustomerTool',
      displayName: 'deleteCustomerTool',
      args: { id: 42 },
      byUser: 'Clicker',
    });
    expect(approvedCall![1]).toEqual({ mode: 'streaming', platform: 'slack' });

    const edits = adapter.editMessage.mock.calls;
    expect(edits).toHaveLength(1);
    const [, , content] = edits[0]!;
    expect(content).toBe('CUSTOM LOCALIZED APPROVED ✓');
    expect(JSON.stringify(edits)).not.toContain('✓ Approved');
    expect(JSON.stringify(edits)).not.toContain('deleteCustomerTool ⋯');

    expect((channels as any).dispatchApproval).toHaveBeenCalledTimes(1);
  });

  it('routes the post-deny edit through the function-form toolDisplay', async () => {
    const adapter = makeAdapter('slack');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM LOCALIZED APPROVAL CARD' };
      if (event.kind === 'denied') return { kind: 'post', message: 'CUSTOM LOCALIZED DENIED ✗' };
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_deny:tool-call-1'));

    const deniedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'denied');
    expect(deniedCall).toBeDefined();
    expect(deniedCall![0]).toMatchObject({
      kind: 'denied',
      toolCallId: 'tool-call-1',
      toolName: 'deleteCustomerTool',
      displayName: 'deleteCustomerTool',
      args: { id: 42 },
      byUser: 'Clicker',
    });
    expect(deniedCall![1]).toEqual({ mode: 'streaming', platform: 'slack' });

    const edits = adapter.editMessage.mock.calls;
    expect(edits).toHaveLength(1);
    const [, , content] = edits[0]!;
    expect(content).toBe('CUSTOM LOCALIZED DENIED ✗');
    expect(JSON.stringify(edits)).not.toContain('✗ Denied');
    expect(JSON.stringify(edits)).not.toContain('deleteCustomerTool ✗');

    expect((channels as any).dispatchDecline).toHaveBeenCalledTimes(1);
  });

  it('skips the post-decision edit when the renderer returns undefined', async () => {
    const adapter = makeAdapter('slack');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) =>
      event.kind === 'approval' ? { kind: 'post', message: 'CUSTOM CARD' } : undefined,
    );
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

    const approvedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'approved');
    expect(approvedCall).toBeDefined();
    expect(approvedCall![0].kind).toBe('approved');

    expect(adapter.editMessage).not.toHaveBeenCalled();
    expect((channels as any).dispatchApproval).toHaveBeenCalledTimes(1);
  });

  it('treats a whitespace-only message from the renderer as an opt-out', async () => {
    const adapter = makeAdapter('slack');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM CARD' };
      if (event.kind === 'approved') return { kind: 'post', message: '   \n  ' };
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

    expect(adapter.editMessage).not.toHaveBeenCalled();
    expect((channels as any).dispatchApproval).toHaveBeenCalledTimes(1);
  });

  it('falls back to the framework formatter when no function-form toolDisplay is configured', async () => {
    const adapter = makeAdapter('slack');
    const channels = buildChannels(adapter, 'cards', true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

    const edits = adapter.editMessage.mock.calls;
    expect(edits).toHaveLength(1);
    const [, , content] = edits[0]!;
    expect(JSON.stringify(content)).toContain('Approved');
    expect((channels as any).dispatchApproval).toHaveBeenCalledTimes(1);
  });

  it('passes the streaming/static mode through to the function-form toolDisplay', async () => {
    const adapter = makeAdapter('discord');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM CARD' };
      if (event.kind === 'approved') return { kind: 'post', message: 'OK' };
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, false);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

    const approvedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'approved');
    expect(approvedCall).toBeDefined();
    expect(approvedCall![1]).toEqual({ mode: 'static', platform: 'discord' });
  });

  it('omits byUser in DMs where no other user can be attributed', async () => {
    const adapter = makeAdapter('slack');
    adapter.isDM = vi.fn(() => true);
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM CARD' };
      if (event.kind === 'approved' || event.kind === 'denied') {
        return { kind: 'post', message: `OK (${event.byUser ?? 'self'})` };
      }
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1', true));

    const approvedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'approved');
    expect(approvedCall).toBeDefined();
    expect(approvedCall![0].byUser).toBeUndefined();
  });

  it('passes the clicker name as byUser in non-DM threads', async () => {
    const adapter = makeAdapter('slack');
    const toolDisplay = vi.fn((event: ToolDisplayEvent) => {
      if (event.kind === 'approval') return { kind: 'post', message: 'CUSTOM CARD' };
      if (event.kind === 'approved' || event.kind === 'denied') return { kind: 'post', message: 'OK' };
      return undefined;
    });
    const channels = buildChannels(adapter, toolDisplay, true);
    await channels.initialize(FALLBACK_STORAGE as any);
    seedApprovalState(channels, adapter);

    await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1', false));

    const approvedCall = toolDisplay.mock.calls.find(([event]) => event.kind === 'approved');
    expect(approvedCall).toBeDefined();
    expect(approvedCall![0].byUser).toBe('Clicker');
  });
});
