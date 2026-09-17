import { MastraClientError } from '@mastra/client-js';
import type { VersionLabelApiError } from '@mastra/client-js';

export const AGENT_VERSION_LABEL_ERROR_CODES = [
  'INVALID_VERSION_SELECTOR',
  'INVALID_LABEL',
  'RESERVED_LABEL',
  'ENTITY_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'LABEL_NOT_FOUND',
  'LABEL_MOVE_CONFLICT',
  'PINNED_VERSION_CONFLICT',
  'VERSION_IN_USE_BY_LABEL',
  'VERSION_LABEL_INTEGRITY_ERROR',
  'VERSION_LABELS_UNSUPPORTED',
] as const;

export type AgentVersionLabelErrorCode = (typeof AGENT_VERSION_LABEL_ERROR_CODES)[number];

export type AgentVersionLabelError = Pick<VersionLabelApiError['error'], 'message' | 'details'> & {
  status: number;
  code: AgentVersionLabelErrorCode;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isAgentVersionLabelErrorCode = (value: unknown): value is AgentVersionLabelErrorCode =>
  typeof value === 'string' && AGENT_VERSION_LABEL_ERROR_CODES.some(code => code === value);

/** Narrows the SDK's currently string-typed version-label error envelope. */
export const getAgentVersionLabelError = (error: unknown): AgentVersionLabelError | undefined => {
  if (!(error instanceof MastraClientError) || !isRecord(error.body)) return undefined;

  const envelope = error.body.error;
  if (!isRecord(envelope) || !isAgentVersionLabelErrorCode(envelope.code) || typeof envelope.message !== 'string') {
    return undefined;
  }

  const details = isRecord(envelope.details) ? envelope.details : undefined;
  return details
    ? { status: error.status, code: envelope.code, message: envelope.message, details }
    : { status: error.status, code: envelope.code, message: envelope.message };
};
