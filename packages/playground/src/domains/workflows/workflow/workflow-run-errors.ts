function getErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return undefined;

  if ('message' in error && typeof error.message === 'string') return error.message;
  if ('error' in error) return getErrorMessage(error.error);

  return undefined;
}

export function getWorkflowRunErrors(result: unknown, workflowError?: Error | null): string[] {
  const errors = workflowError ? [workflowError.message] : [];
  if (!result || typeof result !== 'object') return errors;

  if ('error' in result) {
    const message = getErrorMessage(result.error);
    if (message) errors.push(message);
  }

  if ('steps' in result && result.steps && typeof result.steps === 'object') {
    for (const [stepId, step] of Object.entries(result.steps)) {
      if (!step || typeof step !== 'object' || !('error' in step)) continue;
      const message = getErrorMessage(step.error);
      if (message) errors.push(`${stepId}: ${message}`);
    }
  }

  return [...new Set(errors)];
}
