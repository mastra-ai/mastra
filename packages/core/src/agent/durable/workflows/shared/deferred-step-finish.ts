import type { BaseIterationState } from './schemas';

export function buildDurableStepContent(state: BaseIterationState): unknown[] {
  const step = state.accumulatedSteps.at(-1) as any;
  if (!step) return [];

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

export function buildDeferredStepFinishChunk(state: BaseIterationState, isContinued: boolean): any | undefined {
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
