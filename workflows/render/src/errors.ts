export class RenderCapabilityError extends Error {
  override name = 'RenderCapabilityError';
  constructor(feature: string) {
    super(`Render Workflows adapter does not support ${feature}. See the package capability table.`);
  }
}

export class RenderProtocolError extends Error {
  override name = 'RenderProtocolError';
}

export class RenderSubmissionUnknownError extends Error {
  override name = 'RenderSubmissionUnknownError';
  constructor(
    readonly runId: string,
    options?: ErrorOptions,
  ) {
    super(`Submission of Mastra run ${runId} is uncertain. Inspect this run before submitting again.`, options);
  }
}

export class RenderRunConflictError extends Error {
  override name = 'RenderRunConflictError';
}

export function unsupported(feature: string): never {
  throw new RenderCapabilityError(feature);
}

export function errorRecord(error: unknown): { name: string; message: string } {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return { name: 'name' in error && typeof error.name === 'string' ? error.name : 'Error', message: error.message };
  }
  return { name: 'Error', message: String(error) };
}
