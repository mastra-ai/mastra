import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { fastembed } from '@mastra/fastembed';

type FastembedModel = typeof fastembed.small;
type DoEmbedOptions = Parameters<FastembedModel['doEmbed']>[0];
type DoEmbedResult = Awaited<ReturnType<FastembedModel['doEmbed']>>;
type WorkerReply = {
  id: number;
  embeddings?: number[][];
  warnings?: DoEmbedResult['warnings'];
  error?: string;
  /** Set when importing `@mastra/fastembed` failed, before any embedding ran. */
  loadError?: { code?: string; message: string };
};

type Job = {
  id: number;
  options: DoEmbedOptions;
  resolve: (result: DoEmbedResult) => void;
  reject: (reason: unknown) => void;
  onAbort?: () => void;
};

/** How long a worker with no active or queued work keeps the model loaded before it exits. */
export const WORKER_IDLE_TIMEOUT_MS = 5 * 60_000;

/** `code` of {@link EmbedderPackageMissingError}. */
export const EMBEDDER_PACKAGE_MISSING = 'MASTRACODE_EMBEDDER_PACKAGE_MISSING';

/**
 * The default recall embedder can't run because `@mastra/fastembed`, or a package it imports, could not be
 * loaded. Other embedder failures (model download, worker crash) are plain errors. Detect it with
 * {@link isEmbedderPackageMissingError}, which also matches errors from another copy of this module.
 */
export class EmbedderPackageMissingError extends Error {
  readonly code = EMBEDDER_PACKAGE_MISSING;
  readonly packageName = '@mastra/fastembed';

  constructor(cause: unknown) {
    const reason = (cause instanceof Error ? cause.message : String(cause)).split('\n')[0];
    super(
      `Memory recall is off: the local embedder package @mastra/fastembed could not be loaded (${reason}). ` +
        'New observations are not indexed for search, and recall search fails until it is fixed. ' +
        'Reinstall Mastra Code to restore it (for example `npm install -g mastracode`).',
      { cause },
    );
    this.name = 'EmbedderPackageMissingError';
  }
}

export function isEmbedderPackageMissingError(error: unknown): error is EmbedderPackageMissingError {
  return error instanceof Error && (error as { code?: unknown }).code === EMBEDDER_PACKAGE_MISSING;
}

/**
 * Run with `node -e`. Loads `@mastra/fastembed` on the first request, keeps the model for later ones, and
 * replies to each over IPC. It exits when the parent disconnects, so it never outlives the agent. It raises
 * its own OOM score first: if a small sandbox runs out of memory, the kernel kills this worker, not the agent.
 */
const WORKER_SOURCE = `
try { require('node:fs').writeFileSync('/proc/self/oom_score_adj', '500'); } catch {}
let model;
process.on('disconnect', () => process.exit(0));
process.on('message', async ({ id, entry, values }) => {
  if (!model) {
    try {
      const mod = await import(entry);
      model = (mod.fastembed ?? mod.default.fastembed).small;
    } catch (error) {
      const loadError = { code: error && error.code, message: String((error && error.message) || error) };
      process.send({ id, error: String((error && error.stack) || error), loadError });
      return;
    }
  }
  try {
    const { embeddings, warnings } = await model.doEmbed({ values });
    process.send({ id, embeddings, warnings });
  } catch (error) {
    process.send({ id, error: String((error && error.stack) || error) });
  }
});
`;

const liveChildren = new Set<ChildProcess>();
let exitHookInstalled = false;

/** Kills workers when the agent exits normally. A killed agent closes the IPC channel, which ends them too. */
function trackChild(child: ChildProcess): void {
  liveChildren.add(child);
  child.once('exit', () => liveChildren.delete(child));
  if (!exitHookInstalled) {
    exitHookInstalled = true;
    process.on('exit', () => {
      for (const c of liveChildren) c.kill('SIGKILL');
    });
  }
}

/**
 * Runs `fastembed.small` in one reusable child process, one request at a time.
 *
 * In-process, the bge-small session costs ~230 MB of RSS that stays for the rest of the run (plus ~33 MB
 * of arena per extra text in a batch, also kept). In a 4 GB sandbox that makes the agent the largest
 * process, which is the one the kernel OOM killer picks. The worker starts on the first request and keeps
 * the model loaded while requests keep coming. Once nothing is active or queued for
 * `WORKER_IDLE_TIMEOUT_MS`, it exits; the next request starts a new one.
 *
 * Neither an idle worker nor its timer keeps the event loop alive, so a finished CLI still exits.
 */
export class FastembedWorker {
  readonly #entry: string;
  #child: ChildProcess | undefined;
  #active: Job | undefined;
  #queue: Job[] = [];
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #nextId = 0;

  /** @param entry URL of the `@mastra/fastembed` module the worker imports. */
  constructor(entry: string) {
    this.#entry = entry;
  }

  /** The running worker's pid, or `undefined` when no worker is running. */
  get pid(): number | undefined {
    return this.#child?.pid;
  }

  embed(options: DoEmbedOptions): Promise<DoEmbedResult> {
    const { abortSignal } = options;
    if (abortSignal?.aborted) return Promise.reject(abortSignal.reason);
    return new Promise((resolve, reject) => {
      const job: Job = { id: this.#nextId++, options, resolve, reject };
      if (abortSignal) {
        job.onAbort = () => this.#abort(job);
        abortSignal.addEventListener('abort', job.onAbort, { once: true });
      }
      this.#queue.push(job);
      this.#clearIdleTimer();
      this.#pump();
    });
  }

  /** Stops the worker now and rejects any active or queued request. */
  close(): void {
    this.#clearIdleTimer();
    const error = new Error('fastembed worker closed');
    const jobs = this.#active ? [this.#active, ...this.#queue] : [...this.#queue];
    this.#active = undefined;
    this.#queue = [];
    this.#stopChild();
    for (const job of jobs) this.#settle(job, () => job.reject(error));
  }

  #pump(): void {
    if (this.#active) return;
    const job = this.#queue.shift();
    if (!job) {
      this.#goIdle();
      return;
    }
    this.#active = job;
    try {
      const child = this.#child ?? this.#spawn();
      // Work in flight keeps the agent alive until the reply arrives.
      child.ref();
      child.channel?.ref?.();
      child.send({ id: job.id, entry: this.#entry, values: job.options.values }, error => {
        if (error) this.#onChildGone(child, error);
      });
    } catch (error) {
      // A Bun channel without `ref()`/`unref()`, or a refused `send()`, throws here. Drop the failed
      // worker (so its late events miss the `#onChildGone` identity check), fail this job with the
      // thrown value, and carry on with the queue instead of stranding it behind a stale active job.
      this.#stopChild();
      this.#active = undefined;
      this.#settle(job, () => job.reject(error));
      this.#pump();
    }
  }

  #spawn(): ChildProcess {
    const child = spawn(process.execPath, ['-e', WORKER_SOURCE], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      env: process.env,
    });
    this.#child = child;
    trackChild(child);
    child.on('message', (reply: WorkerReply) => this.#onReply(reply));
    child.on('error', error => this.#onChildGone(child, error));
    child.once('exit', (code, signal) =>
      this.#onChildGone(child, new Error(`fastembed worker exited without a result (code ${code}, signal ${signal})`)),
    );
    return child;
  }

  #onReply(reply: WorkerReply): void {
    const job = this.#active;
    if (!job || reply.id !== job.id) return;
    this.#active = undefined;
    if (reply.embeddings) {
      const result = { embeddings: reply.embeddings, warnings: reply.warnings ?? [] };
      this.#settle(job, () => job.resolve(result));
    } else if (reply.loadError?.code === 'ERR_MODULE_NOT_FOUND' || reply.loadError?.code === 'MODULE_NOT_FOUND') {
      // `@mastra/fastembed` resolved but a package it imports (ESM) or requires (CommonJS) did not.
      const error = new EmbedderPackageMissingError(new Error(reply.loadError.message));
      this.#settle(job, () => job.reject(error));
    } else {
      this.#settle(job, () => job.reject(new Error(reply.error ?? 'fastembed worker returned no embeddings')));
    }
    this.#pump();
  }

  /** The worker crashed, was killed or failed to start: fail the active request and carry on with the queue. */
  #onChildGone(child: ChildProcess, error: Error): void {
    if (this.#child !== child) return;
    this.#child = undefined;
    this.#clearIdleTimer();
    const job = this.#active;
    if (job) {
      this.#active = undefined;
      this.#settle(job, () => job.reject(error));
    }
    this.#pump();
  }

  #abort(job: Job): void {
    if (this.#active === job) {
      // The model can't be interrupted mid-run, so the worker goes with the request.
      this.#active = undefined;
      this.#stopChild();
    } else {
      const index = this.#queue.indexOf(job);
      if (index === -1) return;
      this.#queue.splice(index, 1);
    }
    this.#settle(job, () => job.reject(job.options.abortSignal?.reason));
    this.#pump();
  }

  #settle(job: Job, settle: () => void): void {
    if (job.onAbort) job.options.abortSignal?.removeEventListener('abort', job.onAbort);
    settle();
  }

  #goIdle(): void {
    const child = this.#child;
    if (!child) return;
    // An idle worker must not keep a finished CLI running.
    child.unref();
    child.channel?.unref?.();
    this.#clearIdleTimer();
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = undefined;
      if (!this.#active && this.#queue.length === 0) this.#stopChild();
    }, WORKER_IDLE_TIMEOUT_MS);
    this.#idleTimer.unref();
  }

  #clearIdleTimer(): void {
    if (this.#idleTimer) clearTimeout(this.#idleTimer);
    this.#idleTimer = undefined;
  }

  #stopChild(): void {
    const child = this.#child;
    this.#child = undefined;
    child?.kill('SIGKILL');
  }
}

let defaultWorker: FastembedWorker | undefined;

type EmbedderPackageMissingListener = (error: EmbedderPackageMissingError) => void;
/** Each listener hears about the missing package at most once, however many embeds fail. */
const packageMissingListeners = new Map<EmbedderPackageMissingListener, { heard: boolean }>();
let unheardPackageMissing: EmbedderPackageMissingError | undefined;
let warnedWithoutListener = false;

/**
 * Called once, on the first embed that fails with {@link EmbedderPackageMissingError} after subscribing.
 * Memory catches that failure (indexing is best-effort and Mastra Code silences `console.warn`), so this is
 * how a UI learns about it. With no listener the error goes to `console.warn` and is handed to the first
 * listener that subscribes later.
 */
export function onEmbedderPackageMissing(listener: EmbedderPackageMissingListener): () => void {
  const state = { heard: false };
  packageMissingListeners.set(listener, state);
  const unheard = unheardPackageMissing;
  unheardPackageMissing = undefined;
  if (unheard) {
    state.heard = true;
    notify(listener, unheard);
  }
  return () => packageMissingListeners.delete(listener);
}

function reportPackageMissing(error: EmbedderPackageMissingError): void {
  if (packageMissingListeners.size === 0) {
    if (!warnedWithoutListener) console.warn(error.message);
    warnedWithoutListener = true;
    unheardPackageMissing ??= error;
    return;
  }
  for (const [listener, state] of packageMissingListeners) {
    if (state.heard) continue;
    state.heard = true;
    notify(listener, error);
  }
}

/** A listener that throws must not replace the embed error or break subscribing. */
function notify(listener: EmbedderPackageMissingListener, error: EmbedderPackageMissingError): void {
  try {
    listener(error);
  } catch (listenerError) {
    console.warn(`Embedder notice listener failed: ${String(listenerError)}`);
  }
}

/** Embeds with `fastembed.small` in the shared worker process (see `FastembedWorker`). */
export async function embedInSubprocess(options: DoEmbedOptions): Promise<DoEmbedResult> {
  try {
    defaultWorker ??= new FastembedWorker(resolveFastembedEntry());
    return await defaultWorker.embed(options);
  } catch (error) {
    if (isEmbedderPackageMissingError(error)) reportPackageMissing(error);
    throw error;
  }
}

function resolveFastembedEntry(): string {
  try {
    return import.meta.resolve('@mastra/fastembed');
  } catch (error) {
    throw new EmbedderPackageMissingError(error);
  }
}
