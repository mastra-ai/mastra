import { useState } from 'react';
import { useLocation } from 'react-router';

type StarterLocationState = { userMessage?: string } | null;

/**
 * Reads the starter prompt forwarded via `navigate(..., { state })` and
 * captures it into local state on first render so child components keep seeing
 * it across remounts (the edit page may briefly render a skeleton while the
 * stored agent loads, then mount the conversation panel that consumes it).
 *
 * We deliberately do not clear `history.state` after reading: the conversation
 * panel guards against re-dispatch via `hasExistingConversation`, so a refresh
 * is safe, and clearing here would race with skeleton remounts that re-run
 * the `useState` initializer against an already-wiped state.
 */
export const useStarterUserMessage = (): string | undefined => {
  const location = useLocation();

  const [userMessage] = useState<string | undefined>(() => (location.state as StarterLocationState)?.userMessage);

  return userMessage;
};
