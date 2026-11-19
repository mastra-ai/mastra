import {
  KnowledgeImporterCredentialsError,
  KnowledgeImporterHostError,
  KnowledgeImporterSettingsError,
  KnowledgeImporterSourceError,
} from './define';
import type { KnowledgeImporterContext, KnowledgeImporterDefinition } from './define';
import { KnowledgeImporterHostConflictError, knowledgeImporterFlushDigest } from './host';
import type { KnowledgeImporterHost, KnowledgeImporterStartRunOptions } from './host';
import type {
  KnowledgeImportDeclaration,
  KnowledgeImportItem,
  KnowledgeImporterFinishRequest,
  KnowledgeImporterOp,
  KnowledgeImporterRunError,
  KnowledgeImporterRunReceipt,
  KnowledgeImporterState,
} from './types';

/** @experimental */
export interface RunKnowledgeImportOptions {
  /** The app's importers; the run's binding picks one by id. */
  definitions: readonly KnowledgeImporterDefinition<any, any>[];
  host: KnowledgeImporterHost;
  bindingId: string;
  start?: KnowledgeImporterStartRunOptions;
  /** No new pass starts after this. Default 25 minutes. */
  budgetMs?: number;
  /** After the budget, how long a running pass may take before the run is stopped. Default 3 minutes. */
  graceMs?: number;
  /** Most `sync` passes in one run. Default 200. */
  maxPasses?: number;
  /** Ops per flush. Default 200. */
  bufferSize?: number;
  /** Default 30 seconds. */
  heartbeatMs?: number;
  /** Resends of one flush or finish after a 5xx or network error. Default 8. */
  maxRetries?: number;
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

const isRetryable = (error: unknown) =>
  error instanceof KnowledgeImporterHostError && (error.status === undefined || error.status >= 500);

/** The run ended for a reason that decides its outcome; buffered ops after it are dropped. */
class RunStop extends Error {
  constructor(readonly reason: 'canceled' | 'stopped' | 'host') {
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
 * Runs one import: starts a run on the host, calls the importer's `sync` in passes, sends its items
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
    heartbeatMs = 30_000,
    maxRetries = 8,
    retryDelayMs = (attempt: number) => Math.min(250 * 2 ** attempt, 10_000),
  } = options;

  const started = await host.startRun(options.bindingId, options.start);
  if (started.status === 'skipped') return started;
  const { runId, generation } = started;
  const startedAt = Date.now();

  let lastSeq = started.lastSeq;
  /** A flush sent but never acknowledged: it may have committed. */
  let unsettledSeq: number | undefined;
  let state: KnowledgeImporterState = { ...started.state };
  let buffer: KnowledgeImporterOp[] = [];
  let stop: RunStop | undefined;
  let hostFailure: KnowledgeImporterRunError | undefined;
  const controller = new AbortController();
  const halt = (reason: RunStop['reason']) => {
    stop ??= new RunStop(reason);
    controller.abort(stop);
  };

  async function withRetries<T>(send: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await send();
      } catch (error) {
        if (!isRetryable(error) || attempt >= maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs(attempt)));
      }
    }
  }

  let flushing: Promise<void> = Promise.resolve();
  function flush(staged?: KnowledgeImporterState): Promise<void> {
    const ops = buffer;
    buffer = [];
    const next = flushing.then(async () => {
      if (stop) throw stop;
      if (ops.length === 0 && !staged) return;
      const body = { ops, ...(staged ? { state: staged } : {}) };
      const seq = lastSeq + 1;
      const request = { runId, generation, seq, digest: await knowledgeImporterFlushDigest(body), ...body };
      unsettledSeq = seq;
      try {
        await withRetries(() => host.flush(request));
      } catch (error) {
        // A refusal (409) or a 4xx means nothing was applied; a retryable failure may have committed.
        if (!isRetryable(error)) unsettledSeq = undefined;
        hostFailure = { code: 'importer_error', retryable: isRetryable(error) };
        halt('host');
        throw stop;
      }
      unsettledSeq = undefined;
      lastSeq = seq;
      if (staged) state = { ...state, ...staged };
    });
    flushing = next.catch(() => {});
    return next;
  }

  const push = async (op: KnowledgeImporterOp) => {
    if (stop) throw stop;
    buffer.push(op);
    if (buffer.length >= bufferSize) await flush();
  };

  const finish = (request: Omit<KnowledgeImporterFinishRequest, 'runId' | 'generation' | 'lastSeq'>) =>
    finishRun(host, { runId, generation, ...request }, lastSeq, unsettledSeq, withRetries);

  const importer = started.binding && options.definitions.find(d => d.id === started.binding!.importer);
  if (!importer) return finish({ outcome: 'failed', backlog: false, error: { code: 'importer_missing_from_deploy' } });

  let settings: unknown;
  let credentials: Readonly<Record<string, string>>;
  try {
    settings = await importer.parseSettings(started.binding?.settings ?? {});
    credentials = importer.checkCredentials(started.binding?.credentials ?? {});
  } catch (error) {
    if (error instanceof KnowledgeImporterSettingsError) {
      return finish({ outcome: 'failed', backlog: false, error: { code: 'settings_invalid' } });
    }
    if (error instanceof KnowledgeImporterCredentialsError) {
      return finish({ outcome: 'failed', backlog: false, error: { code: 'credential_missing' } });
    }
    throw error;
  }

  let backlog = false;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const ctx: KnowledgeImporterContext<any, string> = {
    signal: controller.signal,
    binding: { id: options.bindingId, target: started.binding?.target ?? '' },
    settings,
    credentials,
    fetch: (input, init) => fetchImpl(input, { ...init, signal: init?.signal ?? controller.signal }),
    state: {
      get: async key => state[key],
      set: async (key, value) => {
        if (stop) throw stop;
        await flush({ [key]: value });
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

  const heartbeat = setInterval(() => {
    host.heartbeat(runId, generation).then(
      ({ cancel }) => cancel && halt('canceled'),
      () => {},
    );
  }, heartbeatMs);
  let deadlineReached!: () => void;
  const deadline = new Promise<void>(resolve => (deadlineReached = resolve));
  const hardStop = setTimeout(() => {
    halt('stopped');
    deadlineReached();
  }, budgetMs + graceMs);

  let failure: KnowledgeImporterRunError | undefined;
  try {
    for (let pass = 0; pass < maxPasses; pass++) {
      backlog = false;
      try {
        // A sync that ignores the signal is left behind at the hard deadline; its writes are refused.
        await Promise.race([importer.sync(ctx), deadline]);
        if (!stop) await flush();
      } catch (error) {
        if (stop) break;
        if (error instanceof KnowledgeImporterSourceError) failure = sourceError(error);
        else if (error instanceof KnowledgeImporterHostError) failure = { code: 'importer_error', retryable: true };
        else failure = { code: 'importer_error' };
        break;
      }
      if (stop || !backlog || Date.now() - startedAt >= budgetMs) break;
    }
  } finally {
    clearInterval(heartbeat);
    clearTimeout(hardStop);
  }
  await flushing;

  if (stop?.reason === 'canceled') return finish({ outcome: 'canceled', backlog: false });
  if (stop?.reason === 'stopped') return finish({ outcome: 'failed', backlog: false, error: { code: 'stopped' } });
  const error = stop?.reason === 'host' ? hostFailure : failure;
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
