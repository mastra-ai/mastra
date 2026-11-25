import { canonicalJson, knowledgeImporterFlushDigest } from './host';
import type { KnowledgeImporterHost, KnowledgeImporterRunStart } from './host';
import type {
  KnowledgeImporterFinishRequest,
  KnowledgeImporterFlushReceipt,
  KnowledgeImporterOp,
  KnowledgeImporterState,
} from './types';

/**
 * A host under test. Each case calls the factory for a fresh host whose `bindingId` exists, has no
 * run going, and has never been flushed to.
 * @experimental
 */
export interface KnowledgeImporterHostConformanceFixture {
  host: KnowledgeImporterHost;
  bindingId: string;
  cleanup?: () => Promise<void>;
}

/** @experimental */
export interface KnowledgeImporterHostConformanceCase {
  name: string;
  run: () => Promise<void>;
}

/**
 * The protocol every {@link KnowledgeImporterHost} keeps, as framework-free cases: run each one as a
 * test (`for (const c of importerHostConformance(factory)) it(c.name, c.run)`). A case throws when
 * the host breaks the protocol. It checks only what the runner relies on (sequencing, digests,
 * replay, generations, finish, heartbeat, state), not where pages land.
 * @experimental
 */
export function importerHostConformance(
  factory: () => Promise<KnowledgeImporterHostConformanceFixture>,
): KnowledgeImporterHostConformanceCase[] {
  const cases: [string, (t: Session) => Promise<void>][] = [
    [
      'starts a run at seq 0 with empty state, and skips a second start while it runs',
      async t => {
        const run = await t.start();
        check(run.lastSeq === 0, `a first run starts at lastSeq 0, got ${run.lastSeq}`);
        check(Object.keys(run.state).length === 0, 'a first run starts with empty state');
        const second = await t.host.startRun(t.bindingId);
        check(second.status === 'skipped', `a second start while a run is going is skipped, got ${second.status}`);
      },
    ],
    [
      'applies flushes in seq order and returns a receipt for each',
      async t => {
        const run = await t.start();
        const first = await t.flush(run, 1, [upsert('a')]);
        check(first.seq === 1, `the receipt names its seq, got ${first.seq}`);
        check(first.created === 1, `one new item is one created page, got ${first.created}`);
        const second = await t.flush(run, 2, []);
        check(second.seq === 2, 'an empty flush is a valid next seq');
      },
    ],
    [
      'replays a committed seq to the same receipt and refuses other content for it',
      async t => {
        const run = await t.start();
        const ops = [upsert('a')];
        const first = await t.flush(run, 1, ops);
        const again = await t.flush(run, 1, ops);
        check(same(first, again), 'resending a committed flush returns its stored receipt');
        await refused(() => t.flush(run, 1, [upsert('b')]), 409, 'digest_mismatch');
        // Other content sent with the committed digest: the host recomputes, it doesn't trust it.
        const digest = await knowledgeImporterFlushDigest({ ops });
        await refused(
          () => t.host.flush({ runId: run.runId, generation: run.generation, seq: 1, digest, ops: [upsert('b')] }),
          409,
          'digest_mismatch',
        );
        check(same(first, await t.flush(run, 1, ops)), 'an exact replay still returns the stored receipt');
        const next = await t.flush(run, 2, []);
        check(next.seq === 2, 'the replay did not advance the seq');
      },
    ],
    [
      'refuses a seq gap',
      async t => {
        const run = await t.start();
        await refused(() => t.flush(run, 2, [upsert('a')]), 409, 'seq_mismatch');
        await t.flush(run, 1, [upsert('a')]);
      },
    ],
    [
      'recomputes the digest and refuses one that does not match the content',
      async t => {
        const run = await t.start();
        const digest = await knowledgeImporterFlushDigest({ ops: [upsert('a')] });
        await refused(
          () => t.host.flush({ runId: run.runId, generation: run.generation, seq: 1, digest, ops: [upsert('b')] }),
          409,
          'digest_mismatch',
        );
      },
    ],
    [
      'refuses a flush or finish from another generation',
      async t => {
        const run = await t.start();
        const stale = { ...run, generation: run.generation + 1 };
        await refused(() => t.flush(stale, 1, [upsert('a')]), 409, 'stale_generation');
        await refused(() => t.finish(stale, { lastSeq: 0 }), 409, 'stale_generation');
        await toldToStop(() => t.host.heartbeat(run.runId, run.generation + 1), 'stale_generation');
      },
    ],
    [
      'refuses a malformed flush without applying it',
      async t => {
        const run = await t.start();
        const ops = [{ op: 'upsert', item: { sourceId: 'a' } }] as unknown as KnowledgeImporterOp[];
        // The host parses the body before it looks at the digest, so any digest gets a 400.
        await refused(
          () => t.host.flush({ runId: run.runId, generation: run.generation, seq: 1, digest: '0'.repeat(64), ops }),
          400,
        );
        await t.flush(run, 1, [upsert('a')]);
      },
    ],
    [
      'keeps a running run alive on heartbeat',
      async t => {
        const run = await t.start();
        const beat = await t.host.heartbeat(run.runId, run.generation);
        check(beat.cancel === false, 'a live run is not told to cancel');
      },
    ],
    [
      'finishes at the committed seq, sums counts from receipts, and replays the finish exactly',
      async t => {
        const run = await t.start();
        await t.flush(run, 1, [upsert('a'), upsert('b')]);
        await refused(() => t.finish(run, { lastSeq: 2 }), 409, 'seq_mismatch');
        const receipt = await t.finish(run, { lastSeq: 1 });
        check(receipt.outcome === 'succeeded' && receipt.lastSeq === 1, 'the receipt records the finish');
        check(receipt.counts.created === 2, `counts come from flush receipts, got ${receipt.counts.created}`);
        check(receipt.chain === false, 'a run with no backlog and no settle work does not chain');
        check(same(receipt, await t.finish(run, { lastSeq: 1 })), 'an identical finish replays its receipt');
        await refused(() => t.finish(run, { lastSeq: 1, backlog: true }), 409, 'finish_mismatch');
        await refused(() => t.finish(run, { lastSeq: 1, outcome: 'canceled' }), 409, 'finish_mismatch');
      },
    ],
    [
      'chains a succeeded run that reports backlog',
      async t => {
        const run = await t.start();
        const receipt = await t.finish(run, { lastSeq: 0, backlog: true });
        check(receipt.backlog === true && receipt.chain === true, 'backlog is chained');
      },
    ],
    [
      'records a failed run with its fixed error code',
      async t => {
        const run = await t.start();
        const receipt = await t.finish(run, {
          lastSeq: 0,
          outcome: 'failed',
          error: { code: 'source_unreachable', retryable: true, httpStatus: 503 },
        });
        check(receipt.outcome === 'failed', 'the outcome is recorded');
        check(
          receipt.error?.code === 'source_unreachable' && receipt.error.httpStatus === 503,
          'the error code and status are recorded',
        );
        check(receipt.chain === false, 'a failed run does not chain');
      },
    ],
    [
      'after a finish, refuses new flushes and still replays committed ones',
      async t => {
        const run = await t.start();
        const ops = [upsert('a')];
        const first = await t.flush(run, 1, ops);
        await t.finish(run, { lastSeq: 1 });
        check(same(first, await t.flush(run, 1, ops)), 'a committed flush still replays after the finish');
        await refused(() => t.flush(run, 2, []), 409, 'run_not_active');
        await toldToStop(() => t.host.heartbeat(run.runId, run.generation), 'run_not_active');
      },
    ],
    [
      'hands the next run the state the last committed flush saved, and lets it start',
      async t => {
        const run = await t.start();
        await t.flush(run, 1, [upsert('a')], { cursor: '1' });
        await t.flush(run, 2, [], { cursor: '2', page: 'x' });
        await t.finish(run, { lastSeq: 2 });
        const next = await t.start();
        check(next.runId !== run.runId, 'the next run has its own id');
        check(next.lastSeq === 0, 'seq starts over for each run');
        check(next.state.cursor === '2' && next.state.page === 'x', 'state is what the last flush saved');
      },
    ],
    [
      'saves no state from a refused flush',
      async t => {
        const run = await t.start();
        await t.flush(run, 1, [], { cursor: '1' });
        await refused(() => t.flush(run, 3, [], { cursor: '3' }), 409, 'seq_mismatch');
        await t.finish(run, { lastSeq: 1 });
        const next = await t.start();
        check(next.state.cursor === '1', `a refused flush saves nothing, got cursor ${next.state.cursor}`);
      },
    ],
  ];

  return cases.map(([name, body]) => ({
    name,
    run: async () => {
      const fixture = await factory();
      try {
        await body(session(fixture));
      } finally {
        await fixture.cleanup?.();
      }
    },
  }));
}

type Started = Extract<KnowledgeImporterRunStart, { status: 'started' }>;
type Run = Pick<Started, 'runId' | 'generation'>;

interface Session {
  host: KnowledgeImporterHost;
  bindingId: string;
  start(): Promise<Started>;
  flush(
    run: Run,
    seq: number,
    ops: KnowledgeImporterOp[],
    state?: KnowledgeImporterState,
  ): Promise<KnowledgeImporterFlushReceipt>;
  finish(
    run: Run,
    request: Partial<Omit<KnowledgeImporterFinishRequest, 'runId' | 'generation'>> & { lastSeq: number },
  ): ReturnType<KnowledgeImporterHost['finishRun']>;
}

function session({ host, bindingId }: KnowledgeImporterHostConformanceFixture): Session {
  return {
    host,
    bindingId,
    async start() {
      const started = await host.startRun(bindingId);
      check(started.status === 'started', `the binding's run starts, got ${started.status}`);
      return started as Started;
    },
    async flush(run, seq, ops, state) {
      const digest = await knowledgeImporterFlushDigest(state ? { ops, state } : { ops });
      return host.flush({
        runId: run.runId,
        generation: run.generation,
        seq,
        digest,
        ops,
        ...(state ? { state } : {}),
      });
    },
    finish(run, request) {
      return host.finishRun({
        runId: run.runId,
        generation: run.generation,
        outcome: 'succeeded',
        backlog: false,
        ...request,
      });
    },
  };
}

const upsert = (sourceId: string): KnowledgeImporterOp => ({
  op: 'upsert',
  item: { sourceId, title: sourceId.toUpperCase(), body: `body of ${sourceId}` },
});

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Importer host conformance: ${message}`);
}

/** Equal as JSON, key order aside: a host may store receipts in a store that reorders keys. */
function same(a: unknown, b: unknown): boolean {
  return canonicalJson(JSON.parse(JSON.stringify(a))) === canonicalJson(JSON.parse(JSON.stringify(b)));
}

/**
 * A heartbeat for a run the host no longer holds must not keep it going: it answers
 * `{ cancel: true }`, or (a host that enforces a lease) refuses with a 409 and `code`. The runner
 * ignores a refused heartbeat; its next flush or finish gets the same refusal.
 */
async function toldToStop(beat: () => Promise<{ cancel: boolean }>, code: string): Promise<void> {
  let answer: { cancel: boolean } | undefined;
  let error: { status?: unknown; code?: unknown } | undefined;
  try {
    answer = await beat();
  } catch (e) {
    error = e as typeof error;
  }
  check(
    answer ? answer.cancel === true : error?.status === 409 && error.code === code,
    answer
      ? 'a heartbeat for a run the host no longer holds is told to cancel'
      : `a refused heartbeat is a 409 ${code}, got ${String(error?.status)} ${String(error?.code)}: ${String(error)}`,
  );
}

async function refused(call: () => Promise<unknown>, status: number, code?: string): Promise<void> {
  let error: { status?: unknown; code?: unknown } | undefined;
  try {
    await call();
  } catch (e) {
    error = e as typeof error;
  }
  check(error, `expected a ${status}${code ? ` ${code}` : ''} refusal, but the call succeeded`);
  check(
    error.status === status && (code === undefined || error.code === code),
    `expected a ${status}${code ? ` ${code}` : ''} refusal, got ${String(error.status)} ${String(error.code)}: ${String(error)}`,
  );
}
