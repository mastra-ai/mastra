import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import * as resolveRuntime from '../../utils/resolve-runtime';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/resolve-runtime')>()),
  resolveTool: vi.fn().mockReturnValue(undefined),
  toolRequiresApproval: vi.fn(),
  rebuildRunToolsFromMastra: vi.fn(),
}));
vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const runId = 'cold-tool-resume';

afterEach(() => {
  globalRunRegistry.delete(runId);
  vi.clearAllMocks();
});

describe('cold durable tool-call resume (#25978)', () => {
  it.each([false, true])('redacts a declined tool using its own transform with placeholder=%s', async placeholder => {
    if (placeholder) {
      globalRunRegistry.set(runId, { isPlaceholder: true, tools: {}, model: undefined } as any);
    }
    const args = { value: 'secret' };
    const execute = vi.fn();
    const messages = [
      {
        id: 'suspended-message',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'save', args },
            },
          ],
          metadata: { pendingToolApprovals: { 'call-1': { toolCallId: 'call-1', toolName: 'save', args } } },
        },
      },
    ];
    const tools = { save: { id: 'save', execute, transform: { display: { input: () => '[tool-redacted]' } } } };
    vi.mocked(resolveRuntime.rebuildRunToolsFromMastra).mockImplementationOnce(async () => {
      const registryEntry = globalRunRegistry.get(runId);
      if (registryEntry) registryEntry.tools = tools as any;
      return { tools: tools as any, memory: { recall: vi.fn().mockResolvedValue({ messages }) } as any };
    });
    vi.mocked(resolveRuntime.toolRequiresApproval).mockResolvedValue(true);
    const result = await (createDurableToolCallStep() as any).execute({
      inputData: { toolCallId: 'call-1', toolName: 'save', args, requireApproval: true },
      resumeData: { approved: false },
      suspendData: { type: 'approval' },
      suspend: vi.fn(),
      requestContext: new Map(),
      getInitData: () => ({
        runId,
        agentId: 'saver',
        options: {},
        state: { threadId: 'thread-1', resourceId: 'user-1', threadExists: true },
      }),
      mastra: { getLogger: () => undefined, getServer: () => undefined, listTools: () => ({}) },
      [PUBSUB_SYMBOL]: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() },
    });
    expect(result.error).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
    const chunks = vi.mocked(emitChunkEvent).mock.calls.map(call => call[2]);
    expect(chunks.map(chunk => chunk.type)).toEqual(['tool-call-resumed', 'tool-output-denied']);
    for (const chunk of chunks) {
      const display = JSON.stringify(chunk.metadata?.mastra?.toolPayloadTransform?.display);
      expect(display).toContain('[tool-redacted]');
      expect(display).not.toContain('secret');
    }
  });

  it.each([
    ['approval', false, true],
    ['approval', true, true],
    ['suspension', false, true],
    ['suspension', true, true],
    ['approval', false, false],
    ['approval', true, false],
    ['suspension', false, false],
    ['suspension', true, false],
  ] as const)(
    'emits a %s resume acknowledgment with placeholder=%s and registeredAgent=%s',
    async (kind, placeholder, registeredAgent) => {
      if (placeholder) {
        globalRunRegistry.set(runId, { isPlaceholder: true, tools: {}, model: undefined } as any);
      }
      const args = { value: 'secret' };
      const entry = { toolCallId: 'call-1', toolName: 'save', args, suspendPayload: { question: 'confirm?' } };
      const metadataKey = kind === 'approval' ? 'pendingToolApprovals' : 'suspendedTools';
      const messages = Array.from({ length: 45 }, (_, index) => ({
        id: `message-${index}`,
        role: 'assistant' as const,
        threadId: 'thread-1',
        resourceId: 'user-1',
        createdAt: new Date(index),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'earlier' }] },
      }));
      const suspendedMessage = {
        id: 'suspended-message',
        role: 'assistant',
        threadId: 'thread-1',
        resourceId: 'user-1',
        createdAt: new Date(46),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'save', args },
            },
          ],
          metadata: { [metadataKey]: { 'call-1': entry } },
        },
      };
      const recall = vi
        .fn()
        .mockImplementation(({ perPage }) =>
          Promise.resolve({ messages: perPage === false ? [...messages, suspendedMessage] : messages.slice(0, 40) }),
        );
      const execute = vi.fn().mockResolvedValue({ saved: true });
      const flushMessages = vi.fn().mockResolvedValue(undefined);
      vi.mocked(resolveRuntime.rebuildRunToolsFromMastra).mockResolvedValueOnce({
        tools: { save: { id: 'save', execute } as any },
        memory: { recall } as any,
        saveQueueManager: { flushMessages } as any,
      });
      vi.mocked(resolveRuntime.toolRequiresApproval).mockResolvedValue(kind === 'approval');
      const transform = { targets: ['display', 'transcript'], transformToolPayload: () => '[redacted]' };
      const step = createDurableToolCallStep();
      const result = await (step as any).execute({
        inputData: { toolCallId: 'call-1', toolName: 'save', args, requireApproval: kind === 'approval' },
        resumeData: { approved: true },
        suspendData:
          kind === 'suspension' ? { type: kind, toolCallSuspended: { toolCallId: 'call-1' } } : { type: kind },
        suspend: vi.fn(),
        requestContext: new Map(),
        getInitData: () => ({
          runId,
          agentId: 'saver',
          options: {},
          state: { threadId: 'thread-1', resourceId: 'user-1', threadExists: true },
        }),
        mastra: {
          getLogger: () => undefined,
          getServer: () => undefined,
          listTools: () => ({}),
          getAgentById: () => {
            throw new Error('Agent not registered');
          },
          listAgents: () =>
            registeredAgent ? { saver: { id: 'saver', getToolPayloadTransform: () => transform } } : {},
          getToolPayloadTransform: () => ({
            targets: ['display', 'transcript'],
            transformToolPayload: () => '[global-redacted]',
          }),
        },
        [PUBSUB_SYMBOL]: { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() },
      });
      expect(result.error).toBeUndefined();
      expect(execute).toHaveBeenCalledTimes(1);
      expect(flushMessages).toHaveBeenCalled();
      const persistedMessage = flushMessages.mock.calls[0]![0].get.all.db().find(
        (message: { id: string }) => message.id === 'suspended-message',
      );
      expect(persistedMessage.content.metadata[metadataKey]?.['call-1']).toBeUndefined();
      expect(recall).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
      const chunks = vi.mocked(emitChunkEvent).mock.calls.map(call => call[2]);
      expect(chunks.map(chunk => chunk.type).slice(0, 2)).toEqual(['tool-call-resumed', 'tool-result']);
      expect(chunks.filter(chunk => chunk.type === 'tool-call-resumed')).toHaveLength(1);
      const ack = chunks[0];
      expect(ack.payload).toMatchObject({ toolCallId: 'call-1', toolName: 'save', kind });
      expect(JSON.stringify(ack.metadata?.mastra?.toolPayloadTransform?.display)).toContain(
        registeredAgent ? '[redacted]' : '[global-redacted]',
      );
      expect(JSON.stringify(ack.metadata?.mastra?.toolPayloadTransform?.display)).not.toContain('secret');
      const toolResult = chunks.find(chunk => chunk.type === 'tool-result');
      expect(JSON.stringify(toolResult?.metadata?.mastra?.toolPayloadTransform?.display)).toContain(
        registeredAgent ? '[redacted]' : '[global-redacted]',
      );
      expect(JSON.stringify(toolResult?.metadata?.mastra?.toolPayloadTransform?.display)).not.toContain('secret');
      expect(JSON.stringify(result.transformMetadata?.mastra?.toolPayloadTransform?.transcript)).toContain(
        registeredAgent ? '[redacted]' : '[global-redacted]',
      );
      expect(JSON.stringify(result.transformMetadata?.mastra?.toolPayloadTransform?.transcript)).not.toContain(
        'secret',
      );
    },
  );
});
