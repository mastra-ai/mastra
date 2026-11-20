/**
 * A cold resume rebuilds a run's registry entry from its caller's request context before it can
 * tell whether that caller's resume is acceptable (#28229). Until it decides, other resumes of the
 * run in this process wait, so none adopts an entry built for a caller that is then rejected, and
 * a rejected attempt can remove what it registered without taking it from anyone else.
 */
const undecidedColdResumes = new Map<string, Promise<void>>();

/** Resolves once no cold resume of `runId` in this process is still deciding whether to accept. */
export async function waitForUndecidedColdResume(runId: string): Promise<void> {
  for (let pending = undecidedColdResumes.get(runId); pending; pending = undecidedColdResumes.get(runId)) {
    await pending;
  }
}

/** One resume() call's hold on a run it is rebuilding from storage. Every method is idempotent. */
export class ColdResumeAttempt {
  readonly #runId: string;
  #release: (() => void) | undefined;
  #rollback: (() => void) | undefined;

  constructor(runId: string) {
    this.#runId = runId;
  }

  /**
   * Holds the run until this attempt accepts or abandons. Call in the same tick as the registry
   * read that found no entry, so no other resume can start rebuilding the run in between.
   */
  begin(): void {
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

  /** Records how to remove what preparation registered for this attempt. */
  prepared(rollback: () => void): void {
    this.#rollback = rollback;
  }

  /** The run now belongs to an accepted resume (or another agent's): keep it and let others in. */
  accept(): void {
    this.#rollback = undefined;
    this.#release?.();
    this.#release = undefined;
  }

  /** The resume failed before accepting: remove what it registered, then let others in. */
  abandon(): void {
    const rollback = this.#rollback;
    this.#rollback = undefined;
    try {
      rollback?.();
    } finally {
      this.accept();
    }
  }
}
