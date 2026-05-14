import type { ModelCandidate } from './normalize-candidate';
import type { ProviderModelEntry } from './types';

export const MODEL_NOT_ALLOWED_CODE = 'MODEL_NOT_ALLOWED' as const;

/**
 * Thrown by `enforceModelAllowlist` call sites when a write attempts to persist
 * a model that the active builder allowlist does not permit.
 *
 * Lives in `@mastra/core` so editor and server layers can both throw it
 * without crossing package boundaries. The server adapter
 * (`packages/server/src/server/handlers/error.ts`) maps this to HTTP 422 with
 * a structured JSON body of the same shape.
 */
export class ModelNotAllowedError extends Error {
  readonly code = MODEL_NOT_ALLOWED_CODE;
  readonly allowed: ProviderModelEntry[] | undefined;
  readonly attempted: ModelCandidate;
  readonly offendingLabel: string;

  constructor(args: {
    allowed: ProviderModelEntry[] | undefined;
    attempted: ModelCandidate;
    offendingLabel: string;
    message?: string;
  }) {
    const message =
      args.message ??
      `Model "${args.attempted.provider}/${args.attempted.modelId}" (${args.offendingLabel}) is not in the configured allowlist.`;
    super(message);
    this.name = 'ModelNotAllowedError';
    this.allowed = args.allowed;
    this.attempted = args.attempted;
    this.offendingLabel = args.offendingLabel;
  }
}

export function isModelNotAllowedError(error: unknown): error is ModelNotAllowedError {
  return error instanceof Error && (error as { code?: unknown }).code === MODEL_NOT_ALLOWED_CODE;
}
