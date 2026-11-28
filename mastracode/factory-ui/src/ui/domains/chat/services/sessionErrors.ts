import type { FactoryUserSession } from '@internal/factory-contract';
import type { UseQueryResult } from '@tanstack/react-query';

import type { FailedDraft } from './handoffFiles';

/**
 * A draft's session failed to start after its thread opened. The thread route
 * sends the person back to the draft with what they had picked; the draft's
 * images stay stashed under its id.
 */
export class DraftSessionCreateError extends Error {
  constructor(
    message: string,
    readonly draft: FailedDraft,
    readonly draftPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DraftSessionCreateError';
  }
}

/** The server answers a missing session and a teammate's private one with the same 404. */
export function isSessionNotFound(error: Error): boolean {
  return 'status' in error && error.status === 404;
}

export function sessionUnavailableError(query: UseQueryResult<FactoryUserSession>): Error | undefined {
  if (!query.error) return undefined;
  return query.isLoadingError || isSessionNotFound(query.error) ? query.error : undefined;
}
