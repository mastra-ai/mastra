export interface ThreadStreamRegistration {
  readonly streamId: string;
  readonly resumedToolCallId?: string;
  readonly previousStream?: ThreadStreamRegistration;
}

export function hasLaterToolCallResume(
  latestStream: ThreadStreamRegistration | null | undefined,
  streamId: string,
  toolCallId: string | undefined,
): boolean {
  for (let stream = latestStream; stream && stream.streamId !== streamId; stream = stream.previousStream) {
    if (!stream.resumedToolCallId || stream.resumedToolCallId === toolCallId) return true;
  }
  return false;
}

interface RegisteredThreadRun {
  latestStream: ThreadStreamRegistration | null;
  registeredStreamIds: Set<string>;
}

export class ThreadStreamToolGates {
  readonly #runs = new Map<string, RegisteredThreadRun>();

  registerStream(runId: string, streamId: string, resumedToolCallId?: string): void {
    const run = this.#runs.get(runId);
    if (run?.registeredStreamIds.has(streamId)) return;
    const registration: ThreadStreamRegistration = {
      streamId,
      resumedToolCallId,
      previousStream: run?.latestStream ?? undefined,
    };
    if (run) {
      run.registeredStreamIds.add(streamId);
      run.latestStream = registration;
    } else {
      this.#runs.set(runId, {
        latestStream: registration,
        registeredStreamIds: new Set([streamId]),
      });
    }
  }

  finishRun(runId: string, streamId?: string): void {
    const run = this.#runs.get(runId);
    if (!run) {
      this.#runs.set(runId, {
        latestStream: null,
        registeredStreamIds: new Set(streamId ? [streamId] : []),
      });
      return;
    }
    if (streamId) run.registeredStreamIds.add(streamId);
    if (streamId && run.latestStream?.streamId !== streamId) return;
    run.latestStream = null;
  }

  hasStream(runId: string, streamId: string): boolean {
    return this.#runs.get(runId)?.registeredStreamIds.has(streamId) ?? false;
  }

  isToolCallUnanswered(runId: string, streamId: string, toolCallId: string): boolean {
    const run = this.#runs.get(runId);
    if (run?.latestStream === null) return false;
    if (!run?.registeredStreamIds.has(streamId)) return true;
    return !hasLaterToolCallResume(run.latestStream, streamId, toolCallId);
  }
}
