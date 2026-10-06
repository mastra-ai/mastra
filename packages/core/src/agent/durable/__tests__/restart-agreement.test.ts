/**
 * Fresh-module-graph agreement with the harness's restart cells (COR-1382).
 *
 * The harness restarts a run two ways: `sigkill` (a real process death) and
 * `inprocess` (the old Mastra is shut down and a new one is built **in the same
 * module graph**). For the restart cells that are not SIGKILL-only, the only
 * evidence that a *fresh module graph* behaves the same was an argument, not a
 * measurement. This file is that measurement.
 *
 * Each test drives one harness cell to its interruption point, abandons
 * generation 1 in place (its gate is never released, mirroring the harness's
 * `hang()`), builds generation 2 through `loadGraph()` (`vi.resetModules()` plus
 * fresh imports) over the same storage, recovers, and re-runs that cell's
 * harness `evaluate()` checks. A failing check names the cell, so a divergence
 * between a fresh module graph and the harness baseline is loud rather than
 * silently absorbed.
 */
import { writeFileSync } from 'node:fs';
import { afterAll, afterEach, describe, it } from 'vitest';
import { z } from 'zod';
import { DurableStepIds } from '../constants';
import {
  buildAgreementGraph,
  createScriptModel,
  gateToolSpec,
  lastUserText,
  readRow,
  toolResults,
  waitFor,
} from './restart-agreement-support';
import { createGate, loadGraph } from './restart-harness';

// ---------------------------------------------------------------------------
// Verdict recorder — one entry per cell, dumped to JSON for the 3x tabulation.
// ---------------------------------------------------------------------------

type Check = { cell: string; name: string; pass: boolean; detail?: string };
type Entry = { cell: string; checks: Check[]; observations: Record<string, unknown> };

const entries: Entry[] = [];

class Rec {
  checks: Check[] = [];
  observations: Record<string, unknown> = {};
  constructor(public cell: string) {}
  check(name: string, pass: unknown, detail?: unknown) {
    this.checks.push({
      cell: this.cell,
      name,
      pass: !!pass,
      detail: detail === undefined ? undefined : JSON.stringify(detail).slice(0, 400),
    });
    return !!pass;
  }
  observe(name: string, value: unknown) {
    this.observations[name] = value;
  }
}

/** Runs one cell; a thrown error becomes a single failing check, never a skipped test. */
function agreementTest(name: string, fn: (rec: Rec) => Promise<void>, timeout = 180_000) {
  it(
    name,
    async () => {
      const rec = new Rec(name);
      const entry: Entry = { cell: name, checks: rec.checks, observations: rec.observations };
      entries.push(entry);
      try {
        await fn(rec);
      } catch (err) {
        rec.check('cell ran to completion', false, String((err as Error)?.message ?? err));
      }
      const failed = rec.checks.filter(c => !c.pass);
      // Surface the per-cell verdict in the vitest output so a disagreement is loud.
      if (failed.length) {
        throw new Error(`${name}: ${failed.length} check(s) failed: ${failed.map(f => f.name).join(' | ')}`);
      }
    },
    timeout,
  );
}

afterAll(() => {
  for (const entry of entries) {
    const failed = entry.checks.filter(c => !c.pass);
    console.log(
      `[AGREEMENT] ${entry.cell} ${failed.length ? `FAIL (${failed.length})` : 'PASS'} / ${entry.checks.length} checks` +
        (failed.length ? `\n[AGREEMENT-FAIL] ${entry.cell} :: ${failed.map(f => f.name).join(' | ')}` : ''),
    );
    if (Object.keys(entry.observations).length) {
      console.log(`[AGREEMENT-OBS] ${entry.cell} ${JSON.stringify(entry.observations).slice(0, 1200)}`);
    }
  }
  // Machine-readable dump for tabulating several runs; the console lines above
  // are the evidence vitest output carries.
  if (process.env.COR1382_OUT) writeFileSync(process.env.COR1382_OUT, JSON.stringify(entries, null, 1));
});

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

const liveGraphs: any[] = [];
const liveGates: Array<{ release: () => void }> = [];

const guarded = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

afterEach(async () => {
  // Release first: a parked tool must not be stopped mid-flight.
  for (const gate of liveGates.splice(0)) {
    try {
      gate.release();
    } catch {
      /* ignore */
    }
  }
  for (const graph of liveGraphs.splice(0)) {
    try {
      await guarded(Promise.resolve(graph.mastra?.stopWorkers?.()), 2000);
    } catch {
      /* ignore */
    }
    try {
      await guarded(Promise.resolve(graph.mastra?.shutdown?.({ drainTimeout: 300 })), 3000);
    } catch {
      /* ignore */
    }
  }
});

type Gen = Awaited<ReturnType<typeof buildAgreementGraph<any>>>;

async function newStorage() {
  const { InMemoryStore } = await loadGraph();
  return new InMemoryStore();
}

/**
 * Drive generation 1 into its parked tool, abandon it, recover in a fresh module graph.
 * The gate is deliberately never released here — generation 1 stays parked exactly like
 * a tool that never settles, so the recovering generation is the only writer.
 */
async function freshRecover(opts: {
  engine: 'durable' | 'evented';
  id: string;
  runId: string;
  gate: ReturnType<typeof createGate>;
  build: (ctx: { core: any; storage: any; memory: any; generation: number }) => any;
  start: (gen: Gen) => Promise<any> | any;
  /** Runs once the parked tool has been reached and the run row is persisted. */
  afterPark?: (gen1: Gen) => Promise<void> | void;
  recover?: (gen2: Gen) => Promise<any>;
  /** Extra `Mastra` config per generation (e.g. `{ workflows }`); see `buildAgreementGraph`. */
  mastraExtra?: (ctx: { core: any; storage: any; memory: any; generation: number }) => Record<string, unknown>;
}) {
  const storage = await newStorage();
  const gen1 = await buildAgreementGraph({
    storage,
    id: opts.id,
    engine: opts.engine,
    build: opts.build,
    generation: 1,
    mastraExtra: opts.mastraExtra,
  });
  liveGraphs.push(gen1);
  const parked = Promise.resolve()
    .then(() => opts.start(gen1))
    .catch(() => undefined);

  await opts.gate.reached;
  const parkedRow = await waitFor(async () => {
    const row: any = await readRow(storage, opts.runId, DurableStepIds.AGENTIC_LOOP);
    return row?.status === 'running' ? row : undefined;
  });
  await opts.afterPark?.(gen1);

  const gen2 = await buildAgreementGraph({
    storage,
    id: opts.id,
    engine: opts.engine,
    build: opts.build,
    generation: 2,
    mastraExtra: opts.mastraExtra,
  });
  liveGraphs.push(gen2);
  const result = await (opts.recover ? opts.recover(gen2) : gen2.runner.recover(opts.runId, {}));
  void parked;
  return { gen1, gen2, storage, parkedRow, result };
}

/** Drains a stream result into the harness's `{chunks, full}` shape. */
// Mirrors harness `ctx.consume`: durable/evented results wrap the inner output, and a
// `getFullOutput()` rejection is recorded as `{ fullOutputError }` rather than thrown.
async function drain(result: any, opts: { stopOn?: (chunk: any) => boolean } = {}) {
  const output = !result.output ? result : result.output;
  const chunks: any[] = [];
  let stopped: any = null;
  for await (const chunk of output.fullStream) {
    chunks.push(chunk);
    if (opts.stopOn?.(chunk)) {
      stopped = chunk;
      break;
    }
  }
  const full = stopped
    ? null
    : await output.getFullOutput().catch((error: any) => ({ fullOutputError: error.message }));
  return { chunks, full, stopped, types: chunks.map((c: any) => c.type) };
}

const count = (list: any[], type: string) => list.filter(c => c.type === type).length;

/**
 * Checks the harness asserts against `@mastra/memory`'s persisted messages cannot be
 * measured here: `@mastra/memory` is not a dependency of `packages/core`, and the only
 * in-core memory (`MockMemory`) persisted nothing on the suspend/resume path (it did on
 * the `recover()` path in T1). Recorded as unmeasured rather than passed or failed.
 */
const PERSISTENCE_UNMEASURED =
  'not measured: core test vehicle has no message-persisting memory (@mastra/memory is not a packages/core dependency; MockMemory persists nothing on the suspend/resume path)';
const unmeasured = (rec: { observe: (name: string, value: unknown) => void }, name: string) =>
  rec.observe(`unmeasured: ${name}`, PERSISTENCE_UNMEASURED);
const errorChunks = (list: any[]) => list.filter(c => ['error', 'abort', 'tripwire'].includes(c.type));
const textOf = (list: any[]) =>
  list
    .filter(c => c.type === 'text-delta')
    .map(c => c.payload?.text ?? '')
    .join('');

/** Reads persisted memory messages, mirroring the harness's `ctx.persisted`. */
async function persisted(storage: any, threadId: string, resourceId: string) {
  const store = await storage.getStore('memory');
  const out = await store.listMessages({
    threadId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  return out.messages as any[];
}

const toolParts = (messages: any[]) =>
  messages
    .flatMap(m => m.content?.parts ?? [])
    .filter(p => p.type === 'tool-invocation')
    .map(p => p.toolInvocation);

// ---------------------------------------------------------------------------
// T26 — request context reaches the run across recovery (variant: tools)
// ---------------------------------------------------------------------------

const T26_MARKER = 't26-marker';

describe('T26 request-context / durable-recover / tools', () => {
  agreementTest('T26.durable-recover.tools', async rec => {
    const gate = createGate();
    liveGates.push(gate);
    const log: Array<Record<string, unknown>> = [];
    const requests: Array<{ generation: number; call: any }> = [];
    const memoryKey = { thread: 't26-thread-agreement', resource: 't26-resource-agreement' };
    const runId = 't26-run-agreement';
    let parkedSnapshot: any = null;
    let activeBeforeRecovery: any = null;

    const build = ({ core, generation, memory }: any) => {
      const park = gateToolSpec(gate, 2);
      const echoContext = core.createTool({
        id: 'echoContext',
        description: 'Echo the request-context marker back.',
        inputSchema: z.object({ n: z.number() }),
        execute: async (input: { n: number }, context: any) => {
          const marker = context?.requestContext?.get?.('marker') ?? null;
          log.push({ tool: 'echoContext', event: 'start', n: input.n, marker, generation });
          await park.park(input.n, generation);
          await new Promise(r => setTimeout(r, 200));
          log.push({ tool: 'echoContext', event: 'commit', n: input.n, marker, generation });
          return { n: input.n, marker };
        },
      });
      return new core.Agent({
        id: 't26',
        name: 't26',
        instructions: 'Follow the script.',
        model: createScriptModel(
          p => {
            const n = toolResults(p).length;
            return n < 2 ? { tools: [{ name: 'echoContext', args: { n: n + 1 } }] } : { text: `echoed ${n}` };
          },
          { onCall: (prompt, _step, options) => requests.push({ generation, call: { prompt, ...(options as any) } }) },
        ),
        tools: { echoContext },
        memory,
      });
    };

    const { gen2, result } = await freshRecover({
      engine: 'durable',
      id: 't26',
      runId,
      gate,
      build,
      afterPark: async gen1 => {
        const row: any = await readRow(gen1.storage, runId, DurableStepIds.AGENTIC_LOOP);
        parkedSnapshot = row;
        activeBeforeRecovery = await gen1.runner.listActiveRuns({ resourceId: memoryKey.resource });
      },
      start: gen1 => {
        const options = {
          memory: memoryKey,
          runId,
          maxSteps: 5,
          requestContext: new gen1.core.RequestContext([['marker', T26_MARKER]]),
        };
        return gen1.runner.stream('Go.', options);
      },
    });

    const { chunks } = await drain(result);
    const commits = log.filter(e => e.tool === 'echoContext' && e.event === 'commit');
    const markers = [...new Set(commits.map(e => e.marker))];

    rec.observe('parkedSnapshotStatus', parkedSnapshot?.status ?? null);
    rec.observe('activeRunsBeforeRecovery', activeBeforeRecovery);
    rec.observe(
      'commitLog',
      log.filter(e => e.event === 'commit'),
    );
    rec.observe('modelCalls', requests.length);
    void gen2;

    rec.check(
      'run settled with one finish and no error',
      count(chunks, 'finish') === 1 && errorChunks(chunks).length === 0,
      { types: chunks.map(c => c.type), errors: errorChunks(chunks).map(c => c.payload?.error?.message) },
    );
    rec.check(
      'echoContext committed n=1 and n=2, once each',
      commits
        .map(e => e.n)
        .sort()
        .join() === '1,2',
      commits,
    );
    rec.check('the tool saw the marker on every commit', markers.length === 1 && markers[0] === T26_MARKER, markers);
    rec.check(
      'n=2 committed by the recovering process only',
      commits.filter(e => e.n === 2).every(e => e.generation === 2),
      commits.map(e => ({ n: e.n, generation: e.generation })),
    );
  });
});

// ---------------------------------------------------------------------------
// T48 — structured output survives a tool step interrupted across recovery
// ---------------------------------------------------------------------------

function stepTool(core: any, gate: ReturnType<typeof createGate>, blockAt: number, log: any[], generation: number) {
  const park = gateToolSpec(gate, blockAt);
  return core.createTool({
    id: 'step',
    description: 'Perform numbered step n.',
    inputSchema: z.object({ n: z.number() }),
    execute: async (input: { n: number }) => {
      log.push({ tool: 'step', event: 'start', n: input.n, generation });
      await park.park(input.n, generation);
      await new Promise(r => setTimeout(r, 20));
      log.push({ tool: 'step', event: 'commit', n: input.n, generation });
      return { done: input.n };
    },
  });
}

function t48Run(engine: 'durable' | 'evented') {
  agreementTest(`T48.${engine}-recover`, async rec => {
    const gate = createGate();
    liveGates.push(gate);
    const log: Array<Record<string, unknown>> = [];
    const responseFormats: Array<{ generation: number; type: string }> = [];
    const memoryKey = { thread: 't48-thread-agreement', resource: 't48-resource-agreement' };
    const runId = 't48-run-agreement';

    const build = ({ core, generation, memory }: any) => {
      const base = (p: any[]) => {
        const completed = toolResults(p).length;
        return completed < 1
          ? { tools: [{ name: 'step', args: { n: completed + 1 } }] }
          : { text: `finished ${completed} steps` };
      };
      const script = (p: any[]) => {
        const s: any = base(p);
        return 'text' in s ? { text: JSON.stringify({ reply: s.text, number: 1 }) } : s;
      };
      return new core.Agent({
        id: 't48-agent',
        name: 't48',
        instructions: 'Follow the script.',
        model: createScriptModel(script, {
          onCall: (_prompt, _step, options) =>
            responseFormats.push({ generation, type: (options as any)?.responseFormat?.type ?? 'none' }),
        }),
        tools: { step: stepTool(core, gate, 1, log, generation) },
        memory,
      });
    };

    const { result } = await freshRecover({
      engine,
      id: 't48',
      runId,
      gate,
      build,
      start: gen1 =>
        gen1.runner.stream('go', {
          memory: memoryKey,
          runId,
          maxSteps: 4,
          structuredOutput: { schema: z.object({ reply: z.string(), number: z.number() }) },
        }),
    });

    const { chunks, full } = await drain(result);
    const commits = log.filter(e => e.tool === 'step' && e.event === 'commit');
    const fullOutputError = (full as any)?.fullOutputError
      ? String((full as any).fullOutputError?.message ?? (full as any).fullOutputError).slice(0, 200)
      : null;

    rec.observe('responseFormats', responseFormats);
    rec.observe(
      'types',
      chunks.map(c => c.type),
    );
    rec.observe('object', (full as any)?.object ?? null);

    rec.check('tool step committed once', commits.length === 1, commits);
    rec.check(
      'recovered run resent the response format',
      responseFormats.some(f => f.type === 'json'),
      responseFormats,
    );
    rec.check(
      'object parsed after the tool step',
      (full as any)?.object?.reply === 'finished 1 steps' &&
        (full as any)?.object?.number === 1 &&
        fullOutputError === null,
      { object: (full as any)?.object ?? null, fullOutputError },
    );
    rec.check('run finished without error chunks', count(chunks, 'finish') === 1 && errorChunks(chunks).length === 0, {
      finishes: count(chunks, 'finish'),
      errors: errorChunks(chunks).length,
      types: chunks.map(c => c.type),
    });
  });
}

describe('T48 structured-tools', () => {
  t48Run('durable');
  t48Run('evented');
});

// ---------------------------------------------------------------------------
// T1 — tool roundtrip: the interrupted read is re-executed by the fresh graph
// ---------------------------------------------------------------------------

describe('T1 tool-roundtrip / durable-recover / amount', () => {
  agreementTest('T1.durable-recover.amount', async rec => {
    const gate = createGate();
    liveGates.push(gate);
    const field = 'amount';
    const log: Array<Record<string, unknown>> = [];
    const memoryKey = { thread: 't1-thread-agreement', resource: 't1-resource-agreement' };
    const runId = 't1-run-agreement';
    const receipt = `receipt-${runId}`;
    const record = { name: 'comparison', [field]: 42 };
    let written = false;
    let parkedSnapshotStatus: string | null = null;
    let activeBeforeRecovery: any = null;
    const callbacks: string[] = [];

    const build = ({ core, generation, memory }: any) => {
      const park = gateToolSpec(gate, 1);
      const writeRecord = core.createTool({
        id: 'writeRecord',
        description: 'Write the comparison record.',
        inputSchema: z.object({ name: z.literal('comparison'), [field]: z.literal(42) }),
        outputSchema: z.object({ receipt: z.string(), name: z.literal('comparison'), [field]: z.literal(42) }),
        execute: async (input: any) => {
          if (written) throw new Error('record already exists');
          written = true;
          const written_record = { receipt, name: input.name, [field]: 42 };
          log.push({ tool: 'writeRecord', event: 'start', generation });
          log.push({ tool: 'writeRecord', event: 'commit', generation, result: written_record });
          return written_record;
        },
      });
      const readRecord = core.createTool({
        id: 'readRecord',
        description: 'Read the comparison record back by receipt.',
        inputSchema: z.object({ receipt: z.string() }),
        outputSchema: z.object({ name: z.literal('comparison'), [field]: z.literal(42), verified: z.literal(true) }),
        execute: async (input: any) => {
          log.push({ tool: 'readRecord', event: 'start', generation, input: { receipt: input.receipt } });
          await park.park(1, generation);
          if (input.receipt !== receipt) throw new Error('Incorrect receipt');
          const result = { ...record, verified: true as const };
          log.push({ tool: 'readRecord', event: 'commit', generation, result });
          return result;
        },
      });
      const out = (r: any) =>
        r && typeof r === 'object' && r.output && typeof r.output === 'object' && 'type' in r.output
          ? r.output.value
          : r?.output;
      return new core.Agent({
        id: 't1-agent',
        name: 't1',
        instructions: 'Call writeRecord exactly once, then readRecord exactly once with the returned receipt.',
        model: createScriptModel(p => {
          const rs = toolResults(p);
          if (rs.length === 0) return { tools: [{ name: 'writeRecord', args: { name: 'comparison', [field]: 42 } }] };
          if (rs.length === 1)
            return { tools: [{ name: 'readRecord', args: { receipt: out(rs[0])?.receipt ?? 'missing-receipt' } }] };
          const v = out(rs.at(-1));
          return {
            text: v?.verified ? `verified ${v.name} value ${v[field]}` : `could not verify: ${JSON.stringify(v)}`,
          };
        }),
        tools: { writeRecord, readRecord },
        memory,
      });
    };

    const { gen1, result } = await freshRecover({
      engine: 'durable',
      id: 't1',
      runId,
      gate,
      build,
      afterPark: async gen => {
        const row: any = await readRow(gen.storage, runId, DurableStepIds.AGENTIC_LOOP);
        parkedSnapshotStatus = row?.status ?? null;
        activeBeforeRecovery = await gen.runner.listActiveRuns({ resourceId: memoryKey.resource });
      },
      start: gen1 =>
        gen1.runner.stream(
          'Write record comparison with value 42, read it back using its receipt, and report the verified value.',
          {
            memory: memoryKey,
            runId,
            maxSteps: 5,
          },
        ),
      recover: gen2 =>
        gen2.runner.recover(runId, {
          onFinish: () => callbacks.push('onFinish'),
          onError: () => callbacks.push('onError'),
          onStepFinish: () => callbacks.push('onStepFinish'),
        }),
    });

    const { chunks } = await drain(result);
    const messages = await persisted(gen1.storage, memoryKey.thread, memoryKey.resource);
    const parts = toolParts(messages);
    const pick = (tool: string, event: string, generation?: number) =>
      log.filter(
        e => e.tool === tool && e.event === event && (generation === undefined || e.generation === generation),
      );
    const writes = pick('writeRecord', 'commit');
    const reads = pick('readRecord', 'commit');
    const starts = pick('readRecord', 'start');
    const expected = { name: 'comparison', [field]: 42, verified: true };

    rec.observe('activeBeforeRecovery', activeBeforeRecovery);
    rec.observe('callbacks', callbacks);
    rec.observe(
      'partPayloads',
      parts.map(p => ({ tool: p.toolName, state: p.state, result: p.result })),
    );
    rec.observe(
      'types',
      chunks.map(c => c.type),
    );

    rec.check(
      'writeRecord committed exactly once',
      writes.length === 1,
      log.filter(e => e.tool === 'writeRecord'),
    );
    rec.check(
      'readRecord committed exactly once, with the receipt',
      reads.length === 1 && starts.length >= 1 && starts.every(e => (e.input as any)?.receipt === receipt),
      { receipt, starts: starts.length, reads: pick('readRecord', 'commit') },
    );
    rec.check(
      'readRecord returned the verified record',
      JSON.stringify(reads[0]?.result) === JSON.stringify(expected),
      reads[0]?.result,
    );
    rec.check(
      'persisted results: one per call, state result, exact payloads',
      parts.length === 2 &&
        parts.every((t: any) => t.state === 'result') &&
        (parts[0] as any)?.result?.receipt === receipt &&
        JSON.stringify((parts[1] as any)?.result) === JSON.stringify(expected),
      parts.map((t: any) => ({ tool: t.toolName, state: t.state, result: t.result })),
    );
    rec.check(
      'persisted transcript: one user message, unique ids, final answer reports 42',
      messages.filter(m => m.role === 'user').length === 1 &&
        new Set(messages.map(m => m.id)).size === messages.length &&
        messages
          .filter(m => m.role === 'assistant')
          .flatMap(m => m.content?.parts ?? [])
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
          .includes('42'),
      { users: messages.filter(m => m.role === 'user').length, ids: messages.length },
    );
    rec.check('final text reports 42', textOf(chunks).includes('42'), textOf(chunks).slice(-200));
    rec.check(
      'no error/abort/tripwire chunk in the judged stream',
      errorChunks(chunks).length === 0,
      errorChunks(chunks).map(c => c.payload?.error?.message ?? c.type),
    );
    rec.check(
      'onFinish exactly once, no onError',
      callbacks.filter(c => c === 'onFinish').length === 1 && !callbacks.includes('onError'),
      callbacks,
    );
    rec.check(
      'checkpoint reached with a running snapshot persisted',
      parkedSnapshotStatus === 'running',
      parkedSnapshotStatus,
    );
    rec.check(
      'interrupted readRecord attempt never committed',
      pick('readRecord', 'start', 1).length >= 1 && pick('readRecord', 'commit', 1).length === 0,
      log.filter(e => e.tool === 'readRecord'),
    );
    rec.check(
      'readRecord committed by the recovering generation',
      (reads[0] as any)?.generation === 2,
      reads[0] ?? null,
    );
    rec.check(
      'run discoverable as running before recovery',
      activeBeforeRecovery?.runs?.length === 1 && activeBeforeRecovery.runs[0].status === 'running',
      activeBeforeRecovery,
    );
  });
});

// ---------------------------------------------------------------------------
// T84 / T85 — usage accounting across recovery
//
// Both cells share one vehicle (`usageCell`) that mirrors the harness run body
// verbatim: `step` tool with `blockAt: 2`, `maxSteps: 5`, script = two numbered
// steps then the text `done`, and usage supplied per provider call from
// `usageFor(variant, toolResults(prompt).length)`.
//
// `postRestartCalls` is the fresh-graph analogue of the harness's sigkill leg
// (`modelRequests.filter(e => e.phase === 'recover')`): model calls that happened
// in generation 2.
// ---------------------------------------------------------------------------

const PRIMARY_BY_CALL = [
  { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
];
const DETAILS_BY_CALL = [
  {
    reasoningTokens: 5,
    cachedInputTokens: 7,
    cacheCreationInputTokens: 11,
    cacheCreationInputTokens5m: 13,
    cacheCreationInputTokens1h: 17,
  },
  {
    reasoningTokens: 50,
    cachedInputTokens: 70,
    cacheCreationInputTokens: 110,
    cacheCreationInputTokens5m: 130,
    cacheCreationInputTokens1h: 170,
  },
  {
    reasoningTokens: 500,
    cachedInputTokens: 700,
    cacheCreationInputTokens: 1100,
    cacheCreationInputTokens5m: 1300,
    cacheCreationInputTokens1h: 1700,
  },
];
const DETAIL_KEYS = [
  'reasoningTokens',
  'cachedInputTokens',
  'cacheCreationInputTokens',
  'cacheCreationInputTokens5m',
  'cacheCreationInputTokens1h',
];
const ASSERTED_DETAIL_KEYS = ['reasoningTokens', 'cachedInputTokens', 'cacheCreationInputTokens'];

const finishUsage = (chunk: any) => chunk?.payload?.usage ?? chunk?.payload?.output?.usage ?? null;

/** Property insertion order is not part of the usage contract; key sets and values are. */
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : !value || typeof value !== 'object'
      ? value
      : Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(k => [k, canonical(value[k])]),
        );

type UsageState = {
  threw: string | null;
  variant: string;
  usage: any;
  usageKeys: string[];
  text: any;
  perCallUsage: any[];
  finishPayloads: any[];
  commits: Array<{ n: number; generation: number }>;
  modelCalls: number;
  postRestartCalls: number;
};

/**
 * Drives one T84/T85 recovery cell and returns the harness's `run()` return shape.
 * `usageFor` is called with the committed-tool-result count, exactly like the fixture.
 */
async function usageCell(opts: {
  engine: 'durable' | 'evented';
  variant: string;
  id: string;
  usageFor: (call: number) => Record<string, number> | undefined;
}): Promise<UsageState> {
  const gate = createGate();
  liveGates.push(gate);
  const log: Array<Record<string, unknown>> = [];
  const requests: Array<{ generation: number }> = [];
  const memoryKey = { thread: `${opts.id}-thread-agreement`, resource: `${opts.id}-resource-agreement` };
  const runId = `${opts.id}-run-agreement`;
  const perCallUsage = [0, 1, 2].map(call => opts.usageFor(call));

  const build = ({ core, generation, memory }: any) =>
    new core.Agent({
      id: `${opts.id}-agent`,
      name: opts.id,
      instructions: 'Follow the script.',
      model: createScriptModel(
        p => {
          const completed = toolResults(p).length;
          return completed < 2 ? { tools: [{ name: 'step', args: { n: completed + 1 } }] } : { text: 'done' };
        },
        {
          usage: p => opts.usageFor(toolResults(p).length),
          onCall: () => requests.push({ generation }),
        },
      ),
      tools: { step: stepTool(core, gate, 2, log, generation) },
      memory,
    });

  let threw: string | null = null;
  let chunks: any[] = [];
  let full: any = null;
  try {
    const { result } = await freshRecover({
      engine: opts.engine,
      id: opts.id,
      runId,
      gate,
      build,
      start: gen1 => gen1.runner.stream('Go.', { memory: memoryKey, runId, maxSteps: 5 }),
    });
    const drained = await drain(result);
    chunks = drained.chunks;
    full = drained.full;
  } catch (error) {
    threw = String((error as Error)?.message ?? error).slice(0, 300);
    chunks = [];
    full = null;
  }

  const finishes = chunks.filter(c => c.type === 'finish');
  const commits = log
    .filter(e => e.tool === 'step' && e.event === 'commit')
    .map(e => ({ n: e.n as number, generation: e.generation as number }));
  return {
    threw,
    variant: opts.variant,
    usage: full?.usage ?? null,
    usageKeys: Object.keys(full?.usage ?? {}).sort(),
    text: full?.text ?? null,
    perCallUsage,
    finishPayloads: finishes.map(c => {
      const usage = finishUsage(c);
      return { usage, usageKeys: Object.keys(usage ?? {}).sort() };
    }),
    commits,
    modelCalls: requests.length,
    postRestartCalls: requests.filter(r => r.generation === 2).length,
  };
}

/** T84's `evaluate()` checks, verbatim (with notExecuted turned into failing checks). */
function t84Checks(state: UsageState, rec: Rec) {
  const usage = state.usage ?? null;
  const terminalUsage = state.finishPayloads.at(-1)?.usage ?? null;

  rec.check('the run completed', state.threw === null, state.threw ?? 'no error');
  rec.check(
    'the public stream settled with exactly one finish',
    state.finishPayloads.length === 1,
    state.finishPayloads.length,
  );
  rec.check('the scripted answer is in the run', state.text === 'done', state.text ?? 'no text');
  rec.check(
    'each tool side effect committed exactly once',
    state.commits.map(c => c.n).join(',') === '1,2',
    state.commits,
  );

  if (state.variant === 'known-then-known') {
    rec.check('the run reached the third model call', state.modelCalls >= 3, state.modelCalls);
    rec.check(
      'all reported usage sums every model call',
      usage?.inputTokens === 111 && usage?.outputTokens === 222 && usage?.totalTokens === 333,
      usage,
    );
  } else {
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) {
      rec.check(
        `${key} stays unknown when any committed call omits it`,
        typeof (usage as any)?.[key] !== 'number' && (usage as any)?.[key] !== 0,
        usage,
      );
    }
  }

  rec.check(
    'terminal finish usage equals the resolved full output usage',
    JSON.stringify(terminalUsage) === JSON.stringify(usage),
    { terminalUsage, usage },
  );
  rec.check('recovery emitted at least one model call', state.postRestartCalls >= 1, state.postRestartCalls);
}

function t84Test(engine: 'durable' | 'evented', variant: string) {
  const knownByCall = (call: number) => PRIMARY_BY_CALL[call] ?? PRIMARY_BY_CALL.at(-1) ?? undefined;
  const usageFor = (call: number) => {
    const known = knownByCall(call);
    if (variant === 'known-then-omitted') return call === 0 ? known : undefined;
    if (variant === 'omitted-then-known') return call === 0 ? undefined : known;
    return known;
  };
  agreementTest(`T84.${engine}-recover.${variant}`, async rec => {
    const state = await usageCell({ engine, variant, id: 't84', usageFor });
    rec.observe('state', { ...state, commits: state.commits });
    t84Checks(state, rec);
  });
}

describe('T84 usage-across-recovery', () => {
  for (const engine of ['durable', 'evented'] as const) {
    for (const variant of ['known-then-known', 'known-then-omitted', 'omitted-then-known']) {
      t84Test(engine, variant);
    }
  }
});

const EXPECTED_DETAILS: Record<string, Record<string, number>> = {
  'details-present': { reasoningTokens: 555, cachedInputTokens: 777, cacheCreationInputTokens: 1221 },
  'details-known-then-omitted': { reasoningTokens: 5, cachedInputTokens: 7, cacheCreationInputTokens: 11 },
  'details-omitted-then-known': { reasoningTokens: 550, cachedInputTokens: 770, cacheCreationInputTokens: 1210 },
};

function t85Test(engine: 'durable' | 'evented', variant: string) {
  const detailsFor = (call: number) => {
    if (variant === 'details-absent') return undefined;
    if (variant === 'details-known-then-omitted') return call === 0 ? DETAILS_BY_CALL[call] : undefined;
    if (variant === 'details-omitted-then-known') return call === 0 ? undefined : DETAILS_BY_CALL[call];
    return DETAILS_BY_CALL[call];
  };
  const usageFor = (call: number) => {
    const primary = PRIMARY_BY_CALL[call] ?? PRIMARY_BY_CALL.at(-1) ?? {};
    const details = detailsFor(call);
    return details ? { ...primary, ...details } : { ...primary };
  };
  agreementTest(`T85.${engine}-recover.${variant}`, async rec => {
    const state = await usageCell({ engine, variant, id: 't85', usageFor });
    const usage = state.usage ?? null;
    const terminal = state.finishPayloads.at(-1) ?? { usage: null, usageKeys: [] };

    rec.observe('state', state);

    rec.check('the run completed', state.threw === null, state.threw ?? 'no error');
    rec.check('the scripted answer is in the run', state.text === 'done', state.text ?? 'no text');
    rec.check(
      'the public stream settled with exactly one finish',
      state.finishPayloads.length === 1,
      state.finishPayloads,
    );
    rec.check(
      'each tool side effect committed exactly once',
      state.commits.map(c => c.n).join(',') === '1,2',
      state.commits,
    );
    rec.check(
      'primary usage remains complete while detail behavior is isolated',
      usage?.inputTokens === 111 && usage?.outputTokens === 222 && usage?.totalTokens === 333,
      usage,
    );

    if (variant === 'details-absent') {
      for (const key of DETAIL_KEYS) {
        rec.check(`${key} stays absent when no call reports it`, !state.usageKeys.includes(key), {
          usage,
          usageKeys: state.usageKeys,
        });
      }
    } else {
      const expected = EXPECTED_DETAILS[variant]!;
      for (const key of ASSERTED_DETAIL_KEYS) {
        rec.check(`${key} sums only the calls that report it`, (usage as any)?.[key] === expected[key], {
          usage,
          expected,
        });
        rec.check(`${key} stays present after it is first reported`, state.usageKeys.includes(key), state.usageKeys);
      }
    }

    rec.check(
      'terminal finish usage equals the resolved full output usage',
      JSON.stringify(canonical(terminal.usage)) === JSON.stringify(canonical(usage)),
      { terminalUsage: terminal.usage, usage },
    );
    rec.check(
      'terminal finish and resolved usage expose the same keys',
      terminal.usageKeys.join(',') === state.usageKeys.join(','),
      { terminalUsageKeys: terminal.usageKeys, usageKeys: state.usageKeys },
    );
    rec.check('the run reached the third model call', state.modelCalls >= 3, state.modelCalls);
    rec.check('recovery emitted at least one model call', state.postRestartCalls >= 1, state.postRestartCalls);
  });
}

describe('T85 usage-detail-counters', () => {
  for (const engine of ['durable', 'evented'] as const) {
    for (const variant of [
      'details-present',
      'details-known-then-omitted',
      'details-omitted-then-known',
      'details-absent',
    ]) {
      t85Test(engine, variant);
    }
  }
});

// ---------------------------------------------------------------------------
// T55 — an agent tool runs a workflow; the run is interrupted mid-workflow
// ---------------------------------------------------------------------------

const T55_N = z.object({ n: z.number() });

/**
 * T55's `recover` variant. `createBlockingWorkflow` + `createWorkflowTool` ports:
 * the tool runs a real workflow whose middle step parks generation 1, so recovery
 * must re-execute the tool and drive the same workflow run to completion.
 */
async function t55Run(engine: 'durable' | 'evented') {
  const gate = createGate();
  liveGates.push(gate);
  const log: Array<Record<string, unknown>> = [];
  const memoryKey = { thread: 't55-thread-agreement', resource: 't55-resource-agreement' };
  const runId = 't55-run-agreement';
  const wfRunId = 'wf-tool-1-recover';
  let wf: any = null;

  const loggedStep = (core: any, generation: number, id: string, blockWhen = false) =>
    core.createStep({
      id,
      inputSchema: T55_N,
      outputSchema: T55_N,
      execute: async ({ inputData, actor }: any) => {
        log.push({ step: id, event: 'start', input: inputData, actor: actor ?? null, generation });
        if (blockWhen && generation === 1) await gate.wait();
        await new Promise(r => setTimeout(r, 100));
        log.push({ step: id, event: 'commit', n: inputData.n + 1, generation });
        return { n: inputData.n + 1 };
      },
    });

  const build = ({ core, generation, memory }: any) => {
    const workflow = core
      .createWorkflow({ id: 't55-wf', inputSchema: T55_N, outputSchema: T55_N })
      .then(loggedStep(core, generation, 'first'))
      .then(loggedStep(core, generation, 'block', true))
      .then(loggedStep(core, generation, 'last'))
      .commit();
    wf = workflow;
    const out = (r: any) => r?.output?.value ?? r?.output;
    return new core.Agent({
      id: 't55-agent',
      name: 't55',
      instructions: 'Run the workflow with n=1, then report its status.',
      model: createScriptModel(p => {
        const rs = toolResults(p);
        if (rs.length === 0) return { tools: [{ name: 'runWorkflow', args: { n: 1 } }] };
        const first: any = rs[0];
        const status = first?.output?.value?.status ?? first?.output?.status ?? null;
        void out;
        return { text: `workflow ${JSON.stringify(status)}` };
      }),
      tools: {
        runWorkflow: core.createTool({
          id: 'runWorkflow',
          description: 'Run the workflow with n.',
          inputSchema: T55_N,
          execute: async ({ n }: any) => {
            log.push({ tool: 'runWorkflow', event: 'start', n, generation });
            const run = await wf.createRun({ runId: wfRunId });
            const r = await run.start({ inputData: { n } });
            log.push({ tool: 'runWorkflow', event: 'commit', n, status: r.status, generation });
            return { status: r.status, result: r.result ?? null, suspended: r.suspended ?? null };
          },
        }),
      },
      memory,
    });
  };

  let threw: string | null = null;
  let chunks: any[] = [];
  let storage: any = null;
  try {
    const recovered = await freshRecover({
      engine,
      id: 't55',
      runId,
      gate,
      build,
      start: gen1 => gen1.runner.stream('Go.', { memory: memoryKey, runId, maxSteps: 4 }),
      mastraExtra: () => ({ workflows: { [wf.id]: wf } }),
    });
    storage = recovered.storage;
    chunks = (await drain(recovered.result)).chunks;
  } catch (error) {
    threw = String((error as Error)?.message ?? error).slice(0, 300);
  }

  const results = chunks
    .filter(c => c.type === 'tool-result')
    .map(c => c.payload?.result?.status ?? c.payload?.result?.value?.status ?? null);
  const commits = log
    .filter(e => e.tool === 'runWorkflow' && e.event === 'commit')
    .map(e => ({ status: e.status, generation: e.generation }));
  const snapshot = storage ? await readRow(storage, wfRunId, 't55-wf') : null;

  return {
    engine,
    threw,
    results,
    commits,
    workflowSnapshot: snapshot?.status ?? null,
    gen2Steps: log.filter(e => e.generation === 2 && e.step).map(e => `${e.step}:${e.event}`),
    types: chunks.map(c => c.type),
  };
}

function t55Test(engine: 'durable' | 'evented') {
  agreementTest(`T55.${engine}-recover.wf-as-tool`, async rec => {
    const state = await t55Run(engine);
    rec.observe('state', state);

    rec.check('the run completed', state.threw === null, state.threw ?? 'no error');
    rec.check('recovered run finished', state.types.includes('finish'), state.types);
    rec.check(
      'tool re-executed after recovery',
      state.commits.some(c => c.generation === 2),
      state.commits,
    );
  });
}

describe('T55 wf-as-tool', () => {
  for (const engine of ['durable', 'evented'] as const) t55Test(engine);
});

// ---------------------------------------------------------------------------
// Batch 2 — the hand-drive class.
//
// Generation 1 ends *suspended* (tool suspend / tool approval), so `recover()`
// and `restart()` refuse it (core's `createRestartExecutionParams` only accepts
// running/waiting runs). Generation 2 is therefore driven exactly like the
// harness's recover phase: `resume(runId, data, {toolCallId, memory})` for
// suspension, `approveToolCall({runId, toolCallId, memory})` for approval.
// ---------------------------------------------------------------------------

/** Parks generation 1 until `ready` resolves, then hands generation 2 to `drive`. */
async function freshHandoff(opts: {
  engine: 'durable' | 'evented';
  id: string;
  runId: string;
  build: (ctx: { core: any; storage: any; memory: any; generation: number }) => any;
  start: (gen1: Gen) => Promise<any> | any;
  ready: (gen1: Gen, storage: any) => Promise<any>;
  drive: (gen2: Gen, parked: any, storage: any) => Promise<any>;
  mastraExtra?: (ctx: { core: any; storage: any; memory: any; generation: number }) => Record<string, unknown>;
  memory?: (ctx: { MockMemory: any; core: any; storage: any; generation: number }) => any;
}) {
  const storage = await newStorage();
  const gen1 = await buildAgreementGraph({
    storage,
    id: opts.id,
    engine: opts.engine,
    build: opts.build,
    generation: 1,
    mastraExtra: opts.mastraExtra,
    memory: opts.memory,
  });
  liveGraphs.push(gen1);
  const parked = Promise.resolve()
    .then(() => opts.start(gen1))
    .catch(() => undefined);
  const parkedRow = await opts.ready(gen1, storage);
  const gen2 = await buildAgreementGraph({
    storage,
    id: opts.id,
    engine: opts.engine,
    build: opts.build,
    generation: 2,
    mastraExtra: opts.mastraExtra,
    memory: opts.memory,
  });
  liveGraphs.push(gen2);
  const result = await opts.drive(gen2, parkedRow, storage);
  void parked;
  return { gen1, gen2, storage, parkedRow, result };
}

/** Waits for the durable run row to reach a status (harness polls every 100 ms for 10 s). */
async function waitForStatus(storage: any, runId: string, status: string) {
  return waitFor(async () => {
    const row: any = await readRow(storage, runId, DurableStepIds.AGENTIC_LOOP);
    return row?.status === status ? row : undefined;
  });
}

// ---------------------------------------------------------------------------
// T13 — tool suspension across a restart while suspended (`durable-recover`/yes).
// ---------------------------------------------------------------------------

const T13_SCRIPT_TEXT = 'answered';

function confirmTool(core: any, log: any[], generation: number) {
  return core.createTool({
    id: 'confirm',
    description: 'Ask the user to confirm a payment. Suspends until they answer.',
    inputSchema: z.object({ amount: z.number() }),
    suspendSchema: z.object({ prompt: z.string() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async ({ amount }: { amount: number }, context: any) => {
      const resumeData = (context as any)?.agent?.resumeData as { confirmed: boolean } | undefined;
      log.push({ tool: 'confirm', event: resumeData ? 'resumed' : 'start', amount, generation, at: Date.now() });
      if (!resumeData) return (context as any)?.agent?.suspend?.({ prompt: `Pay ${amount}?` });
      if (resumeData.confirmed) log.push({ tool: 'confirm', event: 'commit', amount, generation, at: Date.now() });
      return { confirmed: resumeData.confirmed, amount };
    },
  });
}

async function t13Run(engine: 'durable' | 'evented') {
  const storage = await newStorage();
  const log: any[] = [];
  const memory = { thread: 't13-thread-agreement', resource: 't13-resource-agreement' };
  const runId = 't13-run-agreement';
  const build = ({ core, memory: mem, generation }: any) =>
    new core.Agent({
      id: 't13-agent',
      instructions: 'Follow the script.',
      model: createScriptModel(p =>
        toolResults(p).length
          ? { text: `${T13_SCRIPT_TEXT} ${JSON.stringify(toolResults(p).at(-1))}` }
          : { tools: [{ name: 'confirm', args: { amount: 42 } }] },
      ),
      tools: { confirm: confirmTool(core, log, generation) },
      memory: mem,
    });

  let toolCallId: string | undefined;
  let main: any = { chunks: [] };
  let startError: string | null = null;
  const handoff = await freshHandoff({
    engine,
    id: 't13',
    runId,
    build,
    start: async gen1 => {
      try {
        // `DurableAgent.stream()` is async: it resolves once the run has started.
        main = await drain(await gen1.runner.stream('Pay 42.', { memory, runId, maxSteps: 4 }), {
          stopOn: (c: any) => c.type === 'tool-call-suspended',
        });
      } catch (error: any) {
        startError = String(error?.stack ?? error?.message ?? error).slice(0, 500);
      }
      toolCallId = main.chunks.find((c: any) => c.type === 'tool-call-suspended')?.payload?.toolCallId;
    },
    ready: (_gen1, s) => waitForStatus(s, runId, 'suspended'),
    drive: async gen2 => drain(await gen2.runner.resume(runId, { confirmed: true }, { toolCallId, memory })),
  });

  const resumed = handoff.result as any;
  const messages = await persisted(storage, memory.thread, memory.resource);
  return {
    engine,
    startError,
    persistedCount: messages.length,
    persistedRoles: messages.map((m: any) => m.role),
    parkedStatus: handoff.parkedRow?.status ?? null,
    mainTypes: main.chunks.map((c: any) => c.type),
    resumedTypes: resumed.chunks.map((c: any) => c.type),
    events: log.map(e => e.event),
    commits: log.filter(e => e.event === 'commit').length,
    resumedResult: resumed.chunks.find((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'confirm')
      ?.payload?.result,
  };
}

function t13Test(engine: 'durable' | 'evented') {
  agreementTest(`T13.${engine}-recover.tool-suspend`, async rec => {
    const state = await t13Run(engine);
    rec.observe('state', state);

    rec.check('run suspended on the tool', state.mainTypes.includes('tool-call-suspended'), state.mainTypes);
    rec.check(
      'suspended segment has no error',
      !state.mainTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.mainTypes,
    );
    rec.check(
      'tool ran once before suspending and once on resume',
      state.events.filter(e => e === 'start').length === 1 && state.events.filter(e => e === 'resumed').length === 1,
      state.events,
    );
    rec.check(
      'resumed segment settled with one finish and no error',
      state.resumedTypes.filter((t: string) => t === 'finish').length === 1 &&
        !state.resumedTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.resumedTypes,
    );
    rec.check(
      'resume data reached the tool and its result reached the stream',
      state.resumedResult?.confirmed === true && state.resumedResult?.amount === 42,
      state.resumedResult,
    );
    rec.check('side effect committed exactly once', state.commits === 1, state.commits);
    rec.check('resumed by the restarted process', state.parkedStatus === 'suspended', state.parkedStatus);
    unmeasured(rec, 'one persisted confirm result, none left suspended');
  });
}

describe('T13 tool-suspend', () => {
  for (const engine of ['durable', 'evented'] as const) t13Test(engine);
});

// ---------------------------------------------------------------------------
// T6 — tool approval across a restart while suspended (`durable-recover`/approve).
// ---------------------------------------------------------------------------

function transferTool(core: any, log: any[], generation: number) {
  return core.createTool({
    id: 'transfer',
    description: 'Transfer an amount. Requires human approval.',
    inputSchema: z.object({ amount: z.number() }),
    requireApproval: true,
    execute: async ({ amount }: { amount: number }, context: any) => {
      const resumeData = (context as any)?.agent?.resumeData ?? null;
      log.push({ tool: 'transfer', event: 'start', generation, amount, resumeData, at: Date.now() });
      log.push({ tool: 'transfer', event: 'commit', generation, amount, resumeData, at: Date.now() });
      return { transferred: amount, confirmation: 'TX-42' };
    },
  });
}

async function t6Run(engine: 'durable' | 'evented') {
  const storage = await newStorage();
  const log: any[] = [];
  const memory = { thread: 't6-thread-agreement', resource: 't6-resource-agreement' };
  const runId = 't6-run-agreement';
  const build = ({ core, memory: mem, generation }: any) =>
    new core.Agent({
      id: 't6-agent',
      instructions: 'Call tools exactly as instructed. If a tool is declined, say it was declined and stop.',
      model: createScriptModel(p =>
        toolResults(p).length
          ? { text: `Transfer result: ${JSON.stringify(toolResults(p)[0]?.output ?? null)}` }
          : { tools: [{ name: 'transfer', args: { amount: 42 } }] },
      ),
      tools: { transfer: transferTool(core, log, generation) },
      memory: mem,
    });

  let toolCallId: string | undefined;
  let approvalAt = 0;
  let main: any = { chunks: [] };
  const handoff = await freshHandoff({
    engine,
    id: 't6',
    runId,
    build,
    start: async gen1 => {
      main = await drain(
        await gen1.runner.stream('Call transfer exactly once with amount 42, then confirm the transfer.', {
          memory,
          runId,
          maxSteps: 4,
        }),
        { stopOn: (c: any) => c.type === 'tool-call-approval' },
      );
      const approval = main.chunks.find((c: any) => c.type === 'tool-call-approval');
      toolCallId = approval?.payload?.toolCallId;
      approvalAt = Date.now();
    },
    ready: (_gen1, s) => waitForStatus(s, runId, 'suspended'),
    drive: async gen2 => drain(await gen2.runner.approveToolCall({ runId, toolCallId, memory })),
  });

  const resumed = handoff.result as any;
  const messages = await persisted(storage, memory.thread, memory.resource);
  const parts = (await toolParts(messages)).filter((p: any) => p.toolName === 'transfer');
  const commits = log.filter(e => e.event === 'commit');
  return {
    engine,
    parkedStatus: handoff.parkedRow?.status ?? null,
    mainTypes: main.chunks.map((c: any) => c.type),
    resumedTypes: resumed.chunks.map((c: any) => c.type),
    commits,
    noSideEffectBeforeApproval: log.every(e => e.at >= approvalAt),
    publicResults: resumed.chunks.filter((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'transfer')
      .length,
    parts: parts.map((p: any) => p.state),
    text: textOf(resumed.chunks),
    userMessages: messages.filter((m: any) => m.role === 'user').length,
  };
}

function t6Test(engine: 'durable' | 'evented') {
  agreementTest(`T6.${engine}-recover.tool-approval`, async rec => {
    const state = await t6Run(engine);
    rec.observe('state', state);

    // Harness compares wall-clock `at` against the approval chunk; the fresh-graph
    // analogue is that the tool never ran in generation 1 (`every` on the log).
    rec.check(
      'no side effect before the approval request was surfaced',
      state.noSideEffectBeforeApproval && state.commits.every(c => c.generation === 2),
      { commits: state.commits },
    );
    rec.check(
      'first segment suspended cleanly (no error chunk)',
      !state.mainTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.mainTypes,
    );
    rec.check(
      'resumed segment settled with a finish and no error',
      state.resumedTypes.filter((t: string) => t === 'finish').length >= 1 &&
        !state.resumedTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.resumedTypes,
    );
    rec.check(
      'tool executed exactly once, after approval',
      state.commits.length === 1 && state.commits[0]?.amount === 42,
      state.commits,
    );
    rec.check('executed by the restarted process', state.commits[0]?.generation === 2, state.commits);
    rec.check('public tool-result for the approved call', state.publicResults === 1, state.publicResults);
    unmeasured(rec, 'one persisted result, none orphaned');
    rec.check('final text confirms', /TX-42|42/.test(state.text), state.text.slice(-200));
    rec.check(
      'restart happened while suspended on the approval',
      state.parkedStatus === 'suspended',
      state.parkedStatus,
    );
    unmeasured(rec, 'exactly one persisted user message');
  });
}

describe('T6 tool-approval', () => {
  for (const engine of ['durable', 'evented'] as const) t6Test(engine);
});

// ---------------------------------------------------------------------------
// T12 — sub-agent delegation recovered mid-step (run is *running*, so the
// ordinary `recover()` path applies).
// ---------------------------------------------------------------------------

async function t12Run(engine: 'durable' | 'evented') {
  const log: any[] = [];
  const gate = createGate();
  const memory = { thread: 't12-thread-agreement', resource: 't12-resource-agreement' };
  const runId = 't12-run-agreement';
  const build = ({ core, memory: mem, generation }: any) => {
    const worker = new core.Agent({
      id: 't12-worker',
      name: 'worker',
      description: 'Performs the numbered steps.',
      instructions: 'Follow the script.',
      model: createScriptModel(p => {
        const done = toolResults(p).length;
        return done < 2 ? { tools: [{ name: 'step', args: { n: done + 1 } }] } : { text: `finished ${done} steps` };
      }),
      tools: { step: stepTool(core, gate, 2, log, generation) },
    });
    const supervisor = new core.Agent({
      id: 't12-supervisor',
      name: 'supervisor',
      instructions: 'Follow the script.',
      model: createScriptModel(p =>
        toolResults(p).length
          ? { text: `delegated ${JSON.stringify(toolResults(p).at(-1))}` }
          : { tools: [{ name: 'agent-worker', args: { prompt: 'Do both steps.' } }] },
      ),
      agents: { worker },
      memory: mem,
    });
    return { supervisor, worker };
  };

  const { gen2, result } = await freshRecover({
    engine,
    id: 't12',
    runId,
    gate,
    build: ({ core, memory: mem, generation }: any) => build({ core, memory: mem, generation }).supervisor,
    start: gen1 => gen1.runner.stream('Get the steps done.', { memory, runId, maxSteps: 4 }),
  });
  const list = await drain(result);

  const steps = log
    .filter(e => e.tool === 'step' && e.event === 'commit')
    .map(e => ({ n: e.n, generation: e.generation }));
  const byN = (n: number) => steps.filter(s => s.n === n).length;
  const delegation = list.chunks.find((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'agent-worker');
  const parts = (await toolParts(await persisted(gen2.storage, memory.thread, memory.resource))).filter(
    (p: any) => p.toolName === 'agent-worker',
  );
  return {
    engine,
    types: list.chunks.map((c: any) => c.type),
    steps,
    byN1: byN(1),
    byN2: byN(2),
    perGen1: [1, 2].every(g => steps.filter(s => s.n === 1 && s.generation === g).length <= 1),
    delegationResult: delegation?.payload?.result ?? null,
    text: textOf(list.chunks),
    parts: parts.map((p: any) => p.state),
    step2Generation: steps.find(s => s.n === 2)?.generation ?? null,
  };
}

function t12Test(engine: 'durable' | 'evented') {
  agreementTest(`T12.${engine}-recover.sub-agent`, async rec => {
    const state = await t12Run(engine);
    rec.observe('state', state);

    // Harness `notExercised`s when the run ended before step 2; in this file that is a
    // failing check so a vacuous pass cannot hide a port that never reached the gate.
    rec.check(
      'worker reached step 2 before the crash',
      state.steps.some(s => s.n === 2),
      state.steps,
    );
    rec.check(
      'run settled with exactly one finish and no error',
      state.types.filter((t: string) => t === 'finish').length === 1 && !state.types.includes('error'),
      state.types,
    );
    rec.check(
      'worker step 1 committed at most once per generation (atomic delegation, COR-1313)',
      state.byN1 >= 1 && state.perGen1,
      state.steps,
    );
    rec.check('worker step 2 committed exactly once', state.byN2 === 1, state.steps);
    rec.check(
      'worker answer reached the supervisor',
      /finished 2 steps/.test(JSON.stringify(state.delegationResult ?? '')),
      state.delegationResult,
    );
    rec.check('supervisor answered after delegating', state.text.startsWith('delegated'), state.text);
    rec.check('interrupted step finished in the restarted process', state.step2Generation === 2, state.steps);
    unmeasured(rec, 'one persisted delegation result');
  });
}

describe('T12 sub-agent-delegation', () => {
  for (const engine of ['durable', 'evented'] as const) t12Test(engine);
});

// ---------------------------------------------------------------------------
// T41 — working memory lives in storage, not the process (`durable-recover`/template).
// ---------------------------------------------------------------------------

const T41_PROFILE_1 = '# Profile\n- name: Ada\n- pref: WM_DARK_MODE';
const T41_PROFILE_2 = '# Profile\n- name: Ada\n- pref: WM_LIGHT_MODE';

const systemTextOf = (prompt: any[]) =>
  (prompt ?? [])
    .filter(m => m?.role === 'system')
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n');

async function t41Run(engine: 'durable' | 'evented') {
  const storage = await newStorage();
  const resourceId = 't41-resource-agreement';
  const threadA = 't41-thread-a-agreement';
  const requests: { generation: number; prompt: any[] }[] = [];
  // Vehicle caveat (scope substitution): the harness `template` cell uses
  // `scope: 'thread'`, where the real `@mastra/memory` Memory stores working memory in
  // the thread row and the working-memory injector reads it back from there. Core's
  // MockMemory has no message/thread write path — `getWorkingMemory`/`updateWorkingMemory`
  // always address the *resource* row (`mock.ts:240`) while the thread-scope injector
  // reads `thread.metadata.workingMemory` (`processors/memory/working-memory.ts:110-111`),
  // so thread-scope injection can never be exercised here. Resource scope makes both
  // sides use the same row, so read-back-in-the-restarted-process stays measurable.
  const memory = ({ MockMemory, storage: s }: any) =>
    new MockMemory({
      storage: s,
      enableWorkingMemory: true,
      workingMemoryTemplate: '# Profile\n- name:\n- pref:',
      options: { workingMemory: { scope: 'resource' } },
    });
  const build = ({ core, memory: mem, generation }: any) =>
    new core.Agent({
      id: 't41-agent',
      instructions: 'Follow the script.',
      model: createScriptModel(
        p => {
          const user = lastUserText(p) ?? '';
          const m = user.match(/^store (\d)$/);
          if (m && !toolResults(p).length) {
            return {
              tools: [{ name: 'updateWorkingMemory', args: { memory: m[1] === '1' ? T41_PROFILE_1 : T41_PROFILE_2 } }],
            };
          }
          return { text: m ? `stored ${m[1]}` : 'recalled' };
        },
        { onCall: (prompt: any[]) => requests.push({ generation, prompt }) },
      ),
      memory: mem,
    });

  const turn = async (gen: Gen, prompt: string, label: string) =>
    drain(
      await gen.runner.stream(prompt, {
        memory: { thread: threadA, resource: resourceId },
        runId: `t41-${label}-agreement`,
        maxSteps: 3,
      }),
    );

  const gen1 = await buildAgreementGraph({ storage, id: 't41', engine, build, generation: 1, memory });
  liveGraphs.push(gen1);
  const turn1 = await turn(gen1, 'store 1', 'turn1');

  // The process "dies" between the turns: generation 2 is a fresh module graph over
  // the same storage, and turn 2 runs there.
  const gen2 = await buildAgreementGraph({ storage, id: 't41', engine, build, generation: 2, memory });
  liveGraphs.push(gen2);
  const turn2 = await turn(gen2, 'what do you know?', 'turn2');

  const stored = await gen2.memory.getWorkingMemory({ threadId: threadA, resourceId });
  const messages = await persisted(storage, threadA, resourceId);
  const gen2System = requests
    .filter(r => r.generation === 2)
    .map(r => systemTextOf(r.prompt))
    .join('\n');

  return {
    engine,
    turn1Types: turn1.chunks.map((c: any) => c.type),
    turn2Types: turn2.chunks.map((c: any) => c.type),
    stored,
    gen2System,
    modelCalls: requests.length,
    persistedRoles: messages.map((m: any) => m.role),
    toolParts: (await toolParts(messages)).map((p: any) => p.toolName),
  };
}

function t41Test(engine: 'durable' | 'evented') {
  agreementTest(`T41.${engine}-recover.working-memory`, async rec => {
    const state = await t41Run(engine);
    rec.observe('state', state);

    rec.check(
      'turn 1 called updateWorkingMemory and finished',
      state.turn1Types.includes('tool-call') && state.turn1Types.includes('finish'),
      state.turn1Types,
    );
    rec.check('working memory persisted in storage', (state.stored ?? '').includes('WM_DARK_MODE'), state.stored);
    rec.check(
      'working memory injected into the last turn system prompt',
      state.gen2System.includes('WM_DARK_MODE'),
      state.gen2System,
    );
    rec.check(
      'last turn (turn2) settled without error',
      state.turn2Types.filter((t: string) => t === 'finish').length === 1 &&
        !state.turn2Types.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.turn2Types,
    );
    rec.check(
      'turn 2 in the restarted process saw the stored profile',
      state.gen2System.includes('WM_DARK_MODE'),
      state.gen2System,
    );
    rec.observe(
      'scopeSubstitution',
      "harness template cell uses scope:'thread'; core MockMemory cannot inject thread-scoped working memory (resource-row storage vs thread-metadata read), so this cell runs scope:'resource'",
    );
    unmeasured(rec, 'updateWorkingMemory not persisted as a visible tool part');
    rec.observe('toolPartsSeenInStream', state.toolParts);
  });
}

describe('T41 working-memory', () => {
  for (const engine of ['durable', 'evented'] as const) t41Test(engine);
});

// ---------------------------------------------------------------------------
// T51 — a tool suspends inside a sub-agent; the resume is addressed to the outer
// delegation call (`durable-recover`).
// ---------------------------------------------------------------------------

const T51_WORKER_TEXT = 'worker done';

async function t51Run(engine: 'durable' | 'evented') {
  const storage = await newStorage();
  const log: any[] = [];
  const memory = { thread: 't51-thread-agreement', resource: 't51-resource-agreement' };
  const runId = 't51-run-agreement';
  const build = ({ core, memory: mem, generation }: any) => {
    const worker = new core.Agent({
      id: 't51-worker',
      name: 'worker',
      instructions: 'Follow the script.',
      model: createScriptModel(p =>
        toolResults(p).length
          ? { text: `${T51_WORKER_TEXT} ${JSON.stringify(toolResults(p).at(-1)?.output ?? null)}` }
          : { tools: [{ name: 'confirm', args: { amount: 42 } }] },
      ),
      tools: { confirm: confirmTool(core, log, generation) },
    });
    return new core.Agent({
      id: 't51-supervisor',
      name: 'supervisor',
      instructions: 'Follow the script.',
      model: createScriptModel(p =>
        toolResults(p).length
          ? { text: `delegated ${JSON.stringify(toolResults(p).at(-1)?.output ?? null)}` }
          : { tools: [{ name: 'agent-worker', args: { prompt: 'Pay 42.' } }] },
      ),
      agents: { worker },
      memory: mem,
    });
  };

  let toolCallId: string | undefined;
  let suspendedPayload: any = null;
  let main: any = { chunks: [] };
  const handoff = await freshHandoff({
    engine,
    id: 't51',
    runId,
    build,
    start: async gen1 => {
      main = await drain(await gen1.runner.stream('Delegate the payment.', { memory, runId, maxSteps: 6 }), {
        stopOn: (c: any) => c.type === 'tool-call-suspended',
      });
      const suspended = main.chunks.find((c: any) => c.type === 'tool-call-suspended');
      toolCallId = suspended?.payload?.toolCallId;
      suspendedPayload = suspended?.payload ?? null;
    },
    ready: (_gen1, s) => waitForStatus(s, runId, 'suspended'),
    drive: async gen2 => drain(await gen2.runner.resume(runId, { confirmed: true }, { toolCallId, memory })),
  });

  const resumed = handoff.result as any;
  const parts = (await toolParts(await persisted(storage, memory.thread, memory.resource))).filter(
    (p: any) => p.toolName === 'agent-worker',
  );
  const delegation = resumed.chunks.find((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'agent-worker')
    ?.payload?.result;
  const delegationText = typeof delegation === 'string' ? delegation : JSON.stringify(delegation ?? null);
  return {
    engine,
    parkedStatus: handoff.parkedRow?.status ?? null,
    mainTypes: main.chunks.map((c: any) => c.type),
    resumedTypes: resumed.chunks.map((c: any) => c.type),
    suspendedToolName: suspendedPayload?.toolName ?? null,
    suspendedPayload: JSON.stringify(suspendedPayload?.suspendPayload ?? null),
    events: log.filter(e => e.tool === 'confirm').map(e => e.event),
    commits: log.filter(e => e.tool === 'confirm' && e.event === 'commit').length,
    resumedGeneration: log.find(e => e.tool === 'confirm' && e.event === 'resumed')?.generation ?? null,
    delegationText,
    parts: parts.map((p: any) => p.state),
  };
}

function t51Test(engine: 'durable' | 'evented') {
  agreementTest(`T51.${engine}-recover.sub-agent-suspend`, async rec => {
    const state = await t51Run(engine);
    rec.observe('state', state);

    rec.check(
      'sub-agent suspension surfaced on the supervisor stream',
      state.mainTypes.includes('tool-call-suspended'),
      state.mainTypes,
    );
    rec.check(
      'suspended segment has no error',
      !state.mainTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.mainTypes,
    );
    rec.check(
      'suspension addressed the outer delegation and carries the inner prompt',
      state.suspendedToolName === 'agent-worker' && state.suspendedPayload.includes('Pay 42'),
      { toolName: state.suspendedToolName, suspendPayload: state.suspendedPayload },
    );
    rec.check(
      'confirm ran once before suspending and once on resume',
      state.events.filter(e => e === 'start').length === 1 && state.events.filter(e => e === 'resumed').length === 1,
      state.events,
    );
    rec.check('side effect committed exactly once', state.commits === 1, state.commits);
    rec.check(
      'resumed segment settled with one finish and no error',
      state.resumedTypes.filter((t: string) => t === 'finish').length === 1 &&
        !state.resumedTypes.some((t: string) => ['error', 'abort', 'tripwire'].includes(t)),
      state.resumedTypes,
    );
    rec.check(
      'confirmed result flowed worker -> supervisor',
      state.delegationText.includes(T51_WORKER_TEXT) && state.delegationText.includes('"confirmed":true'),
      state.delegationText.slice(0, 300),
    );
    rec.check('resumed by the restarted process', state.resumedGeneration === 2, state.resumedGeneration);
    unmeasured(rec, 'one persisted delegation result, none left suspended');
  });
}

describe('T51 sub-agent-suspend', () => {
  for (const engine of ['durable', 'evented'] as const) t51Test(engine);
});
