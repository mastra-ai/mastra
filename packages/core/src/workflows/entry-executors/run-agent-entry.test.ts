import { describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import { runAgentEntry } from './run-agent-entry';
import type { EntryExecuteContext } from './types';

/**
 * Focused coverage for the legacy watch-event bridge in runAgentEntry:
 * watchers pair `tool-call-streaming-start` with `tool-call-streaming-finish`,
 * so the finish event must be published even when stream iteration rejects.
 */

function makeLegacyAgent(fullStream: AsyncIterable<any>) {
  return {
    name: 'legacy-agent',
    getModel: async () => ({ specificationVersion: 'v1' }),
    streamLegacy: async (_prompt: string, opts: { onFinish?: (result: any) => void }) => {
      // Legacy agents report the final text through onFinish once the stream
      // is fully consumed; the happy-path test triggers it manually.
      void opts;
      return { fullStream };
    },
  };
}

function makeCtx(publish: (topic: string, event: any) => Promise<void>): EntryExecuteContext {
  return {
    inputData: { prompt: 'hi' },
    runId: 'run-1',
    [PUBSUB_SYMBOL]: { publish },
    [STREAM_FORMAT_SYMBOL]: 'legacy',
    requestContext: {},
    abortSignal: new AbortController().signal,
    abort: () => {},
    writer: undefined,
  } as unknown as EntryExecuteContext;
}

function publishedEventTypes(publish: ReturnType<typeof vi.fn>): string[] {
  return publish.mock.calls.map(call => (call[1] as any)?.data?.type);
}

describe('runAgentEntry legacy watch-event bridge', () => {
  it('publishes streaming-finish even when the agent stream rejects mid-iteration', async () => {
    const publish = vi.fn(async () => {});
    const agent = makeLegacyAgent(
      (async function* () {
        yield { type: 'text-delta', textDelta: 'partial' };
        throw new Error('stream blew up');
      })(),
    );

    await expect(
      runAgentEntry({ type: 'agent', id: 'step-1', agentId: 'legacy-agent', agent }, makeCtx(publish)),
    ).rejects.toThrow('stream blew up');

    const types = publishedEventTypes(publish);
    expect(types).toContain('tool-call-streaming-start');
    expect(types).toContain('tool-call-streaming-finish');
    // finish must come after start so watchers never hang open
    expect(types.indexOf('tool-call-streaming-finish')).toBeGreaterThan(types.indexOf('tool-call-streaming-start'));
  });

  it('does not mask the original stream error when the finish publish itself fails', async () => {
    const publish = vi.fn(async (_topic: string, event: any) => {
      if (event?.data?.type === 'tool-call-streaming-finish') {
        throw new Error('pubsub down');
      }
    });
    const agent = makeLegacyAgent(
      (async function* () {
        throw new Error('stream blew up');
      })(),
    );

    await expect(
      runAgentEntry({ type: 'agent', id: 'step-1', agentId: 'legacy-agent', agent }, makeCtx(publish)),
    ).rejects.toThrow('stream blew up');
  });

  it('bridges deltas and completes normally on a healthy stream', async () => {
    const publish = vi.fn(async () => {});
    let onFinish: ((result: any) => void) | undefined;
    const agent = {
      name: 'legacy-agent',
      getModel: async () => ({ specificationVersion: 'v1' }),
      streamLegacy: async (_prompt: string, opts: { onFinish?: (result: any) => void }) => {
        onFinish = opts.onFinish;
        return {
          fullStream: (async function* () {
            yield { type: 'text-delta', textDelta: 'hello' };
            yield { type: 'text-delta', textDelta: ' world' };
            onFinish?.({ text: 'hello world' });
          })(),
        };
      },
    };

    const result = await runAgentEntry(
      { type: 'agent', id: 'step-1', agentId: 'legacy-agent', agent },
      makeCtx(publish),
    );

    expect(result).toEqual({ text: 'hello world' });
    const types = publishedEventTypes(publish);
    expect(types).toEqual([
      'tool-call-streaming-start',
      'tool-call-delta',
      'tool-call-delta',
      'tool-call-streaming-finish',
    ]);
  });
});

/**
 * A v2 agent entry that declares `structuredOutput.schema` must fail closed
 * when the agent finishes without producing an object, instead of silently
 * returning `{ text }` as success (issue #23403).
 */
function makeV2Agent(finish: any) {
  return {
    name: 'v2-agent',
    getModel: async () => ({ specificationVersion: 'v2' }),
    stream: async (_prompt: string, opts: { onFinish?: (result: any) => void }) => {
      return {
        text: Promise.resolve(finish.text ?? ''),
        // handleFinish (the agent's onFinish) is the sole source of truth for
        // the final result; fire it as the stream completes, as the real
        // agent stream does.
        fullStream: (async function* () {
          opts.onFinish?.(finish);
        })(),
      };
    },
  };
}

function makeDefaultCtx(): EntryExecuteContext {
  return {
    inputData: { prompt: 'hi' },
    runId: 'run-1',
    [PUBSUB_SYMBOL]: { publish: async () => {} },
    [STREAM_FORMAT_SYMBOL]: 'default',
    requestContext: {},
    abortSignal: new AbortController().signal,
    abort: () => {},
    writer: undefined,
  } as unknown as EntryExecuteContext;
}

describe('runAgentEntry structured output guard', () => {
  const structuredOptions = { structuredOutput: { schema: { parse: (v: unknown) => v } } };

  it('fails closed when a declared schema produces no object', async () => {
    const agent = makeV2Agent({ text: '', object: undefined, finishReason: 'stop' });

    await expect(
      runAgentEntry(
        { type: 'agent', id: 'step-1', agentId: 'v2-agent', agent, options: structuredOptions },
        makeDefaultCtx(),
      ),
    ).rejects.toMatchObject({ id: 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED' });
  });

  it('carries the finishReason on the thrown error', async () => {
    const agent = makeV2Agent({ text: '', object: undefined, finishReason: 'tool-calls' });

    await runAgentEntry(
      { type: 'agent', id: 'step-1', agentId: 'v2-agent', agent, options: structuredOptions },
      makeDefaultCtx(),
    ).then(
      () => {
        throw new Error('expected runAgentEntry to reject');
      },
      (err: any) => {
        expect(err.id).toBe('STRUCTURED_OUTPUT_OBJECT_UNDEFINED');
        expect(err.details?.finishReason).toBe('tool-calls');
      },
    );
  });

  it('returns a validly-parsed object when one is produced', async () => {
    const agent = makeV2Agent({ text: '{"decisions":["ok"]}', object: { decisions: ['ok'] } });

    const result = await runAgentEntry(
      { type: 'agent', id: 'step-1', agentId: 'v2-agent', agent, options: structuredOptions },
      makeDefaultCtx(),
    );

    expect(result).toEqual({ decisions: ['ok'] });
  });

  it('treats a falsy-but-defined object as produced', async () => {
    const agent = makeV2Agent({ text: '0', object: 0 });

    const result = await runAgentEntry(
      { type: 'agent', id: 'step-1', agentId: 'v2-agent', agent, options: structuredOptions },
      makeDefaultCtx(),
    );

    expect(result).toBe(0);
  });

  it('returns { text } unchanged when no schema is declared', async () => {
    const agent = makeV2Agent({ text: '' });

    const result = await runAgentEntry({ type: 'agent', id: 'step-1', agentId: 'v2-agent', agent }, makeDefaultCtx());

    expect(result).toEqual({ text: '' });
  });
});
