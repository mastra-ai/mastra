/**
 * A cold resume rebuilds a run's registry entry from its caller's request context before it can
 * tell whether that caller's resume is acceptable (#28229). Until it decides, other resumes of the
 * run on the same runtime wait, so none adopts an entry built for a caller that is then rejected,
 * and a rejected attempt can remove what it registered without taking it from anyone else.
 *
 * Gates are keyed by runtime and run ID. The runtime is the Mastra instance that owns the run's
 * shared registry slot: agent wrappers and pinned-version forks of one host share it, so they
 * still wait on each other. Separate hosts in one process (each with its own storage) can reuse a
 * caller-supplied run ID, and their registry slots are already kept apart, so their gates are too.
 */
const undecidedColdResumes = new WeakMap<object, Map<string, ColdResumeGate>>();

/** The runtime of agents that have no Mastra instance. They share one namespace. */
const DETACHED_RUNTIME: object = Object.freeze({});

/** The key a runtime's gates are stored under: its Mastra instance, or the detached namespace. */
export type ColdResumeRuntime = object | undefined;

function gatesFor(runtime: ColdResumeRuntime): Map<string, ColdResumeGate> {
  const key = runtime ?? DETACHED_RUNTIME;
  let gates = undecidedColdResumes.get(key);
  if (!gates) undecidedColdResumes.set(key, (gates = new Map()));
  return gates;
}

/**
 * The decision one cold resume is making. Waiters subscribe and unsubscribe individually, so a
 * caller that gives up (abort or deadline) leaves nothing attached to a gate that stays held.
 */
export class ColdResumeGate {
  readonly #waiters = new Set<() => void>();
  #open = false;

  /**
   * Settles once the attempt holding this gate accepts or abandons, or rejects with the abort reason
   * once `signal` aborts first. An aborted waiter is removed from the gate at once.
   */
  wait(signal: AbortSignal | undefined): Promise<void> {
    if (this.#open) return Promise.resolve();
    if (!signal) return new Promise<void>(resolve => this.#waiters.add(() => resolve()));
    if (signal.aborted) return Promise.reject(signal.reason);
    const abortSignal = signal;
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        this.#waiters.delete(waiter);
        reject(abortSignal.reason);
      };
      const waiter = () => {
        abortSignal.removeEventListener('abort', onAbort);
        resolve();
      };
      this.#waiters.add(waiter);
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** How many resumes are waiting on this gate. */
  get waiting(): number {
    return this.#waiters.size;
  }

  /** Lets every remaining waiter in. Idempotent. */
  open(): void {
    if (this.#open) return;
    this.#open = true;
    const waiters = [...this.#waiters];
    this.#waiters.clear();
    for (const waiter of waiters) waiter();
  }
}

/**
 * The decision a cold resume of `runId` on `runtime` is still making, if any. Callers loop on
 * this in their own async function and claim the run in the same tick the loop ends: awaiting a
 * helper that waits for them would let another resume claim the run in between.
 */
export function undecidedColdResume(runtime: ColdResumeRuntime, runId: string): ColdResumeGate | undefined {
  return gatesFor(runtime).get(runId);
}

/**
 * Settles with `pending`, or rejects with the abort reason once `signal` aborts first. A resume
 * waiting on its own work (preparation, authorization, the prior segment) stops waiting when its
 * caller gives up. Waits on another resume's decision use {@link ColdResumeGate.wait} instead.
 */
export function waitUnlessAborted<T>(pending: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

type AttemptState = 'idle' | 'deciding' | 'accepted' | 'abandoned';

/**
 * Thrown into a preparation that finishes after its resume was abandoned. Nobody awaits that
 * preparation any more; the error only stops it from registering the run.
 */
export class AbandonedColdResumeError extends Error {
  constructor(runId: string) {
    super(`The cold resume of run ${runId} was abandoned before its preparation finished.`);
    this.name = 'AbandonedColdResumeError';
  }
}

/** One resume() call's hold on a run it is rebuilding from storage. Every method is idempotent. */
export class ColdResumeAttempt {
  readonly #runtime: ColdResumeRuntime;
  readonly #runId: string;
  #state: AttemptState = 'idle';
  #release: (() => void) | undefined;
  #rollback: (() => void) | undefined;
  #share: (() => void) | undefined;

  constructor({ runtime, runId }: { runtime: ColdResumeRuntime; runId: string }) {
    this.#runtime = runtime;
    this.#runId = runId;
  }

  /**
   * Holds the run until this attempt accepts or abandons. Call in the same tick as the registry
   * read that found no entry, so no other resume can start rebuilding the run in between.
   */
  begin(): void {
    if (this.#state !== 'idle') return;
    this.#state = 'deciding';
    const gates = gatesFor(this.#runtime);
    const gate = new ColdResumeGate();
    gates.set(this.#runId, gate);
    this.#release = () => {
      if (gates.get(this.#runId) === gate) gates.delete(this.#runId);
      gate.open();
    };
  }

  /**
   * Called by preparation right before it registers the run. A preparation that outlived its
   * resume (the caller gave up while a tool resolver stalled) must not register anything: later
   * resumes may already have rebuilt the run.
   */
  throwIfAbandoned(): void {
    if (this.#state === 'abandoned') throw new AbandonedColdResumeError(this.#runId);
  }

  /** Records how to remove what preparation registered; runs it at once if already abandoned. */
  prepared(rollback: () => void): void {
    if (this.#state === 'abandoned') {
      rollback();
      return;
    }
    this.#rollback = rollback;
  }

  /**
   * Holds preparation's write to the shared registry slot until this attempt accepts. Another
   * agent instance in this process may be running the run from that slot, and must not see an
   * entry built for a caller that could still be rejected.
   */
  shareOnAccept(register: () => void): void {
    if (this.#state === 'abandoned') return;
    if (this.#state === 'accepted') {
      register();
      return;
    }
    this.#share = register;
  }

  /** The run now belongs to an accepted resume (or another agent's): keep it and let others in. */
  accept(): void {
    if (this.#state === 'deciding') {
      this.#state = 'accepted';
      const share = this.#share;
      this.#share = undefined;
      this.#rollback = undefined;
      try {
        share?.();
      } finally {
        this.#releaseGate();
      }
      return;
    }
    if (this.#state === 'idle') this.#state = 'accepted';
  }

  /** The resume failed before accepting: remove what it registered, then let others in. */
  abandon(): void {
    if (this.#state === 'accepted' || this.#state === 'abandoned') return;
    this.#state = 'abandoned';
    const rollback = this.#rollback;
    this.#rollback = undefined;
    this.#share = undefined;
    try {
      rollback?.();
    } finally {
      this.#releaseGate();
    }
  }

  #releaseGate(): void {
    this.#release?.();
    this.#release = undefined;
  }
}
