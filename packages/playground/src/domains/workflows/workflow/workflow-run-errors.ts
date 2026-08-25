function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return undefined;

  if ('message' in error && typeof error.message === 'string') return error.message;
  // The `in` check is a shortcut: reading a missing `error` yields `undefined`,
  // which this function already reports as no message.
  // Stryker disable next-line ConditionalExpression
  if ('error' in error) return getErrorMessage(error.error);

  return undefined;
}

export function getWorkflowRunErrors(result: unknown, workflowError?: Error | null): string[] {
  const errors = workflowError ? [workflowError.message] : [];
  if (!result || typeof result !== 'object') return errors;

  // Same shortcut as above: a missing `error` reads as `undefined`, which
  // yields no message and so pushes nothing.
  // Stryker disable next-line ConditionalExpression
  if ('error' in result) {
    const message = getErrorMessage(result.error);
    if (message) errors.push(message);
  }

  // The `typeof` half is a shortcut: `Object.entries` over a non-object yields
  // entries whose values the loop body skips anyway.
  // Stryker disable next-line ConditionalExpression
  if ('steps' in result && result.steps && typeof result.steps === 'object') {
    for (const [stepId, step] of Object.entries(result.steps)) {
      if (!step || typeof step !== 'object' || !('error' in step)) continue;
      const message = getErrorMessage(step.error);
      if (message) errors.push(`${stepId}: ${message}`);
    }
  }

  return [...new Set(errors)];
}
