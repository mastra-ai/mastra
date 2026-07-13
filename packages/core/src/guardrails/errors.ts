export class GuardrailResolutionError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'GuardrailResolutionError';
    this.cause = cause;
  }
}
