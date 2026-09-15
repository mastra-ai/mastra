/**
 * Shared `defaultOptions.stopWhen` predicate for both compliance-sensitive agents (Meridian's
 * `callCenterAgent` and Northwind's `superRegulatedAgent`): stop the loop the moment the last step
 * called `toolName`, so the model structurally cannot speak past it. See the callers for why this
 * matters on a live call.
 */
export function stopOnToolCall(toolName: string) {
  return ({ steps }: { steps: Array<{ toolCalls?: Array<{ toolName: string }> }> }) =>
    (steps.at(-1)?.toolCalls ?? []).some(call => call.toolName === toolName);
}
