import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { fastembed } from '@mastra/fastembed';

type FastembedModel = typeof fastembed.small;
type DoEmbedOptions = Parameters<FastembedModel['doEmbed']>[0];
type DoEmbedResult = Awaited<ReturnType<FastembedModel['doEmbed']>>;
type WorkerReply = { id: number; embeddings?: number[][]; warnings?: DoEmbedResult['warnings']; error?: string };

type Job = {
  id: number;
  options: DoEmbedOptions;
  resolve: (result: DoEmbedResult) => void;
  reject: (reason: unknown) => void;
  onAbort?: () => void;
};

/** How long a worker with no active or queued work keeps the model loaded before it exits. */
export const WORKER_IDLE_TIMEOUT_MS = 5 * 60_000;

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
  try {
    if (!model) {
      const mod = await import(entry);
      model = (mod.fastembed ?? mod.default.fastembed).small;
    }
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
    const child = this.#child ?? this.#spawn();
    // Work in flight keeps the agent alive until the reply arrives.
    child.ref();
    child.channel?.ref();
    child.send({ id: job.id, entry: this.#entry, values: job.options.values }, error => {
      if (error) this.#onChildGone(child, error);
    });
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
    child.channel?.unref();
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

/** Embeds with `fastembed.small` in the shared worker process (see `FastembedWorker`). */
export function embedInSubprocess(options: DoEmbedOptions): Promise<DoEmbedResult> {
  defaultWorker ??= new FastembedWorker(import.meta.resolve('@mastra/fastembed'));
  return defaultWorker.embed(options);
}
