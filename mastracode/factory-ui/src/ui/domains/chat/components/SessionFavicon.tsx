import { useEffect } from 'react';

const DEFAULT_FAVICON = '/mastra.svg';

export type SessionFaviconState = 'initializing' | 'working' | 'awaiting' | 'error';

const FAVICONS: Record<SessionFaviconState, string> = {
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
  /**
   * `null` leaves the default Mastra favicon in place (used when no session is
   * open on screen).
   */
  state: SessionFaviconState | null;
}

/**
 * Sole writer of the browser favicon: amber while the session initializes,
 * green while the agent is working, red on error, blue when it's the user's
 * turn. Mount exactly one per route branch — two mounted at once race each
 * other's cleanup and leave the default icon behind.
 */
export function SessionFavicon({ state }: SessionFaviconProps) {
  useEffect(() => {
    setFavicon(state ? FAVICONS[state] : DEFAULT_FAVICON);
    return () => setFavicon(DEFAULT_FAVICON);
  }, [state]);

  return null;
}
