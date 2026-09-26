import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list';

function createTwoToolAgent(processor: Processor) {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `send-${callCount}`,
            toolName: 'sendMessage',
            input: JSON.stringify({ message: `message-${callCount}` }),
          },
          {
            type: 'tool-call' as const,
            toolCallId: `end-${callCount}`,
            toolName: 'endTurn',
            input: JSON.stringify({}),
          },
        ],
        warnings: [],
      };
    },
  });

  return new Agent({
    id: 'step-content-agent',
    name: 'Step content agent',
    instructions: 'Call both tools.',
    model,
    tools: {
      sendMessage: createTool({
        id: 'sendMessage',
        description: 'Send a message',
        inputSchema: z.object({ message: z.string() }),
        execute: async ({ message }) => ({ message }),
      }),
      endTurn: createTool({
        id: 'endTurn',
        description: 'End the turn',
        inputSchema: z.object({}),
        execute: async () => ({ status: 'stopped' }),
      }),
    },
    inputProcessors: [processor],
  });
}

async function collectStepToolResults(agent: Agent) {
  const seen: Array<Array<{ id: string; output: unknown }>> = [];
  const stopWhen = vi.fn(({ steps }) => {
    const last = steps[steps.length - 1];
    seen.push(last.toolResults.map((r: any) => ({ id: r.toolCallId, output: r.output })));
    return steps.length === 3;
  });
  await agent.generate('Run three tool steps.', { stopWhen });
  return seen;
}

const ids = (seen: Array<Array<{ id: string }>>) => seen.map(step => step.map(r => r.id));

describe('step content after processors remove earlier response messages', () => {
  it('keeps the current step content when only some earlier response messages are removed', async () => {
    let callCount = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `send-${callCount}`,
              toolName: 'sendMessage',
              input: JSON.stringify({ message: `message-${callCount}` }),
            },
            {
              type: 'tool-call' as const,
              toolCallId: `end-${callCount}`,
              toolName: 'endTurn',
              input: JSON.stringify({}),
            },
          ],
          warnings: [],
        };
      },
    });

    let removedIds: string[] = [];
    // Give each step its own response message, then drop the first one before the third step
    // while keeping the second, like a memory processor relocating part of the response bucket.
    const partialRemoval = {
      id: 'partial-response-removal',
      processInputStep: async ({ stepNumber, messageList, rotateResponseMessageId }) => {
        if (stepNumber > 0) rotateResponseMessageId?.();
        if (stepNumber === 2) {
          const [first, second] = messageList.get.response.db();
          expect(second).toBeDefined();
          removedIds = messageList.removeByIds([first!.id]).map(m => m.id);
        }
        return {};
      },
    } satisfies Processor;

    const agent = new Agent({
      id: 'partial-removal-agent',
      name: 'Partial removal agent',
      instructions: 'Call both tools.',
      model,
      tools: {
        sendMessage: createTool({
          id: 'sendMessage',
          description: 'Send a message',
          inputSchema: z.object({ message: z.string() }),
          execute: async ({ message }) => ({ message }),
        }),
        endTurn: createTool({
          id: 'endTurn',
          description: 'End the turn',
          inputSchema: z.object({}),
          execute: async () => ({ status: 'stopped' }),
        }),
      },
      inputProcessors: [partialRemoval],
    });

    const seen: string[][] = [];
    const stopWhen = vi.fn(({ steps }) => {
      const last = steps[steps.length - 1];
      seen.push(last.toolResults.map((r: any) => r.toolCallId));
      return steps.length === 3;
    });

    await agent.generate('Run three tool steps.', { stopWhen });

    expect(removedIds).toHaveLength(1);
    expect(seen).toEqual([
      ['send-1', 'end-1'],
      ['send-2', 'end-2'],
      ['send-3', 'end-3'],
    ]);
  });

  it('does not re-report a response message that returns to the bucket after being removed', async () => {
    let removed: MastraDBMessage[] = [];
    const removeThenRestore = {
      id: 'remove-then-restore',
      processInputStep: async ({ stepNumber, messageList, rotateResponseMessageId }) => {
        if (stepNumber > 0) rotateResponseMessageId?.();
        if (stepNumber === 1) {
          const [first] = messageList.get.response.db();
          removed = messageList.removeByIds([first!.id]);
        }
        if (stepNumber === 2) messageList.add(removed, 'response');
        return {};
      },
    } satisfies Processor;

    const seen = await collectStepToolResults(createTwoToolAgent(removeThenRestore));

    expect(removed).toHaveLength(1);
    expect(ids(seen)).toEqual([
      ['send-1', 'end-1'],
      ['send-2', 'end-2'],
      ['send-3', 'end-3'],
    ]);
  });

  it('reports a tool result replaced in place (background task completion) exactly once', async () => {
    const completeBackgroundResult = {
      id: 'complete-background-result',
      processInputStep: async ({ stepNumber, messageList, rotateResponseMessageId }) => {
        if (stepNumber > 0) rotateResponseMessageId?.();
        if (stepNumber === 1) {
          const updated = messageList.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'send-1',
              toolName: 'sendMessage',
              args: { message: 'message-1' },
              result: { message: 'completed' },
            },
          });
          expect(updated).toBe(true);
        }
        return {};
      },
    } satisfies Processor;

    const seen = await collectStepToolResults(createTwoToolAgent(completeBackgroundResult));

    expect(ids(seen)).toEqual([
      ['send-1', 'end-1'],
      ['send-1', 'send-2', 'end-2'],
      ['send-3', 'end-3'],
    ]);
    expect(JSON.stringify(seen[1]![0]!.output)).toContain('completed');
  });

  it('does not re-report a tool result that is replaced and then restored (A -> B -> A)', async () => {
    const replaceSendResult = (result: unknown) => ({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'result' as const,
        toolCallId: 'send-1',
        toolName: 'sendMessage',
        args: { message: 'message-1' },
        result,
      },
    });
    const flipBackgroundResult = {
      id: 'flip-background-result',
      processInputStep: async ({ stepNumber, messageList, rotateResponseMessageId }) => {
        if (stepNumber > 0) rotateResponseMessageId?.();
        if (stepNumber === 1) expect(messageList.updateToolInvocation(replaceSendResult({ message: 'B' }))).toBe(true);
        if (stepNumber === 2) {
          expect(messageList.updateToolInvocation(replaceSendResult({ message: 'message-1' }))).toBe(true);
        }
        return {};
      },
    } satisfies Processor;

    const seen = await collectStepToolResults(createTwoToolAgent(flipBackgroundResult));

    expect(ids(seen)).toEqual([
      ['send-1', 'end-1'],
      ['send-1', 'send-2', 'end-2'],
      ['send-3', 'end-3'],
    ]);
    expect(JSON.stringify(seen[1]![0]!.output)).toContain('"B"');
  });

  it('reports a replacement result whose serialisation collides with the previous one under a 32-bit hash', async () => {
    // "r122789" and "r339192" have the same 32-bit FNV-1a hash once wrapped as text tool output and JSON-serialised.
    const replaceSendResult = (result: unknown) => ({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'result' as const,
        toolCallId: 'send-1',
        toolName: 'sendMessage',
        args: { message: 'message-1' },
        result,
      },
    });
    const collidingResults = {
      id: 'colliding-results',
      processInputStep: async ({ stepNumber, messageList, rotateResponseMessageId }) => {
        if (stepNumber > 0) rotateResponseMessageId?.();
        if (stepNumber === 1) expect(messageList.updateToolInvocation(replaceSendResult('r122789'))).toBe(true);
        if (stepNumber === 2) expect(messageList.updateToolInvocation(replaceSendResult('r339192'))).toBe(true);
        return {};
      },
    } satisfies Processor;

    const seen = await collectStepToolResults(createTwoToolAgent(collidingResults));

    expect(ids(seen)).toEqual([
      ['send-1', 'end-1'],
      ['send-1', 'send-2', 'end-2'],
      ['send-1', 'send-3', 'end-3'],
    ]);
    expect(JSON.stringify(seen[2]![0]!.output)).toContain('r339192');
  });
});
