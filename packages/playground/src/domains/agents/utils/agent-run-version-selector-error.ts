import { MastraClientError } from '@mastra/client-js';

import { getAgentVersionLabelError } from '../hooks/agent-version-label-error';
import type { AgentRunVersionSelectorErrorCode } from '@/types';

const RUN_VERSION_SELECTOR_ERROR_CODES = [
  'INVALID_VERSION_SELECTOR',
  'ENTITY_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'LABEL_NOT_FOUND',
  'VERSION_LABEL_INTEGRITY_ERROR',
  'VERSION_LABELS_UNSUPPORTED',
] as const satisfies readonly AgentRunVersionSelectorErrorCode[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRunVersionSelectorErrorCode = (value: unknown): value is AgentRunVersionSelectorErrorCode =>
  typeof value === 'string' && RUN_VERSION_SELECTOR_ERROR_CODES.some(code => code === value);

const getPlainEnvelopeCode = (value: unknown): AgentRunVersionSelectorErrorCode | undefined => {
  if (!isRecord(value)) return undefined;
  if (isRunVersionSelectorErrorCode(value.code)) return value.code;

  const envelope = value.error;
  if (isRecord(envelope) && isRunVersionSelectorErrorCode(envelope.code)) return envelope.code;

  const body = value.body;
  if (!isRecord(body)) return undefined;
  const bodyEnvelope = body.error;
  return isRecord(bodyEnvelope) && isRunVersionSelectorErrorCode(bodyEnvelope.code) ? bodyEnvelope.code : undefined;
};

/**
 * Narrows selector failures at the chat transport boundary. HTTP failures use
 * the SDK error parser; streamed failures arrive as deserialized envelopes.
 */
export const getAgentRunVersionSelectorErrorCode = (error: unknown): AgentRunVersionSelectorErrorCode | undefined => {
  const apiError = getAgentVersionLabelError(error);
  if (apiError && isRunVersionSelectorErrorCode(apiError.code)) return apiError.code;
  return getPlainEnvelopeCode(error);
};

/** Identifies a server-authoritative authorization rejection at either HTTP or streamed boundaries. */
export const isAgentRunAuthorizationError = (error: unknown): boolean => {
  if (error instanceof MastraClientError) return error.status === 403;
  return isRecord(error) && error.status === 403;
};
