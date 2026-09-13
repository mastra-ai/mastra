import type { MastraDBMessage } from './state/types';

/** Reserved message metadata key used to link one admitted input to its response rows. */
export const LOGICAL_MESSAGE_ID_METADATA_KEY = 'logicalMessageId' as const;

/** Maximum UTF-8 size for a logical message id carried through native state. */
export const MAX_LOGICAL_MESSAGE_ID_BYTES = 1024;

/** Identity shared by one admitted user input and all response segments it owns. */
export interface LogicalMessageIdentity {
  input: string;
  response: string;
}

/** Input-only identity used by a steer that joins an already-owned response. */
export type LogicalMessageInputIdentity = Pick<LogicalMessageIdentity, 'input'>;

/** Identity accepted by a signal: input-only for a steer, or a full pair for an idle wake. */
export type LogicalMessageSignalIdentity = LogicalMessageInputIdentity | LogicalMessageIdentity;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLogicalMessageId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    new TextEncoder().encode(value).byteLength <= MAX_LOGICAL_MESSAGE_ID_BYTES
  );
}

/**
 * Validate and clone a caller-provided identity. Undefined is the explicit
 * opt-out used by existing callers, while malformed values are rejected so a
 * durable admission can never silently lose its lineage.
 */
export function normalizeLogicalMessageIdentity(value: unknown): LogicalMessageIdentity | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !isValidLogicalMessageId(value.input) || !isValidLogicalMessageId(value.response)) {
    throw new TypeError(
      `logicalMessageIdentity must contain non-empty string input and response ids of at most ${MAX_LOGICAL_MESSAGE_ID_BYTES} UTF-8 bytes`,
    );
  }
  return { input: value.input, response: value.response };
}

/** Validate the identity carried by a signal without requiring it to own a response. */
export function normalizeLogicalMessageInputIdentity(value: unknown): LogicalMessageSignalIdentity | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !isValidLogicalMessageId(value.input)) {
    throw new TypeError(
      `logicalMessageIdentity must contain a non-empty input id of at most ${MAX_LOGICAL_MESSAGE_ID_BYTES} UTF-8 bytes`,
    );
  }
  if (!Object.hasOwn(value, 'response')) return { input: value.input };
  if (!isValidLogicalMessageId(value.response)) {
    throw new TypeError(
      `logicalMessageIdentity response id must be a non-empty string of at most ${MAX_LOGICAL_MESSAGE_ID_BYTES} UTF-8 bytes`,
    );
  }
  return { input: value.input, response: value.response };
}

/** Read only a valid reserved scalar from persisted message metadata. */
export function getLogicalMessageId(metadata: unknown): string | undefined {
  if (!isRecord(metadata)) return undefined;
  if (!Object.hasOwn(metadata, LOGICAL_MESSAGE_ID_METADATA_KEY)) return undefined;
  const value = metadata[LOGICAL_MESSAGE_ID_METADATA_KEY];
  return isValidLogicalMessageId(value) ? value : undefined;
}

/** Add the reserved scalar without mutating a message already held by a caller. */
export function withLogicalMessageId(message: MastraDBMessage, logicalMessageId: string): MastraDBMessage {
  if (!isValidLogicalMessageId(logicalMessageId)) {
    throw new TypeError(
      `logicalMessageId must be a non-empty string of at most ${MAX_LOGICAL_MESSAGE_ID_BYTES} UTF-8 bytes`,
    );
  }
  const existingMetadata = isRecord(message.content.metadata) ? message.content.metadata : undefined;
  return {
    ...message,
    content: {
      ...message.content,
      metadata: {
        ...(existingMetadata ?? {}),
        [LOGICAL_MESSAGE_ID_METADATA_KEY]: logicalMessageId,
      },
    },
  };
}
