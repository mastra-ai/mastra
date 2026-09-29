import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { MessageList } from '../../../message-list';
import { emitChunkEvent } from '../../stream-adapter';
import { createDurableLLMMappingStep } from './llm-mapping';

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => vi.clearAllMocks());

async function runWithDeferredStepFinish(stepResultMessageId: string | undefined) {
  const step = createDurableLLMMappingStep();
  await (step as any).execute({
    inputData: {
      llmOutput: {
        messageListState: new MessageList({ threadId: 't', resourceId: 'r' }).serialize(),
        stepResult: { isContinued: true, reason: 'tool-calls', warnings: [], messageId: stepResultMessageId },
        text: '',
        toolCalls: [],
        deferredStepFinishChunk: { type: 'step-finish', runId: 'run-1', from: 'AGENT', payload: { stepResult: {} } },
      },
      toolResults: [],
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'msg-initial',
      state: { threadId: 't', resourceId: 'r', threadExists: true },
    },
    mastra: { getLogger: () => undefined },
    requestContext: new Map(),
    [PUBSUB_SYMBOL]: {},
  });
  const call = vi.mocked(emitChunkEvent).mock.calls.find(([, , chunk]) => (chunk as any).type === 'step-finish');
  return call?.[3];
}

describe('durable llm-mapping deferred step-finish messageId', () => {
  it('uses the id the LLM step ended on when the message was rotated mid-step', async () => {
    expect(await runWithDeferredStepFinish('msg-rotated')).toBe('msg-rotated');
  });

  it('falls back to the iteration message id', async () => {
    expect(await runWithDeferredStepFinish(undefined)).toBe('msg-initial');
  });
});
