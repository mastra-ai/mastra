import { afterEach, expect, it, vi } from 'vitest';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { createDurableToolCallStep } from '../agent/durable/workflows/steps/tool-call';
import { MessageList } from '../agent/message-list';
import { createToolCallStep } from '../loop/workflows/agentic-execution/tool-call-step';
import { RequestContext } from '../request-context';
import { PUBSUB_SYMBOL } from '../workflows/constants';

afterEach(() => globalRunRegistry.delete('failed-save-run'));

it.each([false, true].flatMap(durable => ['form', 'approval', 'delegated'].map(kind => ({ durable, kind }))))(
  'does not announce $kind before saving or retain it after save failure (durable=$durable)',
  async ({ durable, kind }) => {
    const toolCallId = 'failed-call';
    const toolName = 'question';
    const metadataKey = kind === 'form' ? 'suspendedTools' : 'pendingToolApprovals';
    const sibling = { toolCallId: 'sibling', toolName, runId: 'sibling-run' };
    const messageList = new MessageList({ threadId: 'save-thread', resourceId: 'save-user' });
    messageList.add(
      {
        id: 'response',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName, args: {} } }],
          metadata: { [metadataKey]: { sibling } },
        },
      },
      'response',
    );
    let rejectSave!: (error: Error) => void;
    const pendingSave = new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    });
    const flushMessages = vi.fn(() => pendingSave);
    const suspend = vi.fn();
    const chunks: any[] = [];
    const execute = vi.fn(async (_input: unknown, options: any) =>
      options.suspend(
        kind === 'delegated' ? { requireToolApproval: { toolName: 'inner', args: {} } } : { question: 'Continue?' },
        kind === 'delegated' ? { requireToolApproval: true, runId: 'inner-run', isAgentSuspend: true } : {},
      ),
    );
    const tools = { [toolName]: { execute, requireApproval: kind === 'approval' } };
    const state = { threadId: 'save-thread', resourceId: 'save-user', threadExists: true };
    const internal = { ...state, saveQueueManager: { flushMessages } };
    const pubsub = {
      publish: vi.fn(async (_topic: string, event: any) => {
        chunks.push(event);
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      flush: vi.fn(),
    };
    const base = {
      inputData: { toolCallId, toolName, args: {} },
      suspend,
      requestContext: new RequestContext(),
      mastra: { getLogger: () => undefined },
      getInitData: () => ({ runId: 'failed-save-run', agentId: 'test-agent', options: {}, state }),
      [PUBSUB_SYMBOL]: pubsub,
    };
    if (durable)
      globalRunRegistry.set('failed-save-run', { tools, messageList, saveQueueManager: { flushMessages } } as any);
    const step = durable
      ? createDurableToolCallStep()
      : createToolCallStep({
          tools,
          messageList,
          controller: { enqueue: (chunk: any) => chunks.push(chunk) },
          runId: 'failed-save-run',
          streamState: { serialize: () => ({}) },
          _internal: internal,
        } as any);
    const running = (step as any).execute(base).then(
      (value: unknown) => ({ value }),
      (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
    );
    await vi.waitFor(() => expect(flushMessages).toHaveBeenCalledOnce());
    const pendingEvents = () =>
      chunks.filter(chunk => /tool-call-(?:suspended|approval)|agent-suspended/.test(JSON.stringify(chunk)));
    expect(pendingEvents()).toEqual([]);
    expect(suspend).not.toHaveBeenCalled();
    // Another same-name tool can add its pending state while this save is in flight.
    const lateSibling = { toolCallId: 'late-sibling', toolName, runId: 'late-run' };
    const inFlightMetadata = messageList.get.all.db().find(message => message.id === 'response')!.content
      .metadata as any;
    messageList.updateMessageMetadataByToolCallId(toolCallId, {
      [metadataKey]: { ...inFlightMetadata[metadataKey], lateSibling },
    });
    rejectSave(new Error('storage unavailable'));
    const result = await running;
    expect(JSON.stringify(result)).toContain('storage unavailable');
    expect(pendingEvents()).toEqual([]);
    expect(suspend).not.toHaveBeenCalled();
    const metadata = messageList.get.all.db().find(message => message.id === 'response')!.content.metadata as any;
    expect(metadata[metadataKey]).toEqual({ sibling, lateSibling });
    // A later explicit native save must read current messages without the rejected marker.
    expect(JSON.stringify(messageList.get.all.db())).not.toContain('Continue?');
  },
);
