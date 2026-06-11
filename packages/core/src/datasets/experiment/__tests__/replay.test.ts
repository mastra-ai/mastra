import { describe, it, expect, vi } from 'vitest';
import { RETHROWN_TOOL_ERROR_NAMES } from '../../../loop/workflows/errors';
import { SpanType } from '../../../observability';
import type { SpanRecord } from '../../../storage/domains/observability/tracing';
import type { ToolHookContext } from '../../../tools/types';
import { extractToolReplayEvents, createReplayState, buildReplayHooks, finalizeReplayReport } from '../replay';

const TRACE_ID = 'trace-1';

function makeSpan(partial: Partial<SpanRecord> & { spanId: string }): SpanRecord {
  return {
    traceId: TRACE_ID,
    name: `tool: '${partial.entityName ?? 'unknown'}'`,
    spanType: SpanType.TOOL_CALL,
    isEvent: false,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    // Completed by default — extraction skips un-ended (in-flight) spans.
    endedAt: new Date('2026-01-01T00:00:01Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as SpanRecord;
}

function toolSpan(spanId: string, toolName: string, startedAtMs: number, extra: Partial<SpanRecord> = {}): SpanRecord {
  return makeSpan({
    spanId,
    entityId: toolName,
    entityName: toolName,
    startedAt: new Date(startedAtMs),
    ...extra,
  });
}

function callHook(
  hooks: ReturnType<typeof buildReplayHooks>,
  toolName: string,
  input: unknown,
): ReturnType<NonNullable<(typeof hooks)['beforeToolCall']>> {
  const context: ToolHookContext = { toolName, input, context: {} };
  return hooks.beforeToolCall!(context);
}

describe('extractToolReplayEvents', () => {
  it('returns tool events ordered by startedAt regardless of array order', () => {
    const events = extractToolReplayEvents([
      toolSpan('s2', 'lookup', 2000, { input: { key: 'second' } }),
      toolSpan('s1', 'lookup', 1000, { input: { key: 'first' } }),
      toolSpan('s3', 'send', 3000, { input: { to: 'a' } }),
    ]);

    expect(events.map(e => [e.toolName, e.sequence])).toEqual([
      ['lookup', 0],
      ['lookup', 1],
      ['send', 2],
    ]);
    expect(events[0]!.input).toEqual({ key: 'first' });
  });

  it('breaks startedAt ties deterministically by spanId regardless of adapter order', () => {
    const tied = [
      toolSpan('span-b', 'lookup', 1000, { input: { key: 'b' } }),
      toolSpan('span-a', 'lookup', 1000, { input: { key: 'a' } }),
    ];

    const forward = extractToolReplayEvents(tied);
    const reversed = extractToolReplayEvents([...tied].reverse());

    expect(forward.map(e => e.spanId)).toEqual(['span-a', 'span-b']);
    expect(reversed.map(e => e.spanId)).toEqual(['span-a', 'span-b']);
  });

  it('excludes non-tool spans and event spans, includes MCP tool spans', () => {
    const events = extractToolReplayEvents([
      makeSpan({ spanId: 'root', spanType: SpanType.AGENT_RUN, entityName: 'my-agent' }),
      makeSpan({ spanId: 'model', spanType: SpanType.MODEL_GENERATION, parentSpanId: 'root' }),
      toolSpan('t1', 'lookup', 1000, { parentSpanId: 'root' }),
      toolSpan('t2', 'mcp-search', 2000, { parentSpanId: 'root', spanType: SpanType.MCP_TOOL_CALL }),
      toolSpan('ev', 'lookup', 3000, { parentSpanId: 'root', isEvent: true }),
    ]);

    expect(events.map(e => e.toolName)).toEqual(['lookup', 'mcp-search']);
  });

  it('excludes nested tool spans run inside a sub-agent (agent-as-tool)', () => {
    const events = extractToolReplayEvents([
      makeSpan({ spanId: 'root', spanType: SpanType.AGENT_RUN, entityName: 'parent-agent' }),
      // top-level call to the sub-agent tool
      toolSpan('agent-tool', 'subAgentTool', 1000, { parentSpanId: 'root' }),
      // the sub-agent's own run + its internal tool call — must NOT be replayable
      makeSpan({ spanId: 'sub-run', spanType: SpanType.AGENT_RUN, parentSpanId: 'agent-tool' }),
      toolSpan('inner', 'innerTool', 1500, { parentSpanId: 'sub-run' }),
      // sibling top-level tool call
      toolSpan('t2', 'lookup', 2000, { parentSpanId: 'root' }),
    ]);

    expect(events.map(e => e.toolName)).toEqual(['subAgentTool', 'lookup']);
  });

  it('tolerates parentSpanId cycles without hanging', () => {
    const events = extractToolReplayEvents([
      toolSpan('a', 'lookup', 1000, { parentSpanId: 'b' }),
      makeSpan({ spanId: 'b', spanType: SpanType.AGENT_RUN, parentSpanId: 'a' }),
    ]);

    expect(events.map(e => e.toolName)).toEqual(['lookup']);
  });

  it('skips tool spans without an entity name or id', () => {
    const events = extractToolReplayEvents([
      makeSpan({ spanId: 'anon', entityId: null, entityName: null, startedAt: new Date(1000) }),
      toolSpan('t1', 'lookup', 2000),
    ]);

    expect(events.map(e => e.toolName)).toEqual(['lookup']);
  });

  it('falls back to entityId when entityName is an empty string', () => {
    const events = extractToolReplayEvents([
      makeSpan({ spanId: 'named-by-id', entityId: 'lookup', entityName: '', startedAt: new Date(1000) }),
    ]);

    expect(events.map(e => e.toolName)).toEqual(['lookup']);
  });

  it('skips un-ended spans — a crashed or in-flight recording must not replay empty outputs', () => {
    const events = extractToolReplayEvents([
      // Exporters persist span creates immediately; a crash before SPAN_ENDED
      // leaves endedAt null and output null.
      toolSpan('in-flight', 'lookup', 1000, { endedAt: null, output: null }),
      toolSpan('done', 'lookup', 2000, { output: { value: 'ok' } }),
    ]);

    expect(events.map(e => e.spanId)).toEqual(['done']);
  });

  it('skips synthetic spans flagged toolReplay.synthetic — a replay run trace can never serve as a recording', () => {
    // The agent's hook wrapper records these for short-circuited (replayed or
    // mocked) calls; they represent served recordings, not executions.
    const events = extractToolReplayEvents([
      toolSpan('synth-1', 'lookup', 1000, {
        output: { value: 'served-from-recording' },
        metadata: { toolReplay: { synthetic: true, outcome: 'replayed', sequence: 0 } },
      }),
      toolSpan('synth-2', 'lookup', 2000, {
        output: { value: 'served-from-mock' },
        metadata: { toolReplay: { synthetic: true, outcome: 'mocked' } },
      }),
    ]);

    expect(events).toEqual([]);
  });

  it('keeps real spans in a mixed trace — only synthetic-flagged ones are dropped', () => {
    const events = extractToolReplayEvents([
      toolSpan('real-1', 'lookup', 1000, { output: { value: 'live:first' } }),
      toolSpan('synth', 'lookup', 2000, {
        output: { value: 'served' },
        metadata: { toolReplay: { synthetic: true, outcome: 'replayed', sequence: 0 } },
      }),
      toolSpan('real-2', 'send', 3000, { output: { sent: true } }),
    ]);

    expect(events.map(e => [e.spanId, e.toolName, e.sequence])).toEqual([
      ['real-1', 'lookup', 0],
      ['real-2', 'send', 1],
    ]);
  });

  it('extracts spans whose metadata only resembles the synthetic marker — exact shape required', () => {
    // metadata is user-writable: anything that isn't the exact marker shape
    // (object metadata.toolReplay with synthetic === true) stays extractable.
    const events = extractToolReplayEvents([
      toolSpan('m1', 'lookup', 1000, { output: 1, metadata: { toolReplay: 'user junk' } }),
      toolSpan('m2', 'lookup', 2000, { output: 2, metadata: { toolReplay: { synthetic: 'true' } } }),
      toolSpan('m3', 'lookup', 3000, { output: 3, metadata: { synthetic: true } }),
      toolSpan('m4', 'lookup', 4000, { output: 4, metadata: { toolReplay: { synthetic: false } } }),
      toolSpan('m5', 'lookup', 5000, { output: 5, metadata: null }),
    ]);

    expect(events.map(e => e.spanId)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
  });

  it('counts recorded payloads carrying the sensitive-data redaction marker', () => {
    const events = extractToolReplayEvents([
      toolSpan('r1', 'auth', 1000, { input: { apiKey: '[REDACTED]' }, output: { ok: true } }),
      toolSpan('r2', 'auth', 2000, { input: { q: 'safe' }, output: { token: '[REDACTED]', ttl: 60 } }),
      toolSpan('r3', 'auth', 3000, { input: { q: 'safe' }, output: { ok: true } }),
    ]);
    const state = createReplayState(events, TRACE_ID);

    expect(finalizeReplayReport(state).redactedPayloadCount).toBe(2);

    const clean = createReplayState(extractToolReplayEvents([toolSpan('c1', 'auth', 1000, { output: 1 })]), TRACE_ID);
    expect(finalizeReplayReport(clean).redactedPayloadCount).toBeUndefined();
  });

  it('normalizes recorded errors from string and object shapes', () => {
    const events = extractToolReplayEvents([
      toolSpan('e1', 'flaky', 1000, { error: 'boom' }),
      toolSpan('e2', 'flaky', 2000, { error: { name: 'TimeoutError', message: 'timed out' } }),
      toolSpan('ok', 'flaky', 3000, { output: { ok: true } }),
    ]);

    expect(events[0]!.error).toEqual({ message: 'boom' });
    expect(events[1]!.error).toEqual({ name: 'TimeoutError', message: 'timed out' });
    expect(events[2]!.error).toBeNull();
  });

  it('degrades gracefully when a recorded error cannot be serialized', () => {
    const circular: Record<string, unknown> = { name: 'WeirdError' };
    circular.self = circular;

    const events = extractToolReplayEvents([
      toolSpan('e1', 'flaky', 1000, { error: circular }),
      toolSpan('e2', 'flaky', 2000, { error: { code: 42n as unknown } }),
    ]);

    expect(events[0]!.error).toEqual({ name: 'WeirdError', message: 'Unknown tool error' });
    expect(events[1]!.error).toEqual({ message: 'Unknown tool error' });
  });
});

describe('buildReplayHooks', () => {
  const recordedEvents = () =>
    extractToolReplayEvents([
      toolSpan('s1', 'lookup', 1000, { input: { key: 'first' }, output: { value: 'one' } }),
      toolSpan('s2', 'lookup', 2000, { input: { key: 'second' }, output: { value: 'two' } }),
      toolSpan('s3', 'send', 3000, { input: { to: 'a' }, output: { sent: true } }),
    ]);

  it('replays repeated same-tool calls in FIFO order', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'lookup', { key: 'first' })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });
    expect(await callHook(hooks, 'lookup', { key: 'second' })).toEqual({
      proceed: false,
      output: { value: 'two' },
      spanMetadata: { outcome: 'replayed', sequence: 1 },
    });

    const report = finalizeReplayReport(state);
    expect(report.replayedCount).toBe(2);
    expect(report.argMismatches).toEqual([]);
    expect(report.unconsumed).toEqual([{ toolName: 'send', count: 1 }]);
  });

  it('is order-independent across different tools', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // Agent calls 'send' before 'lookup' — opposite of the recorded order
    expect(await callHook(hooks, 'send', { to: 'a' })).toEqual({
      proceed: false,
      output: { sent: true },
      spanMetadata: { outcome: 'replayed', sequence: 2 },
    });
    expect(await callHook(hooks, 'lookup', { key: 'first' })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });

    expect(finalizeReplayReport(state).misses).toEqual([]);
  });

  it('flags arg mismatches but still replays', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'lookup', { key: 'DIFFERENT' })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });

    const report = finalizeReplayReport(state);
    expect(report.replayedCount).toBe(1);
    expect(report.argMismatches).toEqual([{ toolName: 'lookup', sequence: 0, spanId: 's1' }]);
  });

  it('ignores nullish runtime-injected override keys when diagnosing arg drift', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // The tool builder splices _background/suspendedToolRunId/resumeData into
    // every tool's args schema; models emit them as nulls and capture points
    // differ on their presence. Same semantic question → no mismatch.
    expect(
      await callHook(hooks, 'lookup', { key: 'first', _background: null, suspendedToolRunId: null, resumeData: null }),
    ).toEqual({ proceed: false, output: { value: 'one' }, spanMetadata: { outcome: 'replayed', sequence: 0 } });

    expect(finalizeReplayReport(state).argMismatches).toEqual([]);
  });

  it('still flags a mismatch when an injected override key carries a real value', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // _background: true changes execution semantics — that is a real drift.
    expect(await callHook(hooks, 'lookup', { key: 'first', _background: true })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });

    expect(finalizeReplayReport(state).argMismatches).toEqual([{ toolName: 'lookup', sequence: 0, spanId: 's1' }]);
  });

  it('re-throws recorded errors so the agent sees the same failure', async () => {
    const events = extractToolReplayEvents([
      toolSpan('e1', 'flaky', 1000, { error: { name: 'TimeoutError', message: 'timed out' } }),
    ]);
    const state = createReplayState(events, TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await expect(callHook(hooks, 'flaky', {})).rejects.toThrowError(
      expect.objectContaining({ name: 'TimeoutError', message: 'timed out' }),
    );
    expect(finalizeReplayReport(state).replayedCount).toBe(1);
  });

  it('never reuses error names the tool-call step re-throws', async () => {
    for (const rethrownName of RETHROWN_TOOL_ERROR_NAMES) {
      const events = extractToolReplayEvents([
        toolSpan('e1', 'guarded', 1000, { error: { name: rethrownName, message: 'denied' } }),
      ]);
      const state = createReplayState(events, TRACE_ID);
      const hooks = buildReplayHooks(state, { onMiss: 'error' });

      await expect(callHook(hooks, 'guarded', {})).rejects.toThrowError(
        expect.objectContaining({ name: 'Error', message: 'denied' }),
      );
    }
  });

  it('onMiss passthrough lets the call proceed and records the miss', async () => {
    const state = createReplayState([], TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'passthrough' });

    expect(await callHook(hooks, 'lookup', { key: 'x' })).toBeUndefined();

    const report = finalizeReplayReport(state);
    expect(report.misses).toEqual([{ toolName: 'lookup', action: 'passthrough', input: { key: 'x' } }]);
    expect(report.replayedCount).toBe(0);
  });

  it('stays in parity with Agent.formatTools for every name shape it normalizes', async () => {
    // formatToolName mirrors the agent's private formatTools — if the agent's
    // rules ever change without this module following, every affected tool
    // silently stops matching its queue. This test pins the two together.
    const { Agent } = await import('../../../agent');
    const agent = new Agent({
      id: 'parity-agent',
      name: 'Parity Agent',
      instructions: 'n/a',
      model: {} as never,
    });
    const formatViaAgent = (name: string): string => {
      const tools: Record<string, { execute: () => void }> = { [name]: { execute: () => {} } };
      (agent as unknown as { formatTools: (t: typeof tools) => typeof tools }).formatTools(tools);
      return Object.keys(tools)[0]!;
    };

    const shapes = ['plain_tool', 'my.namespaced.tool', '1starts-with-digit', 'has spaces & chars!', 'x'.repeat(80)];
    for (const name of shapes) {
      const agentFormatted = formatViaAgent(name);
      const events = extractToolReplayEvents([toolSpan('p1', name, 1000, { output: { ok: true } })]);
      const state = createReplayState(events, TRACE_ID);
      const hooks = buildReplayHooks(state, { onMiss: 'error' });
      expect(await callHook(hooks, agentFormatted, {}), `tool name '${name}' → '${agentFormatted}'`).toEqual({
        proceed: false,
        output: { ok: true },
        spanMetadata: { outcome: 'replayed', sequence: 0 },
      });
    }
  });

  it('matches spans recorded under original tool names against agent-formatted hook names', async () => {
    // Spans record the tool's ORIGINAL name; the hook context carries the
    // agent-formatted name (invalid chars replaced, max 63 chars) — see
    // Agent.formatTools. Both sides must normalize identically.
    const events = extractToolReplayEvents([
      toolSpan('s1', 'my.namespaced.tool', 1000, { input: { a: 1 }, output: { ok: 1 } }),
      toolSpan('s2', '1starts-with-digit', 2000, { input: { a: 2 }, output: { ok: 2 } }),
    ]);
    const state = createReplayState(events, TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'my_namespaced_tool', { a: 1 })).toEqual({
      proceed: false,
      output: { ok: 1 },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });
    expect(await callHook(hooks, '_1starts-with-digit', { a: 2 })).toEqual({
      proceed: false,
      output: { ok: 2 },
      spanMetadata: { outcome: 'replayed', sequence: 1 },
    });
    expect(finalizeReplayReport(state).misses).toEqual([]);
  });

  it('onMiss error throws an abort-style error and notifies onFatalMiss', async () => {
    const state = createReplayState([], TRACE_ID);
    const onFatalMiss = vi.fn();
    const hooks = buildReplayHooks(state, { onMiss: 'error', onFatalMiss });

    await expect(callHook(hooks, 'lookup', { key: 'x' })).rejects.toThrowError(/aborted/);
    expect(onFatalMiss).toHaveBeenCalledTimes(1);
    expect(finalizeReplayReport(state).misses).toEqual([{ toolName: 'lookup', action: 'error', input: { key: 'x' } }]);
  });
});

describe('strict matching', () => {
  const recordedEvents = () =>
    extractToolReplayEvents([
      toolSpan('s1', 'lookup', 1000, { input: { key: 'first' }, output: { value: 'one' } }),
      toolSpan('s2', 'lookup', 2000, { input: { key: 'second' }, output: { value: 'two' } }),
    ]);

  it('serves events by exact args regardless of call order', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID, { matching: 'strict' });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // Calls arrive in the opposite of recorded order — strict matches by args.
    expect(await callHook(hooks, 'lookup', { key: 'second' })).toEqual({
      proceed: false,
      output: { value: 'two' },
      spanMetadata: { outcome: 'replayed', sequence: 1 },
    });
    expect(await callHook(hooks, 'lookup', { key: 'first' })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });

    const report = finalizeReplayReport(state);
    expect(report.replayedCount).toBe(2);
    expect(report.misses).toEqual([]);
    expect(report.argMismatches).toEqual([]);
  });

  it('treats different args as a miss instead of re-pairing — argMismatches stays empty', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID, { matching: 'strict' });
    const onFatalMiss = vi.fn();
    const hooks = buildReplayHooks(state, { onMiss: 'error', onFatalMiss });

    await expect(callHook(hooks, 'lookup', { key: 'DIFFERENT' })).rejects.toThrowError(/matching args/);

    const report = finalizeReplayReport(state);
    expect(report.argMismatches).toEqual([]);
    expect(report.misses).toEqual([{ toolName: 'lookup', action: 'error', input: { key: 'DIFFERENT' } }]);
    expect(onFatalMiss).toHaveBeenCalledTimes(1);
  });

  it('ignores nullish runtime-injected keys in strict comparison too', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID, { matching: 'strict' });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'lookup', { key: 'first', _background: null })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });
  });

  it('consumes identical-args duplicates in recorded order', async () => {
    const events = extractToolReplayEvents([
      toolSpan('d1', 'lookup', 1000, { input: { key: 'same' }, output: { value: 'first-recorded' } }),
      toolSpan('d2', 'lookup', 2000, { input: { key: 'same' }, output: { value: 'second-recorded' } }),
    ]);
    const state = createReplayState(events, TRACE_ID, { matching: 'strict' });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'lookup', { key: 'same' })).toEqual({
      proceed: false,
      output: { value: 'first-recorded' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });
    expect(await callHook(hooks, 'lookup', { key: 'same' })).toEqual({
      proceed: false,
      output: { value: 'second-recorded' },
      spanMetadata: { outcome: 'replayed', sequence: 1 },
    });
  });
});

describe('tool mocks', () => {
  const recordedEvents = () =>
    extractToolReplayEvents([toolSpan('s1', 'lookup', 1000, { input: { key: 'first' }, output: { value: 'one' } })]);

  it('static output stub takes precedence over the replay queue', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID, {
      mocks: { lookup: { output: { value: 'stubbed' } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'lookup', { key: 'first' })).toEqual({
      proceed: false,
      output: { value: 'stubbed' },
      spanMetadata: { outcome: 'mocked' },
    });

    const report = finalizeReplayReport(state);
    // The recorded event was never consumed — the mock answered instead.
    expect(report.unconsumed).toEqual([{ toolName: 'lookup', count: 1 }]);
    expect(report.mocks).toEqual([{ toolName: 'lookup', calls: 1, kind: 'output' }]);
  });

  it('error mock injects the failure and respects the rethrown-name guard', async () => {
    const state = createReplayState([], TRACE_ID, {
      replayActive: false,
      mocks: { flaky: { error: { name: 'TimeoutError', message: 'injected timeout' } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await expect(callHook(hooks, 'flaky', {})).rejects.toThrowError('injected timeout');
    expect(finalizeReplayReport(state).mocks).toEqual([{ toolName: 'flaky', calls: 1, kind: 'error' }]);
  });

  it('function mock replaces execute and receives input + callIndex', async () => {
    const impl = vi.fn(({ input, callIndex }: { input: unknown; callIndex: number }) => ({
      echoed: input,
      callIndex,
    }));
    const state = createReplayState([], null, { replayActive: false, mocks: { search: impl } });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(await callHook(hooks, 'search', { q: 'a' })).toEqual({
      proceed: false,
      output: { echoed: { q: 'a' }, callIndex: 0 },
      spanMetadata: { outcome: 'mocked' },
    });
    expect(await callHook(hooks, 'search', { q: 'b' })).toEqual({
      proceed: false,
      output: { echoed: { q: 'b' }, callIndex: 1 },
      spanMetadata: { outcome: 'mocked' },
    });
    expect(finalizeReplayReport(state).mocks).toEqual([{ toolName: 'search', calls: 2, kind: 'function' }]);
  });

  it('expect-only mock observes the call and falls through to replay', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID, {
      mocks: { lookup: { expect: { args: { key: 'first' } } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // Falls through: the recorded answer is served, and the call is counted.
    expect(await callHook(hooks, 'lookup', { key: 'first' })).toEqual({
      proceed: false,
      output: { value: 'one' },
      spanMetadata: { outcome: 'replayed', sequence: 0 },
    });

    const report = finalizeReplayReport(state);
    expect(report.mocks).toEqual([{ toolName: 'lookup', calls: 1, kind: 'observe' }]);
    expect(report.expectations).toEqual([{ toolName: 'lookup', satisfied: true, calledTimes: 1 }]);
  });

  it('mock-only runs let unmocked tools execute live', async () => {
    const state = createReplayState([], null, { replayActive: false, mocks: { other: { output: 1 } } });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // No mock, no replay source → undefined = proceed with live execution.
    expect(await callHook(hooks, 'unmocked', {})).toBeUndefined();
    expect(finalizeReplayReport(state).misses).toEqual([]);
  });

  it('evaluates expectations: arg-filtered counts, calledTimes, and never-called', async () => {
    const state = createReplayState([], null, {
      replayActive: false,
      mocks: {
        priority: { output: { ok: true }, expect: { args: { level: 'high' }, calledTimes: 1 } },
        forbidden: { output: { ok: true }, expect: { calledTimes: 0 } },
        required: { output: { ok: true }, expect: {} },
      },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await callHook(hooks, 'priority', { level: 'low' }); // wrong args — doesn't count
    await callHook(hooks, 'priority', { level: 'high' }); // counts

    const report = finalizeReplayReport(state);
    expect(report.expectations).toEqual([
      { toolName: 'priority', satisfied: true, calledTimes: 1 },
      { toolName: 'forbidden', satisfied: true, calledTimes: 0 },
      {
        toolName: 'required',
        satisfied: false,
        calledTimes: 0,
        reason: 'expected at least one call, got 0',
      },
    ]);
  });
});

describe('call flow (report.calls)', () => {
  it('records every call with its outcome, consumed sequence, and arg drift', async () => {
    const events = extractToolReplayEvents([
      toolSpan('s1', 'lookup', 1000, { input: { key: 'first' }, output: { value: 'one' } }),
      toolSpan('s2', 'flaky', 2000, { input: {}, error: { name: 'TimeoutError', message: 'timed out' } }),
    ]);
    const state = createReplayState(events, TRACE_ID, {
      mocks: { stubbed: { output: { ok: true } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'passthrough' });

    await callHook(hooks, 'stubbed', {}); // mocked
    await callHook(hooks, 'lookup', { key: 'REPHRASED' }); // replayed, args differed
    await expect(callHook(hooks, 'flaky', {})).rejects.toThrow(); // replayed error
    await callHook(hooks, 'unknown', {}); // miss → passthrough

    expect(finalizeReplayReport(state).calls).toEqual([
      { order: 0, toolName: 'stubbed', outcome: 'mocked' },
      { order: 1, toolName: 'lookup', outcome: 'replayed', sequence: 0, argsDiffered: true },
      { order: 2, toolName: 'flaky', outcome: 'replayed-error', sequence: 1 },
      { order: 3, toolName: 'unknown', outcome: 'miss-passthrough' },
    ]);
  });

  it('records live outcomes on mock-only runs and omits calls when none happened', async () => {
    const state = createReplayState([], null, { replayActive: false, mocks: { m: { output: 1 } } });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });
    await callHook(hooks, 'liveTool', {});

    expect(finalizeReplayReport(state).calls).toEqual([{ order: 0, toolName: 'liveTool', outcome: 'live' }]);

    const idle = createReplayState([], TRACE_ID);
    expect(finalizeReplayReport(idle).calls).toBeUndefined();
  });
});

describe('codex review regressions', () => {
  it('records mock-error when a function mock rejects', async () => {
    const state = createReplayState([], null, {
      replayActive: false,
      mocks: {
        broken: async () => {
          throw new Error('replacement blew up');
        },
      },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await expect(callHook(hooks, 'broken', {})).rejects.toThrowError('replacement blew up');
    expect(finalizeReplayReport(state).calls).toEqual([{ order: 0, toolName: 'broken', outcome: 'mock-error' }]);
  });
});

describe('adversarial review regressions', () => {
  it('rejects mock keys that collide after tool-name formatting', () => {
    expect(() =>
      createReplayState([], null, {
        replayActive: false,
        mocks: { 'my.tool': { output: 1 }, my_tool: { output: 2 } },
      }),
    ).toThrowError(/both normalize to tool name 'my_tool'/);
  });

  it('reports mocks and expectations under the formatted tool name, joinable with calls[]', async () => {
    const state = createReplayState([], null, {
      replayActive: false,
      mocks: { 'my.tool': { output: 'stub', expect: { calledTimes: 1 } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });
    await callHook(hooks, 'my_tool', {});

    const report = finalizeReplayReport(state);
    expect(report.mocks).toEqual([{ toolName: 'my_tool', calls: 1, kind: 'output' }]);
    expect(report.expectations).toEqual([{ toolName: 'my_tool', satisfied: true, calledTimes: 1 }]);
    expect(report.calls).toEqual([{ order: 0, toolName: 'my_tool', outcome: 'mocked' }]);
  });

  it('error wins when a data mock sets both output and error', async () => {
    const state = createReplayState([], null, {
      replayActive: false,
      mocks: { flaky: { output: 'never served', error: { message: 'injected' } } },
    });
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await expect(callHook(hooks, 'flaky', {})).rejects.toThrowError('injected');
    const report = finalizeReplayReport(state);
    expect(report.mocks).toEqual([{ toolName: 'flaky', calls: 1, kind: 'error' }]);
    expect(report.calls?.[0]?.outcome).toBe('mock-error');
  });

  it('arg-filtered calledTimes: 0 fails only when the forbidden args are used', async () => {
    const makeState = () =>
      createReplayState([], null, {
        replayActive: false,
        mocks: { lookup: { expect: { args: { key: 'forbidden' }, calledTimes: 0 } } },
      });

    const okState = makeState();
    await callHook(buildReplayHooks(okState, { onMiss: 'error' }), 'lookup', { key: 'allowed' });
    expect(finalizeReplayReport(okState).expectations).toEqual([
      { toolName: 'lookup', satisfied: true, calledTimes: 0 },
    ]);

    const failState = makeState();
    await callHook(buildReplayHooks(failState, { onMiss: 'error' }), 'lookup', { key: 'forbidden' });
    expect(finalizeReplayReport(failState).expectations).toEqual([
      {
        toolName: 'lookup',
        satisfied: false,
        calledTimes: 1,
        reason: 'expected 0 call(s) with matching args, got 1',
      },
    ]);
  });

  it('a mock on a strict-matched tool intercepts the call and leaves the recording unconsumed', async () => {
    const state = createReplayState(
      [{ toolName: 'lookup', input: { key: 'a' }, output: 'recorded', error: null, spanId: 's-0', sequence: 0 }],
      'trace-1',
      { matching: 'strict', mocks: { lookup: { output: 'mocked' } } },
    );
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    await expect(callHook(hooks, 'lookup', { key: 'a' })).resolves.toEqual({
      proceed: false,
      output: 'mocked',
      spanMetadata: { outcome: 'mocked' },
    });
    const report = finalizeReplayReport(state);
    expect(report.replayedCount).toBe(0);
    expect(report.unconsumed).toEqual([{ toolName: 'lookup', count: 1 }]);
    expect(report.calls).toEqual([{ order: 0, toolName: 'lookup', outcome: 'mocked' }]);
  });
});
