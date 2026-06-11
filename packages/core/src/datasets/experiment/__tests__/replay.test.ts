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

    expect(callHook(hooks, 'lookup', { key: 'first' })).toEqual({ proceed: false, output: { value: 'one' } });
    expect(callHook(hooks, 'lookup', { key: 'second' })).toEqual({ proceed: false, output: { value: 'two' } });

    const report = finalizeReplayReport(state);
    expect(report.replayedCount).toBe(2);
    expect(report.argMismatches).toEqual([]);
    expect(report.unconsumed).toEqual([{ toolName: 'send', count: 1 }]);
  });

  it('is order-independent across different tools', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // Agent calls 'send' before 'lookup' — opposite of the recorded order
    expect(callHook(hooks, 'send', { to: 'a' })).toEqual({ proceed: false, output: { sent: true } });
    expect(callHook(hooks, 'lookup', { key: 'first' })).toEqual({ proceed: false, output: { value: 'one' } });

    expect(finalizeReplayReport(state).misses).toEqual([]);
  });

  it('flags arg mismatches but still replays', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(callHook(hooks, 'lookup', { key: 'DIFFERENT' })).toEqual({ proceed: false, output: { value: 'one' } });

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
      callHook(hooks, 'lookup', { key: 'first', _background: null, suspendedToolRunId: null, resumeData: null }),
    ).toEqual({ proceed: false, output: { value: 'one' } });

    expect(finalizeReplayReport(state).argMismatches).toEqual([]);
  });

  it('still flags a mismatch when an injected override key carries a real value', async () => {
    const state = createReplayState(recordedEvents(), TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    // _background: true changes execution semantics — that is a real drift.
    expect(callHook(hooks, 'lookup', { key: 'first', _background: true })).toEqual({
      proceed: false,
      output: { value: 'one' },
    });

    expect(finalizeReplayReport(state).argMismatches).toEqual([{ toolName: 'lookup', sequence: 0, spanId: 's1' }]);
  });

  it('re-throws recorded errors so the agent sees the same failure', async () => {
    const events = extractToolReplayEvents([
      toolSpan('e1', 'flaky', 1000, { error: { name: 'TimeoutError', message: 'timed out' } }),
    ]);
    const state = createReplayState(events, TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(() => callHook(hooks, 'flaky', {})).toThrowError(
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

      expect(() => callHook(hooks, 'guarded', {})).toThrowError(
        expect.objectContaining({ name: 'Error', message: 'denied' }),
      );
    }
  });

  it('onMiss passthrough lets the call proceed and records the miss', async () => {
    const state = createReplayState([], TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'passthrough' });

    expect(callHook(hooks, 'lookup', { key: 'x' })).toBeUndefined();

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
      expect(callHook(hooks, agentFormatted, {}), `tool name '${name}' → '${agentFormatted}'`).toEqual({
        proceed: false,
        output: { ok: true },
      });
    }
  });

  it('matches spans recorded under original tool names against agent-formatted hook names', () => {
    // Spans record the tool's ORIGINAL name; the hook context carries the
    // agent-formatted name (invalid chars replaced, max 63 chars) — see
    // Agent.formatTools. Both sides must normalize identically.
    const events = extractToolReplayEvents([
      toolSpan('s1', 'my.namespaced.tool', 1000, { input: { a: 1 }, output: { ok: 1 } }),
      toolSpan('s2', '1starts-with-digit', 2000, { input: { a: 2 }, output: { ok: 2 } }),
    ]);
    const state = createReplayState(events, TRACE_ID);
    const hooks = buildReplayHooks(state, { onMiss: 'error' });

    expect(callHook(hooks, 'my_namespaced_tool', { a: 1 })).toEqual({ proceed: false, output: { ok: 1 } });
    expect(callHook(hooks, '_1starts-with-digit', { a: 2 })).toEqual({ proceed: false, output: { ok: 2 } });
    expect(finalizeReplayReport(state).misses).toEqual([]);
  });

  it('onMiss error throws an abort-style error and notifies onFatalMiss', async () => {
    const state = createReplayState([], TRACE_ID);
    const onFatalMiss = vi.fn();
    const hooks = buildReplayHooks(state, { onMiss: 'error', onFatalMiss });

    expect(() => callHook(hooks, 'lookup', { key: 'x' })).toThrowError(/aborted/);
    expect(onFatalMiss).toHaveBeenCalledTimes(1);
    expect(finalizeReplayReport(state).misses).toEqual([{ toolName: 'lookup', action: 'error', input: { key: 'x' } }]);
  });
});
