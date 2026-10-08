import { useMatch } from 'react-router';

/** Preserve existing thread URLs while giving conversations their own Studio destination. */
export function useIsAgentChat() {
  return Boolean(useMatch('/agents/:agentId/threads/:threadId'));
}
