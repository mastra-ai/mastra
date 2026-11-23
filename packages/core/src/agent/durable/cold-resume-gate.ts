/**
 * A cold resume rebuilds a run's registry entry from its caller's request context before it can
 * tell whether that caller's resume is acceptable (#28229). Until it decides, other resumes of the
 * run in this process wait, so none adopts an entry built for a caller that is then rejected, and
 * a rejected attempt can remove what it registered without taking it from anyone else.
 */
const undecidedColdResumes = new Map<string, Promise<void>>();

/**
 * The decision a cold resume of `runId` in this process is still making, if any. Callers loop on
 * this in their own async function and claim the run in the same tick the loop ends: awaiting a
 * helper that waits for them would let another resume claim the run in between.
 */
export function undecidedColdResume(runId: string): Promise<void> | undefined {
  return undecidedColdResumes.get(runId);
}

/**
 * Settles with `pending`, or rejects with the abort reason once `signal` aborts first. A resume
 * waiting for another one to decide stops waiting when its own caller gives up.
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
  readonly #runId: string;
  #state: AttemptState = 'idle';
  #release: (() => void) | undefined;
  #rollback: (() => void) | undefined;
  #share: (() => void) | undefined;

  constructor(runId: string) {
    this.#runId = runId;
  }

  /**
   * Holds the run until this attempt accepts or abandons. Call in the same tick as the registry
   * read that found no entry, so no other resume can start rebuilding the run in between.
   */
  begin(): void {
    if (this.#state !== 'idle') return;
    this.#state = 'deciding';
    let resolve!: () => void;
    const pending = new Promise<void>(r => {
      resolve = r;
    });
    undecidedColdResumes.set(this.#runId, pending);
    this.#release = () => {
      if (undecidedColdResumes.get(this.#runId) === pending) undecidedColdResumes.delete(this.#runId);
      resolve();
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
