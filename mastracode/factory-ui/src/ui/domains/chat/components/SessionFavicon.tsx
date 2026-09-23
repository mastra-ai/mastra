import { useEffect } from 'react';

import type { ChatSessionPhase } from '../../workspaces/services/sessionStatus';

const DEFAULT_FAVICON = '/mastra.svg';

const FAVICONS: Record<ChatSessionPhase, string> = {
  initializing: '/favicon-session-initializing.svg',
  working: '/favicon-session-working.svg',
  awaiting: '/favicon-session-awaiting.svg',
  error: '/favicon-session-error.svg',
};

function setFavicon(href: string) {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!favicon) return;
  favicon.type = 'image/svg+xml';
  favicon.href = href;
}

export interface SessionFaviconProps {
  /** Omitted leaves the default Mastra favicon in place. */
  state?: ChatSessionPhase;
}

/**
 * Sole writer of the browser favicon. Mount exactly one per route branch — two
 * at once race each other's cleanup and leave the default icon behind.
 */
export function SessionFavicon({ state }: SessionFaviconProps) {
  useEffect(() => {
    setFavicon(state ? FAVICONS[state] : DEFAULT_FAVICON);
    return () => setFavicon(DEFAULT_FAVICON);
  }, [state]);

  return null;
}
