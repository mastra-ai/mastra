type CleanupTimer = ReturnType<typeof setTimeout>;

/**
 * Release of the state a durable run segment (stream, resume, recover,
 * generate, observe) holds, run at most once: either by the auto-cleanup timer
 * armed when the stream settles or by the caller's explicit cleanup().
 */
export interface RunCleanup {
  /** Whether the segment's state has been released. */
  readonly done: boolean;
  /** Cancel a pending timer and release now, unless already released. */
  run(): void;
  /** Arm the auto-cleanup timer, unless one is armed or already released. */
  schedule(): void;
}

export interface CreateRunCleanupOptions {
  /** Arms the timer, e.g. the stream bus's cleanup timeout. `undefined` disables it. */
  scheduleTimer: (cleanup: () => void) => CleanupTimer | undefined;
  /** Releases the segment's state. Marked released only once it returns. */
  release: () => void;
  /** What the timer releases when it differs from {@link release}. */
  releaseOnTimer?: () => void;
}

export function createRunCleanup({ scheduleTimer, release, releaseOnTimer }: CreateRunCleanupOptions): RunCleanup {
  let done = false;
  let timer: CleanupTimer | null = null;

  const run = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (done) return;
    release();
    done = true;
  };

  const onTimer = releaseOnTimer
    ? () => {
        if (done) return;
        releaseOnTimer();
        done = true;
      }
    : run;

  return {
    get done() {
      return done;
    },
    run,
    schedule() {
      if (timer || done) return;
      timer = scheduleTimer(onTimer) ?? null;
    },
  };
}
