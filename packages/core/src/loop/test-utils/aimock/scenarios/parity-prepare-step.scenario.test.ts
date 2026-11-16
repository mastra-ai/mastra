/**
 * Ported from validation harness case T22 (prepare-step), merged with the
 * DurableAgent prepareStep tests.
 *
 * `prepareStep` may replace the model, tools, messages, and tool choice for an
 * individual agentic-loop iteration. Every engine must apply those values to
 * the request sent for that iteration without leaking a previous or static
 * value into later requests.
 *
 * On the wrapped engines `options.prepareStep` is stored on the in-process run
 * registry (never on the serialized workflow input) and invoked as a
 * `PrepareStepProcessor` at the start of every iteration of the durable
 * agentic loop, the same way it runs in the non-durable agent.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import type { CapturedRequest, ParityEngine } from '../parity';
import {
  chunksOfType,
  createRecordingModel,
  describeParity,
  expectParity,
  runOnEngine,
  textOnlyTape,
  toolCallTape,
  toolResultCount,
} from '../parity';

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

describeParity('prepare-step parity', target => {
  const hosts: Mastra[] = [];

  afterEach(async () => {
    await Promise.all(hosts.splice(0).map(host => host.shutdown()));
  });

  it('model: uses the model returned for each step', async () => {
    const served = new Map<ParityEngine, string[]>();

    const results = await expectParity(target, {
      model: {
        respond: request =>
          toolResultCount(request) === 0
            ? toolCallTape('step', { n: 1 }, 'model-step-call')
            : textOnlyTape('prepared models answered'),
      },
      buildAgent: ({ engine, model }) => {
        served.set(engine, []);
        const step = createTool({
          id: 'step',
          description: 'Advance one step.',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => ({ n }),
        });
        const preparedModels = ['first', 'second'].map(label =>
          taggedModel(model, `t22-${label}-prepared-model`, () => served.get(engine)!.push(label)),
        );
        return new Agent({
          id: `t22-model-${engine}`,
          name: 'T22 model',
          instructions: 'Follow the script.',
          model,
          tools: { step },
          defaultOptions: {
            prepareStep: ({ stepNumber }) => ({ model: preparedModels[stepNumber] as typeof model }),
          },
        });
      },
      input: 'Use the prepared models.',
      options: { maxSteps: 3 },
    });

    for (const engine of ['plain', target] as const) {
      expect(results[engine]!.requests).toHaveLength(2);
      expect(served.get(engine)).toEqual(['first', 'second']);
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('tools: replaces the tool set on every step', async () => {
    const commits = new Map<ParityEngine, string[]>();

    const results = await expectParity(target, {
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

    for (const engine of ['plain', target] as const) {
      const requests = results[engine]!.requests;
      expect(requests).toHaveLength(3);
      expect(requests.map(toolNames)).toEqual([['first'], ['second'], []]);
      expect(commits.get(engine)).toEqual(['first', 'second']);
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('messages: replaces the messages for each step', async () => {
    const markers = ['t22 first prepared message', 't22 second prepared message'];
    const results = await expectParity(target, {
      model: { tapes: [toolCallTape('step', { n: 1 }, 'messages-step-call'), textOnlyTape('messages received')] },
      buildAgent: ({ engine, model }) => {
        const step = createTool({
          id: 'step',
          description: 'Advance one step.',
          inputSchema: z.object({ n: z.number() }),
          execute: async ({ n }) => ({ n }),
        });
        return new Agent({
          id: `t22-messages-${engine}`,
          name: 'T22 messages',
          instructions: 'Follow the script.',
          model,
          tools: { step },
          defaultOptions: {
            prepareStep: ({ stepNumber }) => ({ messages: [{ role: 'user', content: markers[stepNumber]! }] }),
          },
        });
      },
      input: 'original message',
      options: { maxSteps: 3 },
    });

    for (const engine of ['plain', target] as const) {
      const requests = results[engine]!.requests;
      expect(requests).toHaveLength(2);
      expect(requests.map(userText)).toEqual(markers.map(marker => [marker]));
      expect(requests.flatMap(userText)).not.toContain('original message');
      expectSettled(results[engine]!.turns.at(-1));
    }
  });

  it('tool-choice: applies the returned choice on every step', async () => {
    const commits = new Map<ParityEngine, number>();
    const results = await expectParity(target, {
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

    for (const engine of ['plain', target] as const) {
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

  it('fires once per iteration and narrows the activeTools handed to the LLM', async () => {
    const tool = createTool({
      id: 'allowedTool',
      description: 'allowed',
      inputSchema: z.object({}),
      execute: async () => 'done',
    });
    const hidden = createTool({
      id: 'hiddenTool',
      description: 'hidden',
      inputSchema: z.object({}),
      execute: async () => 'hidden',
    });

    const prepareStep = vi.fn().mockResolvedValue({ activeTools: ['allowedTool'] });

    const { requests } = await runOnEngine(target, {
      model: { tapes: [toolCallTape('allowedTool', {}, 'call-1'), textOnlyTape('final')] },
      buildAgent: ({ model }) =>
        new Agent({
          id: 'prepare-step-agent',
          name: 'Prepare Step Agent',
          instructions: 'noop',
          model,
          tools: { allowedTool: tool, hiddenTool: hidden },
        }),
      input: 'go',
      options: { prepareStep, maxSteps: 3 },
    });

    // The hook fires once per LLM iteration; we expect 2 LLM calls and 2 fires.
    expect(prepareStep).toHaveBeenCalledTimes(2);
    // Each fire receives a step counter and the running step list.
    const firstArgs = prepareStep.mock.calls[0]![0] as { stepNumber: number };
    const secondArgs = prepareStep.mock.calls[1]![0] as { stepNumber: number };
    expect(firstArgs.stepNumber).toBe(0);
    expect(secondArgs.stepNumber).toBe(1);

    // The narrowed activeTools must actually reach the LLM call.
    expect(requests).toHaveLength(2);
    expect(toolNames(requests[0]!)).toEqual(['allowedTool']);
    expect(toolNames(requests[1]!)).toEqual(['allowedTool']);
  });

  it('stores the prepareStep closure on the run registry, never on workflowInput', async () => {
    const baseAgent = new Agent({
      id: 'prepare-step-prep-agent',
      name: 'Prepare Step Prep Agent',
      instructions: 'noop',
      model: createRecordingModel({ tapes: [textOnlyTape('x')] }).model,
    });
    const wrapper =
      target === 'durable' ? createDurableAgent({ agent: baseAgent }) : createEventedAgent({ agent: baseAgent });
    hosts.push(new Mastra({ agents: { [baseAgent.id]: wrapper }, storage: new InMemoryStore(), logger: false }));

    const prepareStep = vi.fn();
    const { workflowInput, registryEntry } = await wrapper.prepare('hello', { prepareStep });

    expect((workflowInput.options as any).prepareStep).toBeUndefined();
    expect(registryEntry.prepareStep).toBe(prepareStep);
  });

  it('rejects a tool call removed by prepareStep for the current step on every engine', async () => {
    const executeStep = vi.fn(async () => 'step complete');
    const step = createTool({
      id: 'step',
      description: 'Run one step',
      inputSchema: z.object({}),
      execute: executeStep,
    });
    const kept = createTool({
      id: 'kept',
      description: 'A tool kept for the second step',
      inputSchema: z.object({}),
      execute: async () => 'kept',
    });

    const results = await expectParity(target, {
      model: { tapes: [toolCallTape('step', {}, 'call-1'), toolCallTape('step', {}, 'call-2')] },
      buildAgent: ({ model }) =>
        new Agent({
          id: 'prepare-step-tools-agent',
          name: 'Prepare Step Tools Agent',
          instructions: 'Run the requested step',
          model,
          tools: { step, kept },
        }),
      input: 'go',
      options: {
        maxSteps: 2,
        prepareStep: async ({ stepNumber }) => (stepNumber === 1 ? { tools: { kept } } : undefined),
      },
    });

    // Once per engine (plain + target): only the first step's call runs.
    expect(executeStep).toHaveBeenCalledTimes(2);
    for (const engine of ['plain', target] as const) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.toolResults).toEqual([{ toolCallId: 'call-1', toolName: 'step', result: 'step complete' }]);
      expect(turn.chunkTypes).toContain('tool-error');
    }
  });

  it('executes a tool retained by prepareStep for the current step on every engine', async () => {
    const executeStep = vi.fn(async () => 'step complete');
    const step = createTool({
      id: 'step',
      description: 'Run one step',
      inputSchema: z.object({}),
      execute: executeStep,
    });

    const results = await expectParity(target, {
      model: {
        tapes: [toolCallTape('step', {}, 'call-1'), toolCallTape('step', {}, 'call-2'), textOnlyTape('done')],
      },
      buildAgent: ({ model }) =>
        new Agent({
          id: 'prepare-step-retained-tool-agent',
          name: 'Prepare Step Retained Tool Agent',
          instructions: 'Run the requested step',
          model,
          tools: { step },
        }),
      input: 'go',
      options: {
        maxSteps: 3,
        prepareStep: async () => ({ tools: { step } }),
      },
    });

    // Twice per engine (plain + target).
    expect(executeStep).toHaveBeenCalledTimes(4);
    for (const engine of ['plain', target] as const) {
      expect(results[engine]!.turns[0]!.toolResults).toEqual([
        { toolCallId: 'call-1', toolName: 'step', result: 'step complete' },
        { toolCallId: 'call-2', toolName: 'step', result: 'step complete' },
      ]);
    }
  });
});
