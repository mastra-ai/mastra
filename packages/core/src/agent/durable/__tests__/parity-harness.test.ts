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
import type {
  CapturedRequest,
  EngineObservation,
  EngineParityScenario,
  EngineRunResult,
  ParityEngine,
} from './parity-harness';
import {
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
    const finishIndex = (r: EngineRunResult) => r.turns[0]!.chunkTypes.indexOf('finish');
    const stepStartIndex = (r: EngineRunResult) => r.turns[0]!.chunkTypes.indexOf('step-start');
    const payloadAt = (r: EngineRunResult, index: number) =>
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

  it('flags the approved-schema and resumed-tool-call differences once they stop reproducing', async () => {
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

    expect(staleKnownDifferences('durable', observe(results.plain!), observe(results.durable!))).toEqual([]);

    // The wrapped engine serialises the approval schema the way plain does.
    const schemaFixed = observe(results.durable!);
    approvalPayload(schemaFixed).resumeSchema = approvalPayload(observe(results.plain!)).resumeSchema;
    expect(staleKnownDifferences('durable', observe(results.plain!), schemaFixed)).toEqual([
      "durable: turns[0] tool-call-approval payload 'resumeSchema' no longer differs from plain; " +
        'remove it from KNOWN_CHUNK_DIFFERENCES (COR-1399)',
      'durable: the declared tool-call-approval chunk difference no longer reproduces; ' +
        'remove it from KNOWN_CHUNK_DIFFERENCES (COR-1399)',
    ]);

    // The wrapped engine keeps the suspended tool call in its resumed output.
    const callsFixed = observe(results.durable!);
    callsFixed.turns[0]!.toolCalls = observe(results.plain!).turns[0]!.toolCalls;
    expect(staleKnownDifferences('durable', observe(results.plain!), callsFixed)).toEqual([
      'durable: the declared toolCalls difference no longer reproduces; ' +
        'remove it from KNOWN_TURN_DIFFERENCES (COR-1398)',
    ]);

    // Matching schemas are tolerated outside the approval flow because the
    // declaration is scoped to it, not because the value is ignored everywhere.
    const suspended = [observe(results.plain!), observe(results.durable!)];
    for (const observation of suspended) observation.turns[0]!.approvalSuspended = false;
    approvalPayload(suspended[1]!).resumeSchema = approvalPayload(suspended[0]!).resumeSchema;
    expect(staleKnownDifferences('durable', suspended[0]!, suspended[1]!)).toEqual([]);
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
