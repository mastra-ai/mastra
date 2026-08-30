import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import type { VersionLabelApiErrorCode } from '../schemas/agent-version-labels';

import { handleError } from './error';

export type { VersionLabelApiErrorCode } from '../schemas/agent-version-labels';

export const VERSION_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

/** Validate selector syntax before comparing selectors from different transports. */
export function validateVersionLabelSelector(label: string): void {
  if (!VERSION_LABEL_PATTERN.test(label)) {
    throw createVersionLabelApiError('INVALID_LABEL', 'The version label is invalid.', { label });
  }
}

const VERSION_LABEL_API_ERROR_STATUS: Record<VersionLabelApiErrorCode, StatusCode> = {
  INVALID_VERSION_SELECTOR: 400,
  INVALID_LABEL: 400,
  RESERVED_LABEL: 400,
  ENTITY_NOT_FOUND: 404,
  VERSION_NOT_FOUND: 404,
  LABEL_NOT_FOUND: 404,
  LABEL_MOVE_CONFLICT: 409,
  PINNED_VERSION_CONFLICT: 409,
  VERSION_IN_USE_BY_LABEL: 409,
  VERSION_LABEL_INTEGRITY_ERROR: 500,
  VERSION_LABELS_UNSUPPORTED: 501,
};

const STORAGE_TO_API_ERROR_CODE = {
  INVALID_VERSION_LABEL: 'INVALID_LABEL',
  RESERVED_VERSION_LABEL: 'RESERVED_LABEL',
  VERSION_LABEL_NOT_FOUND: 'LABEL_NOT_FOUND',
  VERSION_LABEL_CONFLICT: 'LABEL_MOVE_CONFLICT',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  VERSION_NOT_OWNED_BY_ENTITY: 'VERSION_NOT_FOUND',
  VERSION_IN_USE_BY_LABEL: 'VERSION_IN_USE_BY_LABEL',
  VERSION_LABEL_INTEGRITY_ERROR: 'VERSION_LABEL_INTEGRITY_ERROR',
  VERSION_LABELS_UNSUPPORTED: 'VERSION_LABELS_UNSUPPORTED',
} as const satisfies Record<string, VersionLabelApiErrorCode>;

type VersionLabelStorageError = Error & {
  id: keyof typeof STORAGE_TO_API_ERROR_CODE;
  details?: Record<string, unknown>;
};

function isVersionLabelStorageError(error: unknown): error is VersionLabelStorageError {
  return (
    error instanceof Error &&
    typeof (error as { id?: unknown }).id === 'string' &&
    (error as unknown as { id: string }).id in STORAGE_TO_API_ERROR_CODE
  );
}

function publicStorageErrorDetails(error: VersionLabelStorageError): Record<string, unknown> | undefined {
  if (!error.details) return undefined;

  // Storage adapters include the actual parent ID when they detect a foreign
  // version. That is useful for adapter diagnostics but must not cross the
  // public authorization boundary.
  const { versionEntityId: _versionEntityId, ...details } = error.details;
  return details;
}

/**
 * Build the stable JSON error envelope shared by label management and runtime
 * selector paths.
 */
export function createVersionLabelApiError(
  code: VersionLabelApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown,
): HTTPException {
  const body = {
    error: {
      code,
      message,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    },
  };

  return new HTTPException(VERSION_LABEL_API_ERROR_STATUS[code], {
    message,
    cause,
    res: new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
      status: VERSION_LABEL_API_ERROR_STATUS[code],
    }),
  });
}

/**
 * Map the frozen storage error vocabulary to the public label API vocabulary.
 * Unknown errors retain the server's existing error handling behavior.
 */
export function handleVersionLabelError(error: unknown, defaultMessage: string): never {
  if (isVersionLabelStorageError(error)) {
    const missingComputedLabel =
      error.id === 'VERSION_NOT_FOUND' &&
      typeof error.details?.label === 'string' &&
      error.details.versionId === undefined;
    const code = missingComputedLabel ? 'LABEL_NOT_FOUND' : STORAGE_TO_API_ERROR_CODE[error.id];
    const message =
      error.id === 'VERSION_NOT_OWNED_BY_ENTITY'
        ? 'The requested version was not found.'
        : missingComputedLabel
          ? 'The version label was not found.'
          : error.message;
    throw createVersionLabelApiError(code, message, publicStorageErrorDetails(error), error);
  }

  // Preserve a deliberately structured API response created by a caller of
  // createVersionLabelApiError instead of flattening it through handleError.
  if (error instanceof HTTPException && error.res) {
    throw error;
  }

  return handleError(error, defaultMessage);
}
