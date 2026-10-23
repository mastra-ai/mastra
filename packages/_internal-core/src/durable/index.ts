export interface DurableStepFinishState {
  accumulatedSteps: unknown[];
  deferredStepFinishChunk?: unknown;
  lastStepResult?: {
    reason?: string;
  };
}

interface DurableToolResultRecord {
  toolCallId?: string;
  result?: unknown;
  error?: unknown;
}

// AI SDK's model output for a tool that returned `result` without error.
function toolModelOutput(result: unknown) {
  return typeof result === 'string' ? { type: 'text', value: result } : { type: 'json', value: result ?? null };
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Drops a tool-result part's `output` from step content when it can be rebuilt
 * from the step's `toolResults`. Step records are copied into every durable
 * snapshot, so storing each tool result twice per record multiplies snapshot
 * size (#20747). `expandDurableStepContent` restores the dropped outputs.
 */
export function compactDurableStepContent(content: unknown[], toolResults: DurableToolResultRecord[] = []): unknown[] {
  return content.map(part => {
    const p = part as { type?: string; toolCallId?: string; output?: unknown };
    if (p?.type !== 'tool-result') return part;
    const toolResult = toolResults.find(r => r.toolCallId === p.toolCallId);
    if (!toolResult || toolResult.error !== undefined) return part;
    if (!sameJson(p.output, toolModelOutput(toolResult.result))) return part;
    const { output: _output, ...rest } = p;
    return rest;
  });
}

/** Restores the tool-result outputs `compactDurableStepContent` dropped. */
export function expandDurableStepContent(content: unknown[], toolResults: DurableToolResultRecord[] = []): unknown[] {
  return content.map(part => {
    const p = part as { type?: string; toolCallId?: string; output?: unknown };
    if (p?.type !== 'tool-result' || 'output' in p) return part;
    const toolResult = toolResults.find(r => r.toolCallId === p.toolCallId);
    return toolResult ? { ...p, output: toolModelOutput(toolResult.result) } : part;
  });
}

/** Step records with their full content, for callers that hand them to user code. */
export function expandDurableSteps<T>(steps: T[]): T[] {
  return steps.map(step => {
    const s = step as { content?: unknown; toolResults?: DurableToolResultRecord[] };
    return Array.isArray(s?.content) ? { ...step, content: expandDurableStepContent(s.content, s.toolResults) } : step;
  });
}

export function buildDurableStepContent(state: DurableStepFinishState): unknown[] {
  const step = state.accumulatedSteps.at(-1) as any;
  if (!step) return [];
  // Steps recorded since content was added to the step record carry the same
  // content stopWhen sees; rebuild only for snapshots written before that.
  if (Array.isArray(step.content)) return expandDurableStepContent(step.content, step.toolResults);

  const content: unknown[] = [];
  if (step.text) {
    content.push({ type: 'text', text: step.text });
  }
  for (const toolCall of step.toolCalls ?? []) {
    content.push({
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: toolCall.args,
    });
  }
  for (const toolResult of step.toolResults ?? []) {
    const isDeniedApproval = toolResult.approval?.approved === false;
    const isPendingClientCall =
      toolResult.result === undefined &&
      !toolResult.error &&
      !toolResult.aborted &&
      !toolResult.resultBlocked &&
      !toolResult.providerExecuted &&
      !isDeniedApproval;
    if (isPendingClientCall) continue;

    content.push({
      type: 'tool-result',
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      result: toolResult.error ? toolResult.error.message : toolResult.result,
      ...(toolResult.error ? { isError: true } : {}),
    });
  }
  return content;
}

export function buildDeferredStepFinishChunk(state: DurableStepFinishState, isContinued: boolean): any | undefined {
  const deferredChunk = state.deferredStepFinishChunk as any;
  if (!deferredChunk) return undefined;

  return {
    ...deferredChunk,
    payload: {
      ...deferredChunk.payload,
      stepResult: {
        ...deferredChunk.payload?.stepResult,
        ...(state.lastStepResult?.reason ? { reason: state.lastStepResult.reason } : {}),
        isContinued,
      },
      _durableStepContent: buildDurableStepContent(state),
    },
  };
}
