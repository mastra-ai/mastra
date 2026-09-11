import { describe, expect, it } from 'vitest';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { createStep } from './workflow';

/**
 * `@mastra/core/workflows/evented` ships its own `createStep(agent)` factory
 * (issue #23403 leftover). Unlike the default factory, it does not go through
 * `runAgentEntry`, so a declared `structuredOutput.schema` must still fail
 * closed here when the agent finishes without an object.
 */

function makeV2Agent(finish: { text?: string; object?: unknown; finishReason?: string; usage?: unknown }) {
  return {
    id: 'evented-agent',
    name: 'evented-agent',
    getDescription: () => 'evented-agent',
    getModel: async () => ({ specificationVersion: 'v2' }),
    hasOwnMemory: () => false,
    __setMemory: () => {},
    getMemory: async () => undefined,
    getInstructions: () => 'test',
    generate: async () => ({ text: finish.text ?? '' }),
    resumeGenerate: async () => ({}),
    resumeStream: async () => ({}),
    stream: async (_prompt: string, opts: { onFinish?: (result: any) => void }) => {
      return {
        text: Promise.resolve(finish.text ?? ''),
        fullStream: (async function* () {
          opts.onFinish?.(finish);
        })(),
      };
    },
  };
}

function makeCtx() {
  return {
    inputData: { prompt: 'hi' },
    runId: 'run-1',
    mastra: { getLogger: () => undefined },
    [PUBSUB_SYMBOL]: { publish: async () => {} },
    [STREAM_FORMAT_SYMBOL]: 'vnext',
    requestContext: {},
    abortSignal: new AbortController().signal,
    abort: () => ({ aborted: true }),
    writer: undefined,
  } as any;
}

describe('evented createStep(agent) structured output guard', () => {
  const structuredOptions = { structuredOutput: { schema: { parse: (v: unknown) => v } } };

  it('fails closed when a declared schema produces no object', async () => {
    const step = createStep(makeV2Agent({ text: '', object: undefined, finishReason: 'stop' }), structuredOptions);

    await expect(step.execute(makeCtx())).rejects.toMatchObject({ id: 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED' });
  });

  it('carries the finishReason and usage on the thrown error', async () => {
    const usage = { totalTokens: 42, inputTokens: 10, outputTokens: 32 };
    const step = createStep(
      makeV2Agent({ text: '', object: undefined, finishReason: 'tool-calls', usage }),
      structuredOptions,
    );

    await step.execute(makeCtx()).then(
      () => {
        throw new Error('expected evented createStep(agent) to reject');
      },
      (err: any) => {
        expect(err.id).toBe('STRUCTURED_OUTPUT_OBJECT_UNDEFINED');
        expect(err.details?.finishReason).toBe('tool-calls');
        expect(err.details?.usage).toEqual(usage);
      },
    );
  });

  it('returns a validly-parsed object when one is produced', async () => {
    const step = createStep(
      makeV2Agent({ text: '{"decisions":["ok"]}', object: { decisions: ['ok'] } }),
      structuredOptions,
    );

    await expect(step.execute(makeCtx())).resolves.toEqual({ decisions: ['ok'] });
  });

  it('treats a falsy-but-defined object as produced', async () => {
    const step = createStep(makeV2Agent({ text: '0', object: 0 }), structuredOptions);

    await expect(step.execute(makeCtx())).resolves.toBe(0);
  });

  it('returns { text } unchanged when no schema is declared', async () => {
    const step = createStep(makeV2Agent({ text: '' }));

    await expect(step.execute(makeCtx())).resolves.toEqual({ text: '' });
  });
});
