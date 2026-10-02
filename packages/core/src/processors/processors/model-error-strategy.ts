export type ModelErrorStrategy = 'warn' | 'strict';

export function handleModelError({
  error,
  errorStrategy,
  abort,
  warningMessage,
  abortMessage,
}: {
  error: unknown;
  errorStrategy: ModelErrorStrategy;
  abort: (reason?: string) => never;
  warningMessage: string;
  abortMessage: string;
}): void {
  console.warn(errorStrategy === 'strict' ? abortMessage : warningMessage, error);

  if (errorStrategy === 'strict') {
    abort(abortMessage);
  }
}
