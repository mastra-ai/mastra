import {
  KnowledgeImporterCredentialsError,
  KnowledgeImporterHostError,
  KnowledgeImporterSettingsError,
  KnowledgeImporterSourceError,
  KnowledgeImporterBase,
} from './define';
import type { KnowledgeImporterClass, KnowledgeImporterContext } from './define';
import { KnowledgeImporterHostConflictError, knowledgeImporterFlushDigest } from './host';
import type { KnowledgeImporterHost, KnowledgeImporterStartRunOptions } from './host';
import type {
  KnowledgeImportDeclaration,
  KnowledgeImportItem,
  KnowledgeImportRefusal,
  KnowledgeImporterFinishRequest,
  KnowledgeImporterOp,
  KnowledgeImporterRunError,
  KnowledgeImporterRunReceipt,
  KnowledgeImporterState,
} from './types';

/** @experimental */
export interface RunKnowledgeImportOptions {
  /**
   * The app's importers. An instance runs when its binding is the run's binding; a class is
   * constructed from the binding the host returns (a host that keeps bindings itself, as hosted
   * Knowledge does).
   */
  importers: readonly (KnowledgeImporterBase | KnowledgeImporterClass)[];
  host: KnowledgeImporterHost;
  bindingId: string;
  start?: KnowledgeImporterStartRunOptions;
  /** No new pass starts after this. Default 25 minutes. */
  budgetMs?: number;
  /** After the budget, how long a running pass may take before the run is stopped. Default 3 minutes. */
  graceMs?: number;
  /** Most `import` passes in one run. Default 200. */
  maxPasses?: number;
  /** Ops per flush. Default 200. */
  bufferSize?: number;
  /**
   * Largest flush request, in bytes of the request encoded as JSON (`runId`, `generation`, `seq`,
   * `digest`, `ops` and `state`): the buffer is sent before an op or a saved state would take it
   * over. An op or a state too big for a request on its own ends the run `flush_too_large` before
   * anything more is sent, and so does any request that would still be over it when sent. With a
   * limit, each pushed op is copied through JSON when handed over, so later changes to it are not
   * sent and values JSON can't carry arrive as JSON makes them. A host that
   * wraps the request, or limits its whole HTTP body, sets this a little under its limit. A host
   * can also give a limit when the run starts; the lower of the two applies. A positive whole
   * number. Default no limit.
   */
  maxFlushBytes?: number;
  /**
   * How long the oldest buffered op may wait before it is sent without waiting for a full buffer.
   * A timed flush sends items only; the cursor is still saved only by `ctx.state.set`. A positive
   * number of milliseconds, at most 2147483647. Default 30 seconds.
   */
  flushAfterMs?: number;
  /** Default 30 seconds. */
  heartbeatMs?: number;
  /** Resends of one flush or finish after a 5xx or network error. Default 8. */
  maxRetries?: number;
  /**
   * How long one call to the host may take before it counts as a lost ack (retryable: it may have
   * committed). Default 60 seconds.
   */
  hostCallTimeoutMs?: number;
  retryDelayMs?: (attempt: number) => number;
  /** The source fetch handed to the importer. Default the platform fetch. */
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

/** @experimental */
export type RunKnowledgeImportResult =
  | KnowledgeImporterRunReceipt
  /** Another run of the binding was going. */
  | { status: 'skipped'; runId: string }
  /**
   * The host couldn't be reached to record the end. The run stays open on the host until its
   * liveness check ends it; nothing more is written for it.
   */
  | { status: 'unfinished'; runId: string; lastSeq: number };

/** Waits `ms`, or until `cut` settles; the timer is cleared either way. */
async function sleep(ms: number, cut?: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([new Promise<void>(resolve => (timer = setTimeout(resolve, ms))), ...(cut ? [cut] : [])]);
  } finally {
    clearTimeout(timer);
  }
}

/** `promise`, or `onTimeout()` thrown after `ms`. */
async function within<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => (timer = setTimeout(() => reject(onTimeout()), ms))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Refusals kept on a run receipt. */
const MAX_RECEIPT_REFUSALS = 100;

const isRetryable = (error: unknown) =>
  error instanceof KnowledgeImporterHostError && (error.status === undefined || error.status >= 500);

/** The run ended for a reason that decides its outcome; buffered ops after it are dropped. */
class RunStop extends Error {
  constructor(readonly reason: 'canceled' | 'stopped' | 'flush') {
    super(`importer run ${reason}`);
  }
}

function sourceError(error: KnowledgeImporterSourceError): KnowledgeImporterRunError {
  const { status } = error;
  const httpStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  if (status === 401 || status === 403) return { code: 'source_auth_failed', retryable: false, httpStatus };
  if (status === 404) return { code: 'source_not_found', retryable: false, httpStatus };
  if (status === 429) return { code: 'source_rate_limited', retryable: true, httpStatus };
  if (status >= 500) return { code: 'source_unreachable', retryable: true, httpStatus };
  return { code: 'source_bad_response', retryable: false, httpStatus };
}

/**
 * Runs one import: starts a run on the host, calls the importer's `import` in passes, sends its items
 * in numbered flushes, and records how the run ended. Every write goes through `host`; the runner
 * never touches storage. Failures end the run with a fixed code; no exception text leaves the app.
 *
 * @experimental
 */
export async function runKnowledgeImport(options: RunKnowledgeImportOptions): Promise<RunKnowledgeImportResult> {
  const {
    host,
    budgetMs = 25 * 60_000,
    graceMs = 3 * 60_000,
    maxPasses = 200,
    bufferSize = 200,
    maxFlushBytes: ownMaxFlushBytes = Infinity,
    flushAfterMs = 30_000,
    heartbeatMs = 30_000,
    maxRetries = 8,
    hostCallTimeoutMs = 60_000,
    retryDelayMs = (attempt: number) => Math.min(250 * 2 ** attempt, 10_000),
  } = options;
  // setTimeout treats a delay above 2^31 - 1 ms (about 24.8 days) as 1 ms.
  if (!Number.isFinite(flushAfterMs) || flushAfterMs <= 0 || flushAfterMs > 2 ** 31 - 1) {
    throw new TypeError(`flushAfterMs must be a positive number of milliseconds up to 2147483647, got ${flushAfterMs}`);
  }

  if (ownMaxFlushBytes !== Infinity && !(Number.isInteger(ownMaxFlushBytes) && ownMaxFlushBytes > 0)) {
    throw new TypeError(`maxFlushBytes must be a positive whole number of bytes, got ${ownMaxFlushBytes}`);
  }

  // Bounded but never resent: a start that timed out may have opened a run, which the host's
  // liveness check reclaims.
  const started = await within(
    host.startRun(options.bindingId, options.start),
    hostCallTimeoutMs,
    () => new KnowledgeImporterHostError('host call timed out'),
  );
  if (started.status === 'skipped') return started;
  const { runId, generation } = started;
  // The host's limit, when it gives one, bounds requests as well as the option does.
  const hostMaxFlushBytes = started.maxFlushBytes;
  const maxFlushBytes =
    typeof hostMaxFlushBytes === 'number' && Number.isInteger(hostMaxFlushBytes) && hostMaxFlushBytes > 0
      ? Math.min(ownMaxFlushBytes, hostMaxFlushBytes)
      : ownMaxFlushBytes;
  const startedAt = Date.now();

  let lastSeq = started.lastSeq;
  /** A flush sent but never acknowledged: it may have committed. */
  let unsettledSeq: number | undefined;
  let state: KnowledgeImporterState = { ...started.state };
  let buffer: KnowledgeImporterOp[] = [];
  /** Encoded bytes of the ops in `buffer`, without the commas between them. */
  let bufferBytes = 0;
  let stop: RunStop | undefined;
  /** Armed while the buffer holds ops; sends them once the oldest has waited `flushAfterMs`. */
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const disarm = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  };
  /** Why a flush ended the run. Every later flush is refused, so no cursor is saved past its ops. */
  let flushFailure: KnowledgeImporterRunError | undefined;
  const controller = new AbortController();
  let deadlineHit!: () => void;
  /** Settles at the hard deadline; never otherwise. */
  const deadlinePassed = new Promise<void>(resolve => (deadlineHit = resolve));
  let wake!: () => void;
  /** Settles when the run stops for any reason, so nothing waits on an import or a backoff past it. */
  const stopped = new Promise<void>(resolve => (wake = resolve));
  const halt = (reason: RunStop['reason']) => {
    if (reason === 'stopped') deadlineHit();
    stop ??= new RunStop(reason);
    disarm();
    controller.abort(stop);
    wake();
  };

  /**
   * Sends with resends after a retryable failure. A call that takes longer than `hostCallTimeoutMs`
   * counts as a lost ack. Once the run has stopped, a mutation (a flush) is not resent: its
   * outcome stays unknown and the finish settles it. The finish itself is still resent.
   */
  async function withRetries<T>(send: () => Promise<T>, kind: 'mutation' | 'finish'): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await within(send(), hostCallTimeoutMs, () => new KnowledgeImporterHostError('host call timed out'));
      } catch (error) {
        if (!isRetryable(error) || attempt >= maxRetries) throw error;
        if (kind === 'mutation' && stop) throw error;
        await sleep(retryDelayMs(attempt), kind === 'mutation' ? stopped : undefined);
        if (kind === 'mutation' && stop) throw error;
      }
    }
  }

  /**
   * The last receipt said the host has settle work left. Unknown until a receipt arrives: settle
   * work can be left from an earlier run, so a run that flushes nothing still sends one empty flush.
   */
  let pending: boolean | undefined;
  const refused: KnowledgeImportRefusal[] = [];
  let flushing: Promise<void> = Promise.resolve();
  /** `settle` sends an empty flush, which only runs the host's next settle slice. */
  function flush(staged?: KnowledgeImporterState, settle = false): Promise<void> {
    disarm();
    const ops = buffer;
    buffer = [];
    bufferBytes = 0;
    const next = flushing.then(async () => {
      if (stop) throw stop;
      if (ops.length === 0 && !staged && !settle) return;
      const body = { ops, ...(staged ? { state: staged } : {}) };
      const seq = lastSeq + 1;
      let digest: string;
      try {
        digest = await knowledgeImporterFlushDigest(body);
      } catch (error) {
        // Ops the host can't take are dropped from the buffer: end the run here, however the flush
        // was triggered and whether or not the importer catches the error.
        flushFailure = { code: 'importer_error' };
        halt('flush');
        throw error;
      }
      // A stop that arrived while the digest was computed: send nothing.
      if (stop) throw stop;
      const request = { runId, generation, seq, digest, ...body };
      // The estimate that split the buffer can't cover everything (an empty settle flush, a limit
      // below the envelope): the request as sent is measured, and is never sent over the limit.
      if (maxFlushBytes !== Infinity && encodedBytes(request) > maxFlushBytes) {
        flushFailure = { code: 'flush_too_large' };
        halt('flush');
        throw stop;
      }
      unsettledSeq = seq;
      try {
        const receipt = await withRetries(() => host.flush(request), 'mutation');
        pending = receipt.pending === true;
        refused.push(...receipt.refused.slice(0, MAX_RECEIPT_REFUSALS - refused.length));
      } catch (error) {
        // A refusal (409) or a 4xx means nothing was applied; a retryable failure may have committed.
        if (!isRetryable(error)) unsettledSeq = undefined;
        flushFailure = { code: 'importer_error', retryable: isRetryable(error) };
        halt('flush');
        throw stop;
      }
      unsettledSeq = undefined;
      lastSeq = seq;
      if (staged) state = { ...state, ...staged };
    });
    flushing = next.catch(() => {});
    return next;
  }

  /** The request around the ops, at the longest `seq` it can have; `ops` empty, no `state`. */
  const envelopeBytes = encodedBytes({
    runId,
    generation,
    seq: Number.MAX_SAFE_INTEGER,
    digest: '0'.repeat(64),
    ops: [],
  });
  /**
   * The envelope at the shortest `seq` the next request can have. A request's `seq` is only known
   * when it is sent, so splitting plans for the longest; refusing what can never fit uses the
   * shortest, and the request as sent is measured again before it goes.
   */
  const shortestEnvelopeBytes = () =>
    envelopeBytes - String(Number.MAX_SAFE_INTEGER).length + String(lastSeq + 1).length;
  /** Bytes of a request holding the buffer plus `extra` more ops' bytes over `more` ops, and a state. */
  const requestBytes = (extra: number, more: number, stateBytes?: number) => {
    const count = buffer.length + more;
    const commas = Math.max(count - 1, 0);
    // `,"state":` before the state's own JSON.
    const state = stateBytes === undefined ? 0 : 9 + stateBytes;
    return envelopeBytes + bufferBytes + extra + commas + state;
  };
  /**
   * Measures what the importer hands over and returns a copy decoded from that encoding, so a value
   * the importer changes after handing it over can't outgrow its measured size. Anything
   * unencodable or too big ends the run here.
   */
  const measure = <T>(value: T, alone: (bytes: number) => number): { bytes: number; copy: T } => {
    let json: string;
    let bytes: number;
    try {
      json = JSON.stringify(value);
      bytes = new TextEncoder().encode(json).byteLength;
    } catch (error) {
      flushFailure = { code: 'importer_error' };
      halt('flush');
      throw error;
    }
    if (alone(bytes) > maxFlushBytes) {
      flushFailure = { code: 'flush_too_large' };
      halt('flush');
      throw stop;
    }
    return { bytes, copy: JSON.parse(json) as T };
  };

  const push = async (handed: KnowledgeImporterOp) => {
    if (stop) throw stop;
    let op = handed;
    let sending: Promise<void> | undefined;
    if (maxFlushBytes !== Infinity) {
      const { bytes, copy } = measure(handed, opBytes => shortestEnvelopeBytes() + opBytes);
      op = copy;
      // Taken now, with the op added after, so ops pushed meanwhile keep their order.
      if (buffer.length > 0 && requestBytes(bytes, 1) > maxFlushBytes) sending = flush();
      bufferBytes += bytes;
    }
    buffer.push(op);
    // Armed before waiting on a split's flush, so the ops left in the buffer wait flushAfterMs from
    // now, not from that flush's ack. Queued behind any flush in flight, like every flush. A failure
    // halts the run, which the importer sees on its next call.
    if (!flushTimer && buffer.length < bufferSize) {
      flushTimer = setTimeout(() => flush().catch(() => {}), flushAfterMs);
      // A pending timed flush doesn't keep the process alive; the run's own awaits do.
      flushTimer.unref?.();
    }
    if (sending) await sending;
    if (buffer.length >= bufferSize) await flush();
  };

  const finish = async (request: Omit<KnowledgeImporterFinishRequest, 'runId' | 'generation' | 'lastSeq'>) => {
    const result = await finishRun(host, { runId, generation, ...request }, lastSeq, unsettledSeq, send =>
      withRetries(send, 'finish'),
    );
    return 'outcome' in result ? { ...result, refused } : result;
  };

  const binding = started.binding;
  const configured =
    binding &&
    options.importers.find(
      (entry): entry is KnowledgeImporterBase =>
        entry instanceof KnowledgeImporterBase &&
        entry.binding.id === binding.id &&
        entry.binding.importer === binding.importer,
    );
  const importerClass =
    binding &&
    (configured
      ? (configured.constructor as KnowledgeImporterClass)
      : options.importers.find(
          (entry): entry is KnowledgeImporterClass => typeof entry === 'function' && entry.id === binding.importer,
        ));
  if (!binding || !importerClass) {
    return finish({ outcome: 'failed', backlog: false, error: { code: 'importer_missing_from_deploy' } });
  }

  let importer: KnowledgeImporterBase;
  let settings: unknown;
  let credentials: Readonly<Record<string, string>>;
  try {
    importer = configured ?? new importerClass(binding as never);
    settings = await importerClass.definition.parseSettings(binding.settings ?? {});
    credentials = importerClass.definition.checkCredentials(binding.credentials ?? {});
  } catch (error) {
    if (error instanceof KnowledgeImporterSettingsError) {
      return finish({ outcome: 'failed', backlog: false, error: { code: 'settings_invalid' } });
    }
    if (error instanceof KnowledgeImporterCredentialsError) {
      return finish({ outcome: 'failed', backlog: false, error: { code: 'credential_missing' } });
    }
    // The run is started: end it, or the binding's next run is skipped until it is reclaimed. The
    // caller still gets the importer's own error, whatever the finish does.
    await finish({ outcome: 'failed', backlog: false, error: { code: 'importer_error' } }).catch(() => {});
    throw error;
  }

  let backlog = false;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const ctx: KnowledgeImporterContext<any, string> = {
    signal: controller.signal,
    binding: { id: binding.id, target: binding.target },
    settings,
    credentials,
    // A signal the importer passes joins the run's: the deadline and cancel still abort the fetch.
    fetch: (input, init) =>
      fetchImpl(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal,
      }),
    state: {
      get: async key => state[key],
      set: async (key, value) => {
        if (stop) throw stop;
        const staged = { [key]: value };
        if (maxFlushBytes !== Infinity) {
          // State values are strings, so the state needs no copy.
          const { bytes } = measure(staged, stateBytes => shortestEnvelopeBytes() + 9 + stateBytes);
          // The ops go first on their own; the state follows in the next flush, so it still lands
          // only once they have.
          if (requestBytes(0, 0, bytes) > maxFlushBytes) void flush().catch(() => {});
        }
        await flush(staged);
      },
    },
    items: {
      upsert: (item: KnowledgeImportItem) => push({ op: 'upsert', item }),
      declare: (item: KnowledgeImportDeclaration) => push({ op: 'declare', item }),
      remove: (sourceId: string) => push({ op: 'remove', sourceId }),
    },
    reportBacklog: () => {
      backlog = true;
    },
  };

  // One heartbeat at a time: the next is sent only once the previous call has settled, so a hung
  // host holds one call, not one per tick. Nothing awaits it; a host that stops answering stops
  // seeing heartbeats, and its liveness check reclaims the run.
  let beating = false;
  const heartbeat = setInterval(() => {
    if (beating) return;
    beating = true;
    host
      .heartbeat(runId, generation)
      .then(
        ({ cancel }) => cancel && halt('canceled'),
        () => {},
      )
      .finally(() => (beating = false));
  }, heartbeatMs);
  const hardStop = setTimeout(() => halt('stopped'), budgetMs + graceMs);

  let failure: KnowledgeImporterRunError | undefined;
  try {
    for (let pass = 0; pass < maxPasses; pass++) {
      backlog = false;
      try {
        // An import that ignores the signal is left behind when the run stops; its writes are refused.
        await Promise.race([importer.import(ctx), stopped]);
        if (!stop) await Promise.race([flush(), stopped]);
      } catch (error) {
        if (stop) break;
        if (error instanceof KnowledgeImporterSourceError) failure = sourceError(error);
        else if (error instanceof KnowledgeImporterHostError) failure = { code: 'importer_error', retryable: true };
        else failure = { code: 'importer_error' };
        break;
      }
      if (stop || !backlog || Date.now() - startedAt >= budgetMs) break;
    }
    // The importer is done; let the host finish moving and linking what arrived out of order, one
    // bounded slice per flush, while it says there is more and the budget allows (O3 §C′).
    while (!stop && !failure && pending !== false && Date.now() - startedAt < budgetMs) {
      try {
        await Promise.race([flush(undefined, true), stopped]);
      } catch {
        break;
      }
    }
  } finally {
    clearInterval(heartbeat);
    disarm();
  }
  // Wait for a flush in flight, but not past the hard deadline (which halts the run and so wakes
  // `stopped`): if it is still unanswered then, its seq stays unsettled and the finish names
  // whichever seq the host holds.
  if (!stop || stop.reason !== 'stopped') await Promise.race([flushing, deadlinePassed]);
  clearTimeout(hardStop);

  if (stop?.reason === 'canceled') return finish({ outcome: 'canceled', backlog: false });
  if (stop?.reason === 'stopped') return finish({ outcome: 'failed', backlog: false, error: { code: 'stopped' } });
  const error = stop?.reason === 'flush' ? flushFailure : failure;
  if (error) return finish({ outcome: 'failed', backlog: false, error });
  return finish({ outcome: 'succeeded', backlog });
}

/**
 * Records the end. A flush whose ack was lost may have committed, so the finish names the seq the
 * host says it holds: the known seq, or the unsettled one when the host refuses the known one. The
 * same request is resent after a lost ack; a host that stays unreachable leaves the run open for
 * its liveness check, and the runner returns `unfinished`.
 */
async function finishRun(
  host: KnowledgeImporterHost,
  request: Omit<KnowledgeImporterFinishRequest, 'lastSeq'>,
  lastSeq: number,
  unsettledSeq: number | undefined,
  withRetries: <T>(send: () => Promise<T>) => Promise<T>,
): Promise<RunKnowledgeImportResult> {
  const candidates = unsettledSeq === undefined ? [lastSeq] : [lastSeq, unsettledSeq];
  for (const seq of candidates) {
    try {
      return await withRetries(() => host.finishRun({ ...request, lastSeq: seq }));
    } catch (error) {
      if (error instanceof KnowledgeImporterHostConflictError && error.code === 'seq_mismatch') continue;
      if (isRetryable(error)) return { status: 'unfinished', runId: request.runId, lastSeq: seq };
      throw error;
    }
  }
  return { status: 'unfinished', runId: request.runId, lastSeq };
}

function encodedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
