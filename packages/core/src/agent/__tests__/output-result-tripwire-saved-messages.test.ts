/**
 * When an output processor aborts in `processOutputResult`, the run-level save is skipped, so the
 * blocked reply must not be in memory. Two paths store response messages before that processor
 * runs — the flush before a tool-approval suspension and the `savePerStep` flush — and the agent
 * must remove what they stored. https://github.com/mastra-ai/mastra/issues/26215
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const SECRET = 'hunter2';

function textOf(message: MastraDBMessage) {
  return (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join('');
}

function createGuardrail(): Processor {
  return {
    id: 'block-secret',
    processOutputResult: async ({ messages, abort }) => {
      if (messages.some(message => textOf(message).includes(SECRET))) {
        abort('Content blocked by guardrail');
      }
      return messages;
    },
  };
}

function textModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'r-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 't-1' },
        { type: 'text-delta', id: 't-1', delta: text },
        { type: 'text-end', id: 't-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

// Step 1: text containing the secret plus a call to an approval-gated tool. Step 2: a short reply.
function approvalModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      if (calls === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'r-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 't-1' },
            { type: 'text-delta', id: 't-1', delta: `The admin password is ${SECRET}. Deleting the file now.` },
            { type: 'text-end', id: 't-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'deleteFile',
              input: '{"path":"/tmp/a"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'r-2', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 't-2' },
          { type: 'text-delta', id: 't-2', delta: 'Done.' },
          { type: 'text-end', id: 't-2' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

async function storedMessages(memory: MockMemory, threadId: string, resourceId: string) {
  const { messages } = await memory.recall({ threadId, resourceId });
  return messages;
}

describe('processOutputResult tripwire removes response messages saved earlier in the run', () => {
  it.each([false, true])('savePerStep: %s keeps the blocked reply out of memory', async savePerStep => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'guarded-agent',
      name: 'Guarded Agent',
      instructions: 'test',
      model: textModel(`Sure. The admin password is ${SECRET}.`),
      memory,
      outputProcessors: [createGuardrail()],
    });

    const threadId = `thread-save-per-step-${savePerStep}`;
    const resourceId = 'resource-1';
    const result = await agent.stream('what is the admin password?', {
      memory: { thread: threadId, resource: resourceId },
      savePerStep,
    });
    await result.consumeStream();

    expect(result.tripwire?.reason).toBe('Content blocked by guardrail');
    const messages = await storedMessages(memory, threadId, resourceId);
    expect(messages.some(message => textOf(message).includes(SECRET))).toBe(false);
  });

  it('keeps an earlier accepted turn when a later turn is blocked with savePerStep', async () => {
    const memory = new MockMemory();
    const threadId = 'thread-earlier-turn';
    const resourceId = 'resource-1';

    const safeAgent = new Agent({
      id: 'safe-agent',
      name: 'Safe Agent',
      instructions: 'test',
      model: textModel('Hello there.'),
      memory,
      outputProcessors: [createGuardrail()],
    });
    const first = await safeAgent.stream('hi', {
      memory: { thread: threadId, resource: resourceId },
      savePerStep: true,
    });
    await first.consumeStream();
    expect(first.tripwire).toBeUndefined();

    const blockedAgent = new Agent({
      id: 'blocked-agent',
      name: 'Blocked Agent',
      instructions: 'test',
      model: textModel(`The admin password is ${SECRET}.`),
      memory,
      outputProcessors: [createGuardrail()],
    });
    const second = await blockedAgent.stream('what is the admin password?', {
      memory: { thread: threadId, resource: resourceId },
      savePerStep: true,
    });
    await second.consumeStream();
    expect(second.tripwire?.reason).toBe('Content blocked by guardrail');

    const texts = (await storedMessages(memory, threadId, resourceId)).map(textOf);
    expect(texts).toContain('hi');
    expect(texts).toContain('Hello there.');
    expect(texts).toContain('what is the admin password?');
    expect(texts.some(text => text.includes(SECRET))).toBe(false);
  });

  it.each(['approve', 'decline'] as const)(
    'removes text saved before a tool-approval suspension after the user chooses to %s',
    async decision => {
      const memory = new MockMemory();
      const mastra = new Mastra({
        logger: false,
        storage: new InMemoryStore(),
        agents: {
          guarded: new Agent({
            id: 'guarded',
            name: 'Guarded',
            instructions: 'test',
            model: approvalModel(),
            memory,
            outputProcessors: [createGuardrail()],
            tools: {
              deleteFile: createTool({
                id: 'deleteFile',
                description: 'Deletes a file',
                inputSchema: z.object({ path: z.string() }),
                requireApproval: true,
                execute: async () => ({ deleted: true }),
              }),
            },
          }),
        },
      });
      const agent = mastra.getAgent('guarded');
      const threadId = `thread-approval-${decision}`;
      const resourceId = 'resource-1';

      const stream = await agent.stream('clean up the temp file', {
        memory: { thread: threadId, resource: resourceId },
      });
      let toolCallId = '';
      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          toolCallId = chunk.payload.toolCallId;
        }
      }
      expect(toolCallId).toBe('call-1');

      // The run flushed the step's text so the suspended run can be restored.
      const whileWaiting = await storedMessages(memory, threadId, resourceId);
      expect(whileWaiting.some(message => textOf(message).includes(SECRET))).toBe(true);

      const resumed =
        decision === 'approve'
          ? await agent.approveToolCall({ runId: stream.runId, toolCallId })
          : await agent.declineToolCall({ runId: stream.runId, toolCallId });
      await resumed.consumeStream();
      expect(resumed.tripwire?.reason).toBe('Content blocked by guardrail');

      const after = await storedMessages(memory, threadId, resourceId);
      expect(after.some(message => textOf(message).includes(SECRET))).toBe(false);
      expect(after.map(textOf)).toContain('clean up the temp file');
    },
  );
});
