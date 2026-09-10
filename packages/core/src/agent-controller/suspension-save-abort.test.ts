import { Memory } from '@mastra/memory';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { globalRunRegistry } from '../agent/durable/run-registry';
import { createDurableToolCallStep } from '../agent/durable/workflows/steps/tool-call';
import { MessageList } from '../agent/message-list';
import { SaveQueueManager } from '../agent/save-queue';
import { createToolCallStep } from '../loop/workflows/agentic-execution/tool-call-step';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { CoreToolBuilder } from '../tools/tool-builder/builder';
import { PUBSUB_SYMBOL } from '../workflows/constants';

afterEach(() => globalRunRegistry.delete('failed-save-run'));

it.each(
  [false, true].flatMap(durable =>
    ['form', 'approval', 'delegated'].flatMap(kind =>
      [false, true].map(cleanupFails => ({ durable, kind, cleanupFails })),
    ),
  ),
)(
  'handles cancellation during $kind save (durable=$durable, cleanupFails=$cleanupFails)',
  async ({ durable, kind, cleanupFails }) => {
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
    const abortController = new AbortController();
    let finishSave!: () => void;
    const pendingSave = new Promise<void>(resolve => {
      finishSave = resolve;
    });
    const storage = new InMemoryStore({ id: 'combined-save' });
    const memory = new Memory({ storage });
    await memory.createThread({ threadId: 'save-thread', resourceId: 'save-user' });
    const originalSave = memory.saveMessages.bind(memory);
    const save = vi.spyOn(memory, 'saveMessages').mockImplementationOnce(async args => {
      await pendingSave;
      return originalSave(args);
    });
    const cleanupError = new Error('cleanup storage unavailable');
    if (cleanupFails) save.mockImplementationOnce(originalSave).mockRejectedValueOnce(cleanupError);
    const queue = new SaveQueueManager({ memory });
    const flushMessages = vi.fn((...args: Parameters<SaveQueueManager['flushMessages']>) =>
      queue.flushMessages(...args),
    );
    const suspend = vi.fn();
    const chunks: any[] = [];
    const execute = vi.fn(async (_input: unknown, options: any) =>
      options.suspend(
        kind === 'delegated' ? { requireToolApproval: { toolName: 'inner', args: {} } } : { question: 'Continue?' },
        kind === 'delegated' ? { requireToolApproval: true, runId: 'inner-run', isAgentSuspend: true } : {},
      ),
    );
    const built = new CoreToolBuilder({
      originalTool: createTool({
        id: toolName,
        description: 'Ask.',
        inputSchema: z.object({}),
        execute: async (input, context) => execute(input, { suspend: context?.agent?.suspend }),
      }),
      options: { name: toolName, requestContext: new RequestContext() },
    }).buildV5();
    const tools = { [toolName]: { ...built, requireApproval: kind === 'approval' } };
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
      abortSignal: abortController.signal,
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
          options: { abortSignal: abortController.signal },
        } as any);
    const running = (step as any).execute(base).then(
      (value: unknown) => ({ value }),
      (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
    );
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
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
    const queued = queue.flushMessages(messageList, 'save-thread');
    abortController.abort();
    finishSave();
    const result = await running;
    if (cleanupFails) expect(result).toEqual({ error: cleanupError.message });
    else expect(result).toMatchObject({ value: { aborted: true } });
    expect(chunks.filter(chunk => (chunk.data ?? chunk).type === 'tool-error')).toEqual([]);
    expect(pendingEvents()).toEqual([]);
    expect(suspend).not.toHaveBeenCalled();
    const metadata = messageList.get.all.db().find(message => message.id === 'response')!.content.metadata as any;
    expect(metadata[metadataKey]).toEqual({ sibling, lateSibling });
    // A later explicit native save must read current messages without the rejected marker.
    expect(JSON.stringify(messageList.get.all.db())).not.toContain('Continue?');
    await queued;
    if (cleanupFails) return; // No durable cleanup claim when that write fails.
    const memoryStore = (await storage.getStore('memory'))!;
    const stored = await memoryStore.listMessages({ threadId: 'save-thread', resourceId: 'save-user' });
    expect(stored.messages).toHaveLength(1);
    expect((stored.messages[0]!.content.metadata as any)[metadataKey]).toEqual({ sibling, lateSibling });
    expect(JSON.stringify(stored)).not.toContain('Continue?');
  },
);
