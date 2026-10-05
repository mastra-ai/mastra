import { getAgentVersionLabelError } from '../hooks/agent-version-label-error';
import { isAgentRunAuthorizationError } from './agent-run-version-selector-error';

export type AgentRunContinuationError =
  | { type: 'pinned-version-conflict'; message: string }
  | { type: 'authorization'; message: string }
  | { type: 'other'; error: unknown };

const PINNED_VERSION_CONFLICT_MESSAGE =
  'This active run cannot change version policy. Start a new run to use a different version or label.';

const AUTHORIZATION_MESSAGE =
  'You no longer have permission to continue this run. Studio refreshed your access and stopped it.';

/**
 * Classifies failures from approval, decline, and resume endpoints. These are
 * pinned-run continuations, so they deliberately do not enter the future-run
 * selector recovery path.
 */
export const classifyAgentRunContinuationError = (error: unknown): AgentRunContinuationError => {
  const versionError = getAgentVersionLabelError(error);
  if (versionError?.code === 'PINNED_VERSION_CONFLICT') {
    return { type: 'pinned-version-conflict', message: PINNED_VERSION_CONFLICT_MESSAGE };
  }
  if (isAgentRunAuthorizationError(error)) {
    return { type: 'authorization', message: AUTHORIZATION_MESSAGE };
  }
  return { type: 'other', error };
};
