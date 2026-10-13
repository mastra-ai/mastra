/**
 * Ported from validation harness case T22 (prepare-step).
 *
 * `prepareStep` may replace the model, tools, messages, and tool choice for an
 * individual agentic-loop iteration. Every engine must apply those values to
 * the request sent for that iteration without leaking a previous or static
 * value into later requests.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, ParityEngine } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter(part => part.type === 'tool-result').length;
  }
  return count;
}

function toolNames(request: CapturedRequest): string[] {
  return (request.tools ?? []).map(tool => tool.name).sort();
}

function userText(request: CapturedRequest): string[] {
  return request.prompt.flatMap(message => {
    if (message.role !== 'user') return [];
    if (typeof message.content === 'string') return [message.content];
    if (!Array.isArray(message.content)) return [];
    return message.content.flatMap(part => (part.type === 'text' ? [part.text] : []));
  });
}

function taggedModel(model: unknown, modelId: string, onCall: () => void): unknown {
  const clone = Object.assign(Object.create(Object.getPrototypeOf(model)), model, { modelId }) as {
    doStream: (options: unknown) => unknown;
  };
  const inner = clone.doStream;
  clone.doStream = options => {
    onCall();
    return inner(options);
  };
  return clone;
}

function expectSettled(turn: { finishReason?: string; chunks: Array<{ type: string }> } | undefined) {
  expect(turn?.finishReason).toBe('stop');
  expect(chunksOfType(turn!, 'finish')).toBe(1);
}

describe('T22 prepare-step (plain, durable, evented)', () => {
  it('model: uses the model returned for the current step', async () => {
    const served = new Map<ParityEngine, number>();

    const results = await expectEngineParity({
      model: { tapes: [textOnlyTape('prepared model answered')] },
      buildAgent: ({ engine, model }) => {
        served.set(engine, 0);
        const preparedModel = taggedModel(model, 't22-prepared-model', () =>
          served.set(engine, served.get(engine)! + 1),
        );
        return new Agent({
          id: `t22-model-${engine}`,
          name: 'T22 model',
          instructions: 'Follow the script.',
          model,
          defaultOptions: {
            prepareStep: () => ({ model: preparedModel as typeof model }),
          },
        });
      },
      input: 'Use the prepared model.',
    });

    for (const engine of ENGINES) {
      expect(results[engine]!.requests).toHaveLength(1);
      expect(served.get(engine)).toBe(1);
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('tools: replaces the tool set on every step', async () => {
    const commits = new Map<ParityEngine, string[]>();

    const results = await expectEngineParity({
      model: {
        respond: request => {
          const done = toolResultCount(request);
          if (done === 0) return toolCallTape('first', { n: 1 }, 'first-call');
          if (done === 1) return toolCallTape('second', { n: 2 }, 'second-call');
          return textOnlyTape('both tools finished');
        },
      },
      buildAgent: ({ engine, model }) => {
        commits.set(engine, []);
        const first = createTool({
          id: 'first',
          description: 'Run first.',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => {
            commits.get(engine)!.push('first');
            return { n };
          },
        });
        const second = createTool({
          id: 'second',
          description: 'Run second.',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => {
            commits.get(engine)!.push('second');
            return { n };
          },
        });
        return new Agent({
          id: `t22-tools-${engine}`,
          name: 'T22 tools',
          instructions: 'Follow the script.',
          model,
          tools: { first, second },
          defaultOptions: {
            prepareStep: ({ stepNumber }) => ({
              tools: stepNumber === 0 ? { first } : stepNumber === 1 ? { second } : {},
              activeTools: undefined,
            }),
          },
        });
      },
      input: 'Run both tools.',
      options: { maxSteps: 4 },
    });

    for (const engine of ENGINES) {
      const requests = results[engine]!.requests;
      expect(requests).toHaveLength(3);
      expect(requests.map(toolNames)).toEqual([['first'], ['second'], []]);
      expect(commits.get(engine)).toEqual(['first', 'second']);
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('messages: replaces the messages for the current step', async () => {
    const marker = 't22 prepared message';
    const results = await expectEngineParity({
      model: { tapes: [textOnlyTape('message received')] },
      buildAgent: ({ engine, model }) =>
        new Agent({
          id: `t22-messages-${engine}`,
          name: 'T22 messages',
          instructions: 'Follow the script.',
          model,
          defaultOptions: {
            prepareStep: () => ({ messages: [{ role: 'user', content: marker }] }),
          },
        }),
      input: 'original message',
    });

    for (const engine of ENGINES) {
      const requests = results[engine]!.requests;
      expect(requests).toHaveLength(1);
      expect(userText(requests[0]!)).toEqual([marker]);
      expect(userText(requests[0]!)).not.toContain('original message');
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('tool-choice: applies the returned choice on every step', async () => {
    const commits = new Map<ParityEngine, number>();
    const results = await expectEngineParity({
      model: {
        respond: request =>
          toolResultCount(request) === 0
            ? toolCallTape('step', { n: 1 }, 'step-call')
            : textOnlyTape('tool choice finished'),
      },
      buildAgent: ({ engine, model }) => {
        commits.set(engine, 0);
        const step = createTool({
          id: 'step',
          description: 'Advance one step.',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => {
            commits.set(engine, commits.get(engine)! + 1);
            return { n };
          },
        });
        return new Agent({
          id: `t22-tool-choice-${engine}`,
          name: 'T22 tool choice',
          instructions: 'Follow the script.',
          model,
          tools: { step },
          defaultOptions: {
            prepareStep: ({ stepNumber }) => ({
              toolChoice: stepNumber === 0 ? { type: 'tool', toolName: 'step' } : 'none',
            }),
          },
        });
      },
      input: 'Run one tool.',
      options: { maxSteps: 3 },
    });

    for (const engine of ENGINES) {
      const requests = results[engine]!.requests;
      expect(requests).toHaveLength(2);
      expect(requests.map(request => request.toolChoice)).toEqual([
        { type: 'tool', toolName: 'step' },
        { type: 'none' },
      ]);
      expect(commits.get(engine)).toBe(1);
      expectSettled(results[engine]!.turns.at(-1));
    }
  });
});
