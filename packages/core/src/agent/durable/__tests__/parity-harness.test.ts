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
    // wrapped engines re-emit the failure's chunks from workflow state with
    // slimmer payloads (an error chunk that keeps the error but loses `type`,
    // and an error-path `step-finish` that loses `messages`), so the payloads
    // are left out of this comparison and pinned explicitly below instead.
    const results = await expectEngineParity(
      failingScenario({
        differences: {
          durable: { reason: 'self-test: re-emitted failure payloads', ignore: ['chunkPayloads'] },
          evented: { reason: 'self-test: re-emitted failure payloads', ignore: ['chunkPayloads'] },
        },
      }),
    );

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
      expect(turn.error).toEqual({ name: 'Error', message: 'scripted model failure' });

      // The wrapped engines re-emit the error as a plain object; plain keeps the
      // raw `Error`, whose name and message are not enumerable properties. Either
      // way a `stack` — which would carry this machine's checkout path — is
      // stripped before anything is compared.
      const errorPayload = (turn.chunkPayloads[turn.chunks.indexOf('AGENT:error')] as { error?: unknown }).error;
      expect(errorPayload).toEqual(engine === 'plain' ? {} : { name: 'Error', message: 'scripted model failure' });
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
  });

  it('records a run whose stream() rejects before it streams anything', async () => {
    const scenario = failingScenario({
      model: { tapes: [textOnlyTape('never sent')] },
      buildAgent: ({ model }) => new Agent({ id: 'parity-invalid-timeout', name: 'P', instructions: 'x', model }),
      options: { modelSettings: { timeout: { stepMs: -1 } } },
    });

    // The run produced no chunks at all, so it only clears the
    // "compared nothing on plain" guard because its error was recorded.
    const results = await expectEngineParity({
      ...scenario,
      differences: {
        durable: { reason: 'self-test: the wrapped engines reject with a TypeError', ignore: ['error'] },
        evented: { reason: 'self-test: the wrapped engines reject with a TypeError', ignore: ['error'] },
      },
    });

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;
      expect(turn.chunks).toEqual([]);
      expect(turn.error?.message).toMatch(/modelSettings\.timeout/);
      // Rejected before the model was ever called on any engine.
      expect(results[engine]!.requests).toHaveLength(0);
    }
    // Both engines report the same message; they disagree on the class because
    // plain surfaces a plain `Error` where the wrapped engines surface the
    // `TypeError` the settings validation actually throws.
    expect(results.durable!.turns[0]!.error?.message).toBe(results.plain!.turns[0]!.error?.message);
    expect(results.plain!.turns[0]!.error).toMatchObject({ name: 'Error' });
    expect(results.durable!.turns[0]!.error).toMatchObject({ name: 'TypeError' });

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
