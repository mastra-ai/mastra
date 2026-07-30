import { describe, expect, it } from 'vitest';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMMappingStep } from './llm-mapping';

// Write-side companion to the llmPrompt read-side guard (message-list.ts).
//
// A tool's `toModelOutput` can return `undefined` (e.g. a text-only result).
// The durable llm-mapping step used to persist that as
// `providerMetadata.mastra.modelOutput: undefined` — key present, value
// nullish — poisoning the stored message so every later prompt build tripped
// the stored-output override. The non-durable llm-mapping-step already skips
// nullish values on write; this covers the durable step's parity.

function buildInput(toModelOutput: (result: unknown) => unknown, runId: string) {
  const toolCallId = 'call_1';
  const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  list.add({ role: 'user', content: 'read whoami.json' }, 'input');
  list.add(
    {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      threadId: 'thread-1',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId, toolName: 'read_file', args: { path: 'whoami.json' } },
          },
        ],
      },
    },
    'response',
  );

  globalRunRegistry.set(runId, { tools: { read_file: { toModelOutput } } } as any);

  return {
    inputData: {
      llmOutput: {
        messageListState: list.serialize(),
        stepResult: { isContinued: false },
        text: '',
        toolCalls: [],
      },
      toolResults: [{ toolCallId, toolName: 'read_file', args: { path: 'whoami.json' }, result: '{ "id": 1 }' }],
      runId,
      agentId: 'agent-1',
      messageId: 'assistant-1',
      state: { threadId: 'thread-1', resourceId: 'resource-1', threadExists: false },
    },
    mastra: undefined,
    requestContext: undefined,
  };
}

function getToolInvocationPart(messageListState: unknown) {
  const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  list.deserialize(messageListState as any);
  for (const dbMsg of list.get.all.db()) {
    if (dbMsg.content?.format !== 2 || !dbMsg.content.parts) continue;
    for (const part of dbMsg.content.parts) {
      if (part.type === 'tool-invocation') return part as any;
    }
  }
  return undefined;
}

describe('durable llm-mapping toModelOutput persistence', () => {
  it('does not persist a nullish modelOutput', async () => {
    const runId = 'durable-model-output-nullish';
    try {
      const result = await (createDurableLLMMappingStep() as any).execute(buildInput(() => undefined, runId));

      const part = getToolInvocationPart(result.messageListState);
      expect(part, 'tool-invocation part should exist').toBeDefined();
      const mastraMeta = part.providerMetadata?.mastra as Record<string, unknown> | undefined;
      expect(
        mastraMeta === undefined || !('modelOutput' in mastraMeta),
        'a nullish modelOutput must not be persisted (poisons the stored message)',
      ).toBe(true);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('still persists a real modelOutput', async () => {
    const runId = 'durable-model-output-real';
    try {
      const result = await (createDurableLLMMappingStep() as any).execute(
        buildInput(() => ({ type: 'text', value: 'mapped' }), runId),
      );

      const part = getToolInvocationPart(result.messageListState);
      expect((part.providerMetadata?.mastra as any)?.modelOutput).toEqual({ type: 'text', value: 'mapped' });
    } finally {
      globalRunRegistry.delete(runId);
    }
  });
});
