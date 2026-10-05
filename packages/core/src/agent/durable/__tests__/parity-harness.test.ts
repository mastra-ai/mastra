/**
 * Self-tests for `expectEngineParity`: it must pass when engines agree, fail
 * loudly (naming engine and field) when they don't, and keep declared
 * differences honest.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineParityScenario, EngineRunResult, ParityEngine } from './parity-harness';
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
            ignore: ['text', 'streamedText', 'fullOutput', 'requests'],
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
            ignore: ['requests'],
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

  it('flags the built-in finish-key difference once it stops reproducing on either side', async () => {
    const results = await expectEngineParity({
      model: { tapes: [textOnlyTape('hi')] },
      buildAgent: ({ model }) => new Agent({ id: 'parity-stale-builtin', name: 'P', instructions: 'x', model }),
      input: 'hi',
    });
    const observe = (r: EngineRunResult) => structuredClone({ turns: r.turns, requests: r.requests });
    expect(staleKnownDifferences('durable', observe(results.plain!), observe(results.durable!))).toEqual([]);

    const fixedOnDurable = observe(results.durable!);
    fixedOnDurable.turns[0]!.finishChunk.payloadKeys.push('messageId');
    expect(staleKnownDifferences('durable', observe(results.plain!), fixedOnDurable)).toEqual([
      'durable: turns[0] finish payload now includes messageId; remove them from FINISH_KEYS_MISSING_ON_WRAPPED_ENGINES',
    ]);

    const droppedOnPlain = observe(results.plain!);
    droppedOnPlain.turns[0]!.finishChunk.payloadKeys = ['output', 'stepResult'];
    expect(staleKnownDifferences('durable', droppedOnPlain, observe(results.durable!))).toEqual([
      "durable: turns[0] plain's finish payload has none of FINISH_KEYS_MISSING_ON_WRAPPED_ENGINES; update it",
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
});
