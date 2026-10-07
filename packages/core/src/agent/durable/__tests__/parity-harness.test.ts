/**
 * Self-tests for `expectEngineParity`: it must pass when engines agree, fail
 * loudly (naming engine and field) when they don't, and keep declared
 * differences honest.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { PublicStructuredOutputOptions } from '../../types';
import type {
  CapturedRequest,
  EngineDifference,
  EngineObservation,
  EngineParityScenario,
  EngineRunResult,
  ModelTape,
  ParityEngine,
  ParityStreamOptions,
} from './parity-harness';
import {
  chunksOfType,
  expectEngineParity,
  lastUserText,
  staleKnownDifferences,
  textOnlyTape,
  toolCallTape,
  normalizeRequest,
  normalizePayload,
} from './parity-harness';

function systemText(request: CapturedRequest): string {
  return request.prompt
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n');
}

/** Durable gets different instructions, and the model echoes the system prompt, so durable diverges in text and requests only. */
function divergentScenario(overrides: Partial<EngineParityScenario> = {}): EngineParityScenario {
  return {
    model: { respond: request => textOnlyTape(`system said: ${systemText(request)}`) },
    buildAgent: ({ engine, model }) =>
      new Agent({
        id: 'parity-divergent',
        name: 'Parity Divergent',
        instructions: engine === 'durable' ? 'B' : 'A',
        model,
      }),
    input: 'hello',
    ...overrides,
  };
}

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/**
 * The approval `resumeSchema` every engine now publishes, captured verbatim from
 * plain before the wrapped engines were switched to the shared schema. Pinning
 * the byte-for-byte string is what proves the shared module changed nothing
 * about what plain sends.
 */
const APPROVAL_RESUME_SCHEMA =
  '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"approved":{"type":"boolean","description":"Controls if the tool call is approved or not, should be true when approved and false when declined"},"reason":{"description":"Optional explanation for the decision, surfaced to the model when the tool call is declined","type":"string"}},"required":["approved"],"additionalProperties":false}';

/**
 * A tool that suspends until the caller resumes it, then answers with the
 * resume data. `question` is what the caller is asked, so a scenario can make
 * one engine suspend with a different payload.
 */
function askTool(question: string) {
  return createTool({
    id: 'ask',
    description: 'Ask the caller a question',
    inputSchema: z.object({}),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async (_, context) => {
      if (!context?.agent?.resumeData) return context?.agent?.suspend({ question });
      return context.agent.resumeData;
    },
  });
}

/**
 * Scenario whose only tool suspends, driven on all three engines. `question`
 * lets one scenario make a single engine suspend with a different payload.
 */
function suspendScenario({
  question = () => 'Continue?',
  ...overrides
}: Partial<EngineParityScenario> & { question?: (engine: ParityEngine) => string } = {}): EngineParityScenario {
  return {
    model: { tapes: [toolCallTape('ask', {}), textOnlyTape('Done.')] },
    buildAgent: ({ model, engine }) =>
      new Agent({
        id: 'parity-suspend',
        name: 'Parity Suspend',
        instructions: 'Ask before doing anything',
        model,
        memory: new MockMemory(),
        tools: { ask: askTool(question(engine)) },
      }),
    input: 'Start',
    ...overrides,
  };
}

/**
 * Scenario whose only tool never suspends, so `requireToolApproval` gates it:
 * the run stops at the approval prompt and finishes once approved.
 */
function approvalScenario(overrides: Partial<EngineParityScenario> = {}): EngineParityScenario {
  const gate = createTool({
    id: 'gate',
    description: 'Run once the caller approves',
    inputSchema: z.object({}),
    execute: async () => 'ran',
  });

  return {
    model: { tapes: [toolCallTape('gate', {}), textOnlyTape('Done.')] },
    buildAgent: ({ model }) =>
      new Agent({
        id: 'parity-approval',
        name: 'Parity Approval',
        instructions: 'Ask before doing anything',
        model,
        memory: new MockMemory(),
        tools: { gate },
      }),
    input: 'Start',
    ...overrides,
  };
}

describe('expectEngineParity', () => {
  it('passes when all three engines produce the same text-only output', async () => {
    const results = await expectEngineParity({
      model: { tapes: [textOnlyTape('Hello.')] },
      buildAgent: ({ model }) => new Agent({ id: 'parity-self-text', name: 'Self Text', instructions: 'Hi', model }),
      input: 'Say hello',
    });

    for (const engine of ENGINES) {
      const result = results[engine]!;
      expect(result.turns).toHaveLength(1);
      expect(result.turns[0]!.text).toBe('Hello.');
      // Guards against a vacuous pass on empty streams.
      expect(result.turns[0]!.chunks).toContain('AGENT:text-delta');
      expect(result.requests).toHaveLength(1);
    }
  });

  it('passes when all three engines run a tool call and continue to text', async () => {
    const echo = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `echo:${value}`,
    });

    const results = await expectEngineParity({
      model: { tapes: [toolCallTape('echo', { value: 'hi' }), textOnlyTape('Echoed: hi')] },
      buildAgent: ({ model }) =>
        new Agent({ id: 'parity-self-tool', name: 'Self Tool', instructions: 'Use echo', model, tools: { echo } }),
      input: 'echo hi',
      options: { maxSteps: 2 },
    });

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.toolCalls).toEqual([{ toolCallId: 'parity-call-1', toolName: 'echo', args: { value: 'hi' } }]);
      expect(turn.toolResults).toEqual([{ toolCallId: 'parity-call-1', toolName: 'echo', result: 'echo:hi' }]);
      expect(turn.text).toBe('Echoed: hi');
      expect(results[engine]!.requests).toHaveLength(2);
    }
  });

  it('carries the model-reported providerExecuted value onto the tool-result chunk', async () => {
    const echo = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `echo:${value}`,
    });

    const results = await expectEngineParity({
      model: { tapes: [toolCallTape('echo', { value: 'hi' }), textOnlyTape('Echoed: hi')] },
      buildAgent: ({ model }) =>
        new Agent({
          id: 'parity-provider-executed',
          name: 'Provider Executed',
          instructions: 'Use echo',
          model,
          tools: { echo },
        }),
      input: 'echo hi',
      options: { maxSteps: 2 },
    });

    // `toolCallTape` reports `providerExecuted: false` on the tool call, so a
    // consumer reading the tool-result chunk must see the same value on every
    // engine. Durable and evented used to hand-build that payload without the
    // field, leaving it `undefined` where plain echoed the model's value.
    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(chunksOfType(turn, 'tool-result')).toBe(1);
      const payload = turn.chunkPayloads[turn.chunkTypes.indexOf('tool-result')] as Record<string, unknown>;
      expect(payload.providerExecuted).toBe(false);
    }
  });

  it('fails when an engine emits the same tool calls in a different order', async () => {
    const tool = (id: string) =>
      createTool({ id, description: id, inputSchema: z.object({}), execute: async () => `${id} done` });
    const twoToolCalls = (order: string[]) => [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'parity-id-tool', modelId: 'parity-model', timestamp: new Date(0) },
      ...order.map(toolName => ({
        type: 'tool-call',
        toolCallId: `call-${toolName}`,
        toolName,
        input: '{}',
        providerExecuted: false,
      })),
      { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
    ];
    // The script cannot see the engine, so durable's model reverses the tool calls.
    let reversed = false;

    const error = await expectEngineParity({
      model: {
        respond: (_request, callIndex) =>
          callIndex === 0 ? twoToolCalls(reversed ? ['second', 'first'] : ['first', 'second']) : textOnlyTape('Done.'),
      },
      buildAgent: ({ engine, model }) => {
        reversed = engine === 'durable';
        return new Agent({
          id: 'parity-tool-order',
          name: 'Tool Order',
          instructions: 'Use both tools',
          model,
          tools: { first: tool('first'), second: tool('second') },
        });
      },
      input: 'use both',
      options: { maxSteps: 2 },
    }).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('durable differs from plain at turns[0].chunks');
    expect(message).toContain('AGENT:tool-call:first');
    expect(message).not.toContain('evented differs');
  });

  it('fails when an engine sends different tool-call arguments', async () => {
    const echo = createTool({
      id: 'echo',
      description: 'Echo the input',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => `echo:${value}`,
    });
    // The script cannot see the engine, so durable's args differ from plain's.
    let args = { value: 'hi' };

    const error = await expectEngineParity({
      model: { respond: () => toolCallTape('echo', args) },
      buildAgent: ({ engine, model }) => {
        args = { value: engine === 'durable' ? 'bye' : 'hi' };
        return new Agent({
          id: 'parity-tool-args',
          name: 'Tool Args',
          instructions: 'Use echo',
          model,
          tools: { echo },
        });
      },
      input: 'echo hi',
      options: { maxSteps: 1 },
    }).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('durable differs from plain at turns[0].chunkPayloads[2].args.value');
    expect(message).not.toContain('evented differs from plain at turns[0].chunkPayloads[2]');
  });

  it('fails when an engine streams different step-finish content', async () => {
    // The script cannot see the engine, so durable answers with different text,
    // which lands in the step-finish chunk's payload as well as the stream.
    let text = 'Hello.';

    const error = await expectEngineParity({
      model: { respond: () => textOnlyTape(text) },
      buildAgent: ({ engine, model }) => {
        text = engine === 'durable' ? 'Diverged.' : 'Hello.';
        return new Agent({ id: 'parity-step-finish', name: 'Step Finish', instructions: 'Answer', model });
      },
      input: 'Hi',
    }).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    const blocks = message.split('\n\n');
    const durableBlock = blocks.filter(block => block.startsWith('durable ')).join('\n');
    const eventedBlock = blocks.filter(block => block.startsWith('evented ')).join('\n');
    // Chunk payload contents are compared, not just their type labels.
    expect(durableBlock).toContain('turns[0].chunkPayloads[3].text');
    expect(durableBlock).toContain('Diverged.');
    // The step-finish paths declared under COR-1390 are excused, and only those:
    // the same payload's other fields would still be reported above.
    expect(durableBlock).not.toContain('chunkPayloads[5].output.text');
    // Evented streams plain's text, so the divergence stays durable-only.
    expect(eventedBlock).not.toContain('Diverged.');
  });

  it('records one request per model call with the prompt sent', async () => {
    const results = await expectEngineParity({
      model: { respond: request => textOnlyTape(`answer to: ${lastUserText(request)}`) },
      buildAgent: ({ model }) =>
        new Agent({ id: 'parity-self-requests', name: 'Self Requests', instructions: 'Be brief', model }),
      run: async handle => {
        await handle.turn('first');
        await handle.turn('second');
      },
    });

    for (const engine of ENGINES) {
      const { requests, turns } = results[engine]!;
      expect(requests).toHaveLength(2);
      expect(requests.map(lastUserText)).toEqual(['first', 'second']);
      expect(requests.map(systemText)).toEqual(['Be brief', 'Be brief']);
      expect(turns.map(t => t.text)).toEqual(['answer to: first', 'answer to: second']);
    }
  });

  it('fails, naming the engine and field, when an engine diverges', async () => {
    const error = await expectEngineParity(divergentScenario()).then(
      () => undefined,
      (e: Error) => e,
    );

    expect(error?.message).toContain('durable differs from plain at turns[0].text');
    expect(error?.message).toContain('expected: "system said: A"');
    expect(error?.message).toContain('actual:   "system said: B"');
    expect(error?.message).toContain('durable differs from plain at requests[0].prompt[0].content');
    expect(error?.message).not.toContain('evented differs');
  });

  it('passes a divergence declared with ignored fields and a reason', async () => {
    await expectEngineParity(
      divergentScenario({
        differences: {
          durable: {
            reason: 'self-test: durable uses other instructions',
            // The answer text reaches the caller through the stream, the chunk
            // payloads and `getFullOutput`, so all of them are declared.
            ignore: ['text', 'streamedText', 'fullOutput', 'chunkPayloads', 'requests'],
          },
        },
      }),
    );
  });

  it('passes a divergence declared as an expected observation', async () => {
    await expectEngineParity(
      divergentScenario({
        differences: {
          durable: {
            reason: 'self-test: durable uses other instructions',
            ignore: ['chunkPayloads', 'requests'],
            expect: plain => ({
              ...plain,
              turns: plain.turns.map(t => ({
                ...t,
                text: 'system said: B',
                streamedText: 'system said: B',
                fullOutput: { ...t.fullOutput, text: 'system said: B' },
              })),
            }),
          },
        },
      }),
    );
  });

  it('fails when an engine does not match its declared expectation', async () => {
    await expect(
      expectEngineParity(
        divergentScenario({
          differences: {
            durable: {
              reason: 'self-test',
              ignore: ['requests'],
              expect: plain => ({
                ...plain,
                turns: plain.turns.map(t => ({
                  ...t,
                  text: 'system said: C',
                  streamedText: 'system said: C',
                  fullOutput: { ...t.fullOutput, text: 'system said: C' },
                })),
              }),
            },
          },
        }),
      ),
    ).rejects.toThrow('durable differs from its declared expectation at turns[0].text');
  });

  it('fails when a declared difference no longer reproduces', async () => {
    await expect(
      expectEngineParity({
        model: { tapes: [textOnlyTape('same')] },
        buildAgent: ({ model }) => new Agent({ id: 'parity-self-stale', name: 'Self Stale', instructions: 'A', model }),
        input: 'hello',
        differences: { evented: { reason: 'self-test: fixed long ago', ignore: ['text'] } },
      }),
    ).rejects.toThrow(/evented: declared difference no longer reproduces[\s\S]*ignored field 'text' matches plain/);
  });

  it('fails when a declared difference has no reason', async () => {
    await expect(
      expectEngineParity(
        divergentScenario({ differences: { durable: { reason: ' ', ignore: ['text', 'streamedText', 'requests'] } } }),
      ),
    ).rejects.toThrow('durable: declared difference has no reason');
  });

  it('fails when the evented agent falls back to the default engine', async () => {
    await expect(
      expectEngineParity({
        model: { tapes: [textOnlyTape('Hello.')] },
        buildAgent: ({ model }) =>
          new Agent({ id: 'parity-self-fallback', name: 'Self Fallback', instructions: 'Hi', model }),
        input: 'Say hello',
        createStorage: () => {
          const storage = new InMemoryStore();
          vi.spyOn(storage.stores.workflows as any, 'supportsConcurrentUpdates').mockReturnValue(false);
          return storage;
        },
      }),
    ).rejects.toThrow("evented agent resolved to the 'default' engine");
  });

  it('flags a declared chunk difference once it stops reproducing', async () => {
    const results = await expectEngineParity({
      model: { tapes: [textOnlyTape('hi')] },
      buildAgent: ({ model }) => new Agent({ id: 'parity-stale-builtin', name: 'P', instructions: 'x', model }),
      input: 'hi',
    });
    const observe = (r: EngineRunResult) => structuredClone({ turns: r.turns, requests: r.requests });
    // These three read only `turns`, so they accept what `observe` returns.
    const finishIndex = (r: EngineObservation) => r.turns[0]!.chunkTypes.indexOf('finish');
    const stepStartIndex = (r: EngineObservation) => r.turns[0]!.chunkTypes.indexOf('step-start');
    const payloadAt = (r: EngineObservation, index: number) =>
      r.turns[0]!.chunkPayloads[index] as Record<string, unknown>;

    expect(staleKnownDifferences('durable', observe(results.plain!), observe(results.durable!))).toEqual([]);

    // A wrapped engine emits a key plain emits: the declaration cannot hold.
    const fixedOnDurable = observe(results.durable!);
    payloadAt(fixedOnDurable, finishIndex(fixedOnDurable)).messageId = 'parity-message-1';
    expect(staleKnownDifferences('durable', observe(results.plain!), fixedOnDurable)).toEqual([
      "durable: turns[0] finish payload now includes 'messageId'; remove it from KNOWN_CHUNK_DIFFERENCES (COR-1390)",
    ]);

    // Plain stops emitting the keys the wrapped engines are declared to omit.
    const plainWithoutEnvelope = observe(results.plain!);
    for (const key of ['messageId', 'messages', 'metadata', 'processorRetryCount', 'response']) {
      delete payloadAt(plainWithoutEnvelope, finishIndex(plainWithoutEnvelope))[key];
    }
    expect(staleKnownDifferences('durable', plainWithoutEnvelope, observe(results.durable!))).toEqual([
      "durable: plain's finish payload no longer includes any of messageId, messages, metadata, " +
        'processorRetryCount, response; update KNOWN_CHUNK_DIFFERENCES (COR-1390)',
    ]);

    // A declared path starts matching: the difference is fixed.
    const matchedOnPlain = observe(results.plain!);
    payloadAt(matchedOnPlain, stepStartIndex(matchedOnPlain)).stepId = 'durable-llm-execution';
    expect(staleKnownDifferences('durable', matchedOnPlain, observe(results.durable!))).toEqual([
      "durable: turns[0] step-start payload 'stepId' no longer differs from plain; " +
        'remove it from KNOWN_CHUNK_DIFFERENCES (COR-1390)',
      'durable: the declared step-start chunk difference no longer reproduces; ' +
        'remove it from KNOWN_CHUNK_DIFFERENCES (COR-1390)',
    ]);

    // A declared path disappears from both engines: nothing left to declare.
    const stepIdsGone = [observe(results.plain!), observe(results.durable!)];
    for (const observation of stepIdsGone) delete payloadAt(observation, stepStartIndex(observation)).stepId;
    expect(staleKnownDifferences('durable', stepIdsGone[0]!, stepIdsGone[1]!)).toEqual([
      'durable: the declared step-start chunk difference no longer reproduces; ' +
        'remove it from KNOWN_CHUNK_DIFFERENCES (COR-1390)',
    ]);
  });

  it('flags the resumed-tool-call difference once it stops reproducing', async () => {
    const results = await expectEngineParity(
      approvalScenario({
        model: { tapes: [toolCallTape('gate', {}), textOnlyTape('Done.')] },
        options: {
          maxSteps: 3,
          requireToolApproval: true,
          memory: { thread: 'parity-approval-stale-thread', resource: 'parity-approval-stale-resource' },
          resume: { approve: true },
        },
      }),
    );
    const observe = (r: EngineRunResult): EngineObservation =>
      structuredClone({ turns: r.turns, requests: r.requests });
    const approvalPayload = (r: EngineObservation) =>
      r.turns[0]!.chunkPayloads[r.turns[0]!.chunkTypes.indexOf('tool-call-approval')] as Record<string, unknown>;

    // Every engine publishes the same approval schema, and the only difference
    // left to declare in this scenario is the resumed output's missing tool call.
    expect(approvalPayload(observe(results.durable!)).resumeSchema).toBe(
      approvalPayload(observe(results.plain!)).resumeSchema,
    );
    expect(staleKnownDifferences('durable', observe(results.plain!), observe(results.durable!))).toEqual([]);

    // The wrapped engine keeps the suspended tool call in its resumed output.
    const callsFixed = observe(results.durable!);
    callsFixed.turns[0]!.toolCalls = observe(results.plain!).turns[0]!.toolCalls;
    expect(staleKnownDifferences('durable', observe(results.plain!), callsFixed)).toEqual([
      'durable: the declared toolCalls difference no longer reproduces; ' +
        'remove it from KNOWN_TURN_DIFFERENCES (COR-1398)',
    ]);
  });

  it('fails when part of a declared expectation no longer differs from plain', async () => {
    await expect(
      expectEngineParity(
        divergentScenario({
          differences: {
            durable: {
              reason: 'self-test',
              ignore: ['text', 'streamedText', 'fullOutput', 'requests'],
              expect: plain => ({ ...plain, turns: plain.turns.map(t => ({ ...t, stepCount: 99 })) }),
            },
          },
        }),
      ),
    ).rejects.toThrow('durable: declared expectation at turns[0].stepCount no longer differs from plain');
  });

  it('still compares fields a declared expectation leaves out', async () => {
    await expect(
      expectEngineParity(
        divergentScenario({
          differences: {
            durable: {
              reason: 'self-test',
              ignore: ['requests'],
              expect: plain => ({
                ...plain,
                turns: plain.turns.map(t => ({ text: 'system said: B', streamedText: 'system said: B' }) as any),
              }),
            },
          },
        }),
      ),
    ).rejects.toThrow('durable differs from its declared expectation at turns[0].chunks');
  });

  it('refuses scenarios that would compare nothing', async () => {
    const base = {
      model: { tapes: [textOnlyTape('hi')] },
      buildAgent: ({ model }: { model: any }) =>
        new Agent({ id: 'parity-vacuous', name: 'P', instructions: 'x', model }),
      input: 'hi',
    };
    const misuse = 'engines must list "plain" and at least one other engine, each once';
    await expect(expectEngineParity({ ...base, engines: ['plain'] })).rejects.toThrow(misuse);
    await expect(expectEngineParity({ ...base, engines: ['plain', 'durable', 'durable'] })).rejects.toThrow(misuse);
    await expect(expectEngineParity({ ...base, run: async () => {} })).rejects.toThrow(
      'the scenario produced no turns or no stream chunks on plain',
    );
  });

  /**
   * A model that streams a little text and then fails. The engine surfaces the
   * failure one way or another — an `error` chunk, a rejecting stream — and
   * either way the turn is recorded and compared.
   */
  function failingTape(message: string): ModelTape {
    return [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'before the failure' },
      { type: 'error', error: new Error(message) },
    ];
  }

  function failingScenario(overrides: Partial<EngineParityScenario> = {}): EngineParityScenario {
    return {
      model: { respond: () => failingTape('scripted model failure') },
      buildAgent: ({ model }) =>
        new Agent({ id: 'parity-failing', name: 'Parity Failing', instructions: 'Be brief', model }),
      input: 'fail',
      ...overrides,
    };
  }

  it('records a run that fails mid-stream and compares it', async () => {
    // The failure is compared rather than thrown out of the scenario. The
    // wrapped engines re-emit the failure's chunks from workflow state, and the
    // only payload difference left is the `type` key plain keeps on its error
    // chunk, which `KNOWN_CHUNK_DIFFERENCES` declares — so the payloads are not
    // ignored here, they are compared.
    const results = await expectEngineParity(failingScenario());

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      // The chunks streamed before the failure are kept, so the turn is not empty.
      expect(turn.chunks).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:text-start',
        'AGENT:text-delta',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.streamedText).toBe('before the failure');
      // `toStrictEqual` so a `stack` recorded as `undefined` would still fail: the
      // contract is exactly name and message.
      expect(turn.error).toStrictEqual({ name: 'Error', message: 'scripted model failure' });

      // Every engine hands the same failure on, read the same way: plain sends
      // the live `Error`, the wrapped engines its serialised form, and both
      // compare as name and message. A `stack` — which would carry this
      // machine's checkout path — is stripped on both.
      const errorPayload = (turn.chunkPayloads[turn.chunks.indexOf('AGENT:error')] as { error?: unknown }).error;
      expect(errorPayload).toStrictEqual({ name: 'Error', message: 'scripted model failure' });
    }
  });

  it('compares the error when engines fail mid-stream with different messages', async () => {
    const scenario = failingScenario({
      model: { respond: request => failingTape(`failed: ${systemText(request)}`) },
      buildAgent: ({ engine, model }) =>
        new Agent({
          id: 'parity-failing',
          name: 'Parity Failing',
          instructions: engine === 'durable' ? 'B' : 'A',
          model,
        }),
      engines: ['plain', 'durable'],
    });

    await expect(expectEngineParity(scenario)).rejects.toThrow(
      /durable differs from plain at turns\[0\]\.error\.message/,
    );

    // The failure is compared twice over — as `turn.error` and inside the error
    // chunk's own payload. Declaring the first away must not make the second
    // pass, or restoring `ignore: ['chunkPayloads']` on failed runs would leave
    // this test green.
    await expect(
      expectEngineParity({
        ...scenario,
        differences: {
          durable: { reason: 'self-test: compare the payload alone', ignore: ['error'] },
        },
      }),
    ).rejects.toThrow(
      /durable differs from its declared expectation at turns\[0\]\.chunkPayloads\[\d+\]\.error\.message/,
    );
  });

  it('records a run whose stream() rejects before it streams anything', async () => {
    const scenario = failingScenario({
      model: { tapes: [textOnlyTape('never sent')] },
      buildAgent: ({ model }) => new Agent({ id: 'parity-invalid-timeout', name: 'P', instructions: 'x', model }),
      options: { modelSettings: { timeout: { stepMs: -1 } } },
    });

    // The run produced no chunks at all, so it only clears the
    // "compared nothing on plain" guard because its error was recorded.
    //
    // The one difference left is the failure's class, and it is a real one, not
    // a recording artifact: `stream()` rejects before the model is called, and
    // plain surfaces the plain `Error` the argument validation raises while the
    // wrapped engines surface a `TypeError` for the same input and the same
    // message. The declaration is narrowed to `error` alone — the assertions
    // below still compare both classes and the message.
    const preStreamClassReason =
      'pre-stream rejection: same message, but plain reports `Error` where the wrapped engines report `TypeError`';
    const results = await expectEngineParity({
      ...scenario,
      differences: {
        durable: { reason: preStreamClassReason, ignore: ['error'] },
        evented: { reason: preStreamClassReason, ignore: ['error'] },
      },
    });

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.chunks).toEqual([]);
      // Same message on every engine; only the class differs. Asserted here for
      // each engine rather than for plain and durable alone, so the declaration
      // above cannot hide an evented that drifts to another message or class.
      expect(turn.error?.message).toBe(results.plain!.turns[0]!.error?.message);
      expect(turn.error).toStrictEqual({
        name: engine === 'plain' ? 'Error' : 'TypeError',
        message: turn.error!.message,
      });
      // Rejected before the model was ever called on any engine.
      expect(results[engine]!.requests).toHaveLength(0);
    }
    // And the message is the settings validation's, not something else that
    // happens to match across engines.
    expect(results.plain!.turns[0]!.error?.message).toMatch(/modelSettings\.timeout/);

    await expect(expectEngineParity(scenario)).rejects.toThrow(/durable differs from plain at turns\[0\]\.error\.name/);
  });

  const FLAT_SCHEMA = z.object({ reply: z.string(), number: z.number() });
  const PARSED = { reply: 'hi', number: 7 };

  /**
   * The two ways the wrapped engines' structured-output chunks differ from
   * plain's (both COR-1390, both pre-existing): they emit `object-result` after
   * `step-finish` and `finish` rather than before them, and their `step-finish`
   * payload does not carry the parsed object. Declaring both as the expectation
   * keeps every parsed value itself compared.
   */
  function declareWrappedObjectChunks(plain: EngineObservation): EngineObservation {
    return {
      requests: plain.requests,
      turns: plain.turns.map(turn => {
        const objectIndex = turn.chunkTypes.indexOf('object-result');
        if (objectIndex < 0) return turn;
        const move = <T>(list: T[]): T[] => [
          ...list.slice(0, objectIndex),
          ...list.slice(objectIndex + 1),
          list[objectIndex]!,
        ];
        const chunkTypes = move(turn.chunkTypes);
        const chunkPayloads = move(turn.chunkPayloads);
        const stepFinish = chunkTypes.indexOf('step-finish');
        const payload = chunkPayloads[stepFinish] as { output?: Record<string, unknown> } | undefined;
        if (payload?.output && 'object' in payload.output) {
          const output = { ...payload.output };
          delete output.object;
          chunkPayloads[stepFinish] = { ...payload, output };
        }
        return { ...turn, chunks: move(turn.chunks), chunkTypes, chunkPayloads };
      }),
    };
  }

  const DECLARE_OBJECT_CHUNKS = {
    durable: {
      reason: 'COR-1390: wrapped engines emit object-result last and omit the parsed object from step-finish',
      expect: declareWrappedObjectChunks,
    },
    evented: {
      reason: 'COR-1390: wrapped engines emit object-result last and omit the parsed object from step-finish',
      expect: declareWrappedObjectChunks,
    },
  };

  function structuredScenario(overrides: Partial<EngineParityScenario> = {}): EngineParityScenario {
    return {
      model: { respond: () => textOnlyTape(JSON.stringify(PARSED)) },
      buildAgent: ({ model }) =>
        new Agent({ id: 'parity-structured', name: 'Parity Structured', instructions: 'Be brief', model }),
      input: 'structured',
      // Plain and durable declare `structuredOutput` differently, which is why
      // the harness leaves it out of `ParityStreamOptions`: a scenario that needs
      // it widens the option type where it builds them.
      options: { structuredOutput: { schema: FLAT_SCHEMA } } as ParityStreamOptions & {
        structuredOutput?: PublicStructuredOutputOptions<any>;
      },
      ...overrides,
    };
  }

  it('records the structured output a run parsed, and compares it', async () => {
    const results = await expectEngineParity(structuredScenario({ differences: DECLARE_OBJECT_CHUNKS }));

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.fullOutput.object).toEqual(PARSED);

      const index = turn.chunkTypes.indexOf('object-result');
      expect(index).toBeGreaterThanOrEqual(0);
      // The parsed value rides the chunk itself, not its payload, so recording
      // the payload alone would have thrown the value away.
      expect(turn.chunkPayloads[index]).toEqual({ object: PARSED });
      expect(turn.chunkPayloads[turn.chunkTypes.indexOf('object')]).toEqual({ object: PARSED });
    }

    // The order difference the declaration above covers is real, on both sides.
    const plainTypes = results.plain!.turns[0]!.chunkTypes;
    expect(plainTypes.indexOf('object-result')).toBeLessThan(plainTypes.indexOf('step-finish'));
    expect(results.durable!.turns[0]!.chunkTypes.at(-1)).toBe('object-result');
  });

  it('fails when engines parse different objects', async () => {
    const error = await expectEngineParity(
      structuredScenario({
        // The model answers with its instructions, which is the only lever a
        // scenario has to make one engine parse a different object.
        model: { respond: request => textOnlyTape(JSON.stringify({ reply: systemText(request), number: 7 })) },
        buildAgent: ({ engine, model }) =>
          new Agent({
            id: 'parity-structured',
            name: 'Parity Structured',
            instructions: engine === 'durable' ? 'B' : 'A',
            model,
          }),
        engines: ['plain', 'durable'],
        differences: {
          durable: DECLARE_OBJECT_CHUNKS.durable,
        },
      }),
    ).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    // Both places the parsed value is recorded report the divergence: the
    // structured-output chunk's payload and `getFullOutput()`.
    expect(message).toMatch(/chunkPayloads\[\d+\]\.object\.reply/);
    expect(message).toMatch(/fullOutput\.object\.reply/);
    expect(message).toContain('"B"');
  });

  function generateScenario(overrides: Partial<EngineParityScenario> = {}): EngineParityScenario {
    return {
      model: { tapes: [textOnlyTape('Generated.')] },
      buildAgent: ({ model }) =>
        new Agent({ id: 'parity-generate', name: 'Parity Generate', instructions: 'Be brief', model }),
      run: async handle => {
        await handle.generate('generate this');
      },
      ...overrides,
    };
  }

  it('runs a generate() turn on all three engines and compares it', async () => {
    const results = await expectEngineParity(generateScenario());

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      // A generate call has no stream, so the turn is compared through the
      // output the caller receives rather than through chunks.
      expect(turn.generate).toBe(true);
      expect(turn.chunks).toEqual([]);
      expect(turn.text).toBe('Generated.');
      expect(turn.fullOutput.text).toBe('Generated.');
      expect(turn.fullOutput.finishReason).toBe('stop');
      expect(turn.usage).toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });

      // The request the model received is what makes a generate turn comparable
      // at all: it is the only thing both engines must have sent identically.
      expect(results[engine]!.requests).toHaveLength(1);
      expect(lastUserText(results[engine]!.requests[0]!)).toBe('generate this');
    }
  });

  it('fails when engines generate different text', async () => {
    const error = await expectEngineParity(
      generateScenario({
        buildAgent: ({ engine, model }) =>
          new Agent({
            id: 'parity-generate',
            name: 'Parity Generate',
            instructions: engine === 'durable' ? 'B' : 'A',
            model,
          }),
        model: { respond: request => textOnlyTape(`Generated by ${systemText(request)}.`) },
        engines: ['plain', 'durable'],
      }),
    ).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('durable differs from plain at turns[0].text');
  });

  it('records a generate() call that rejects', async () => {
    // Without `maxRetries: 0` the model call is retried, which is a retry-policy
    // difference the failed-run case is not about.
    const stopRetrying = async (handle: { generate: (m: string, o?: ParityStreamOptions) => Promise<unknown> }) => {
      await handle.generate('generate this', { modelSettings: { maxRetries: 0 } } as ParityStreamOptions);
    };
    const cases = [
      {
        name: 'Error',
        message: 'scripted generate failure',
        scenario: generateScenario({
          model: {
            respond: () => {
              throw new Error('scripted generate failure');
            },
          },
          run: stopRetrying,
        }),
      },
      {
        // A tape that ends in an error part fails a streaming run, so it fails a
        // generate call too rather than reporting a success the run never had.
        name: 'Error',
        message: 'scripted tape failure',
        scenario: generateScenario({
          model: { tapes: [failingTape('scripted tape failure')] },
          run: stopRetrying,
        }),
      },
      {
        // The same tape with the failure in the serialised shape the wrapped
        // engines hand back: it keeps its name and message instead of collapsing
        // to `'[object Object]'` on the way out.
        name: 'TypeError',
        message: 'scripted serialised failure',
        scenario: generateScenario({
          model: {
            tapes: [
              [
                { type: 'stream-start', warnings: [] },
                { type: 'error', error: { name: 'TypeError', message: 'scripted serialised failure' } },
              ] as ModelTape,
            ],
          },
          run: stopRetrying,
        }),
      },
    ];

    for (const { name, message, scenario } of cases) {
      const results = await expectEngineParity(scenario);

      for (const engine of ENGINES) {
        const turn = results[engine]!.turns[0]!;
        // A rejected generate() is an observation, not a reason to abort: the
        // same failure on every engine is parity.
        expect(turn.generate).toBe(true);
        expect(turn.error).toStrictEqual({ name, message });
        // The request is still recorded, so a failure does not hide what was sent.
        expect(results[engine]!.requests).toHaveLength(1);
      }
    }
  });

  /**
   * One deferred tool call, then text. The tool is eligible and the agent
   * defers it, so it only runs in the background when the host manages tasks
   * and its workers are up — which is what `host` turns on. `executions` counts
   * how many times the tool really ran on each engine, which the assertions use
   * because plain's loop does not wait for the background run here.
   */
  function backgroundScenario(
    overrides: Partial<EngineParityScenario> = {},
    executions?: Partial<Record<ParityEngine, number>>,
  ): EngineParityScenario {
    return {
      model: { tapes: [toolCallTape('research', { topic: 'AI' }), textOnlyTape('Done.')] },
      buildAgent: ({ engine, model }) =>
        new Agent({
          id: 'parity-background',
          name: 'Parity Background',
          instructions: 'Be brief',
          model,
          tools: {
            research: createTool({
              id: 'research',
              description: 'Research a topic',
              inputSchema: z.object({ topic: z.string() }),
              execute: async ({ topic }) => {
                if (executions) executions[engine] = (executions[engine] ?? 0) + 1;
                return { summary: `Research on ${topic}` };
              },
              background: { enabled: true },
            }),
          },
          backgroundTasks: { tools: { research: true } },
        }),
      input: 'Research AI',
      options: { maxSteps: 3 },
      ...overrides,
    };
  }

  it('dispatches a deferred tool in the background when the scenario enables it, and not otherwise', async () => {
    // A deferred dispatch is only comparable with the chunk and result fields
    // declared: the wrapped engines stream an extra `background-task-progress`
    // and flush the completed result after `step-finish`, where plain keeps the
    // dispatch placeholder.
    const difference: EngineDifference = {
      reason:
        'COR-1390: wrapped engines stream background-task-progress and flush the completed result after step-finish ' +
        'where plain keeps the placeholder; taskId is a per-engine stubbed UUID.',
      ignore: ['chunks', 'chunkTypes', 'chunkPayloads', 'toolResults', 'requests', 'finishChunk'],
    };
    const withHostExecutions: Partial<Record<ParityEngine, number>> = {};
    const withHost = await expectEngineParity(
      backgroundScenario(
        {
          host: { backgroundTasks: { enabled: true } },
          differences: { durable: difference, evented: difference },
        },
        withHostExecutions,
      ),
    );

    for (const engine of ENGINES) {
      const turn = withHost[engine]!.turns[0]!;
      // The task finishes before the loop's wait step arms, so no
      // `background-task-completed` chunk is emitted on any engine: the proof a
      // dispatch really went to the background is this `-started` chunk plus the
      // result shape below, not a wait for completion.
      expect(turn.chunkTypes).toContain('background-task-started');
      expect(turn.text).toBe('Done.');
      if (engine === 'plain') {
        // Plain hands the model the dispatch placeholder and keeps going.
        expect(turn.toolResults[0]!.result).toEqual(expect.stringContaining('running in the background'));
      } else {
        expect(turn.toolResults).toEqual([
          { toolCallId: 'parity-call-1', toolName: 'research', result: { summary: 'Research on AI' } },
        ]);
      }
      // The tool itself ran on every engine, so the dispatch above really
      // executed — including plain, whose loop moves on without waiting for it.
      expect(withHostExecutions[engine]).toBe(1);
    }

    // Without the host the same script degrades to a foreground call, so the
    // scenario above would pass vacuously. This pins that.
    const withoutHostExecutions: Partial<Record<ParityEngine, number>> = {};
    const withoutHost = await expectEngineParity(backgroundScenario({}, withoutHostExecutions));

    for (const engine of ENGINES) {
      const turn = withoutHost[engine]!.turns[0]!;
      expect(turn.chunkTypes.filter(t => t.startsWith('background-task'))).toEqual([]);
      expect(turn.chunks).toContain('AGENT:tool-result:research');
      expect(turn.text).toBe('Done.');
      expect(withoutHostExecutions[engine]).toBe(1);
    }
  });

  it('normalizes only message createdAt stamps and an unset includeRawChunks', () => {
    const stamped = (createdAt: number) => ({ mastra: { createdAt, keep: 1 } });
    const request = (createdAt: number, includeRawChunks?: boolean, toolOutput: unknown = 'out'): CapturedRequest =>
      ({
        ...(includeRawChunks === undefined ? {} : { includeRawChunks }),
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'hi', providerOptions: stamped(createdAt) }],
            providerOptions: stamped(createdAt),
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'c',
                toolName: 't',
                output: { type: 'json', value: toolOutput as any },
              },
            ],
          },
        ],
      }) as CapturedRequest;

    expect(normalizeRequest(request(1, false))).toEqual(normalizeRequest(request(2)));
    expect(normalizeRequest(request(1, true))).not.toEqual(normalizeRequest(request(1)));
    // createdAt inside content the model sees is real data, not a Mastra stamp.
    const nested = (createdAt: number) => ({ providerOptions: { mastra: { createdAt } } });
    expect(normalizeRequest(request(1, false, nested(1)))).not.toEqual(normalizeRequest(request(1, false, nested(2))));
  });

  it('drops an error stack but keeps a stack an application owns', () => {
    // An `error` chunk's payload is the failure itself, and the stack it carries
    // embeds the absolute checkout path: dropped where the payload is known to
    // be a failure.
    expect(
      normalizePayload({ error: { name: 'Error', message: 'boom', stack: 'at /checkout/src/x.ts:1' } }, [], true),
    ).toEqual({ error: { name: 'Error', message: 'boom' } });

    // Everywhere else a `stack` is the application's data. Dropping it by key
    // name would have made the two cases below compare equal.
    const result = { name: 'deployment', message: 'ready', stack: ['a', 'b'] };
    expect(normalizePayload(result)).toEqual(result);
    expect(normalizePayload({ stack: 'a' })).not.toEqual(normalizePayload({ stack: 'b' }));
  });

  it('reads a live Error as the name and message a serialised one carries', () => {
    // Plain hands a failure on as the `Error` itself; the wrapped engines hand
    // on `{ name, message, stack }`. Both have to record the same thing, or the
    // failure this harness now compares is a recording artifact rather than an
    // engine difference.
    const thrown = new Error('boom');
    const serialised = { name: 'Error', message: 'boom', stack: thrown.stack };

    expect(normalizePayload(thrown)).toEqual({ name: 'Error', message: 'boom' });
    expect(normalizePayload(thrown, [], true)).toEqual(normalizePayload(serialised, [], true));
    // The class is compared too, so a `TypeError` never passes for an `Error`.
    expect(normalizePayload(new TypeError('boom'))).toEqual({ name: 'TypeError', message: 'boom' });

    // Reading name and message must not cost the properties an application put
    // on the error: those are enumerable, so they used to be recorded, and two
    // errors differing only in one of them have to stay different.
    const coded = Object.assign(new Error('boom'), { code: 'ETIMEDOUT' });
    expect(normalizePayload(coded)).toEqual({ name: 'Error', message: 'boom', code: 'ETIMEDOUT' });
    expect(normalizePayload(coded)).not.toEqual(normalizePayload(Object.assign(new Error('boom'), { code: 'OTHER' })));

    // Following those properties has to stay cycle-safe: the error itself joins
    // the ancestry before they are read, so an error that carries itself is
    // recorded once rather than recursed into forever.
    const selfReferential = Object.assign(new Error('boom'), { cause: undefined as unknown });
    selfReferential.cause = selfReferential;
    expect(normalizePayload(selfReferential)).toEqual({ name: 'Error', message: 'boom', cause: '[circular]' });
  });

  it('runs a suspension and a resume on all three engines', async () => {
    const results = await expectEngineParity(
      suspendScenario({
        options: {
          maxSteps: 3,
          memory: { thread: 'parity-suspend-thread', resource: 'parity-suspend-resource' },
          resume: { resumeData: { approved: true } },
        },
      }),
    );

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      // The turn covers both streams: up to the suspension, then the resume.
      expect(turn.chunks).toContain('AGENT:tool-call-suspended:ask');
      expect(turn.chunks).toContain('AGENT:tool-call-resumed:ask');
      expect(turn.chunks).toContain('AGENT:tool-result:ask');
      expect(turn.chunks).toContain('AGENT:finish');
      expect(turn.text).toBe('Done.');
      expect(turn.toolResults).toEqual([{ toolCallId: 'parity-call-1', toolName: 'ask', result: { approved: true } }]);
      expect(results[engine]!.requests.length).toBe(2);
    }
  });

  it('fails with the tool call when a suspended turn has no resume', async () => {
    await expect(
      expectEngineParity(
        suspendScenario({
          options: {
            maxSteps: 3,
            memory: { thread: 'parity-unresumed-thread', resource: 'parity-unresumed-resource' },
          },
        }),
      ),
    ).rejects.toThrow('add a `resume` continuation');
  });

  it('runs an approval on all three engines', async () => {
    const results = await expectEngineParity(
      approvalScenario({
        model: { tapes: [toolCallTape('gate', {}), textOnlyTape('Done.')] },
        options: {
          maxSteps: 3,
          requireToolApproval: true,
          memory: { thread: 'parity-approval-thread', resource: 'parity-approval-resource' },
          resume: { approve: true },
        },
      }),
    );

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      for (const ct of ['tool-call-approval', 'tool-call-resumed']) {
        const payload = turn.chunkPayloads[turn.chunkTypes.indexOf(ct)] as { resumeSchema: string };
        expect(payload.resumeSchema).toBe(APPROVAL_RESUME_SCHEMA);
      }
      expect(turn.chunks).toContain('AGENT:tool-call-approval:gate');
      expect(turn.chunks).toContain('AGENT:finish');
      expect(turn.chunks).not.toContain('AGENT:tool-call-suspended:gate');
      expect(turn.text).toBe('Done.');
      expect(turn.toolResults).toEqual([{ toolCallId: 'parity-call-1', toolName: 'gate', result: 'ran' }]);
      expect(results[engine]!.requests.length).toBe(2);
    }
  });

  it('fails when an engine suspends with a different payload', async () => {
    const error = await expectEngineParity(
      suspendScenario({
        question: engine => (engine === 'durable' ? 'Durable?' : 'Continue?'),
        options: {
          maxSteps: 3,
          memory: { thread: 'parity-suspend-divergent-thread', resource: 'parity-suspend-resource' },
          resume: { resumeData: { approved: true } },
        },
      }),
    ).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('durable differs from plain at turns[0].chunkPayloads');
    expect(message).toContain('.suspendPayload.question:');
    expect(message).toContain('Durable?');
    // Only durable suspended with a different payload; evented's line is for the
    // resumed-output divergence, not the suspension.
    const eventedLines = message.split('\n').filter(line => line.startsWith('evented differs'));
    expect(eventedLines.join('\n')).not.toContain('suspendPayload');
  });
});
