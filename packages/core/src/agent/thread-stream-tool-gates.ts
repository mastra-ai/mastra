function toolGateCallId(part: unknown): string | undefined {
  if (!part || typeof part !== 'object' || !('type' in part)) return;
  if (part.type !== 'tool-call-approval' && part.type !== 'tool-call-suspended') return;
  if (!('payload' in part)) return;
  const payload = part.payload;
  if (!payload || typeof payload !== 'object' || !('toolCallId' in payload)) return;
  return typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;
}

export class ThreadStreamToolGates {
  readonly #latestStreamByRun = new Map<string, string>();
  readonly #pendingByRun = new Map<string, Map<string, string>>();

  registerStream(runId: string, streamId: string, resumedToolCallId?: string): void {
    if (this.#latestStreamByRun.get(runId) === streamId) return;
    this.#latestStreamByRun.set(runId, streamId);
    const pending = this.#pendingByRun.get(runId);
    if (!pending) return;
    for (const [toolCallId, gateStreamId] of pending) {
      const wasAnswered = !resumedToolCallId || toolCallId === resumedToolCallId;
      if (gateStreamId !== streamId && wasAnswered) pending.delete(toolCallId);
    }
  }

  registerGate(runId: string, streamId: string, part: unknown): void {
    const toolCallId = toolGateCallId(part);
    if (!toolCallId) return;
    const pending = this.#pendingByRun.get(runId) ?? new Map<string, string>();
    pending.set(toolCallId, streamId);
    this.#pendingByRun.set(runId, pending);
  }

  finishRun(runId: string, streamId?: string): void {
    const latestStreamId = this.#latestStreamByRun.get(runId);
    if (streamId && latestStreamId && streamId !== latestStreamId) return;
    this.#pendingByRun.delete(runId);
    this.#latestStreamByRun.delete(runId);
  }

  hasPendingGate(runId: string, streamId: string, toolCallId: string): boolean {
    return this.#pendingByRun.get(runId)?.get(toolCallId) === streamId;
  }
}
