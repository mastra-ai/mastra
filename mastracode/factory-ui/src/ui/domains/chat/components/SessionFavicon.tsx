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

/**
 * Pins the browser favicon to the purple "initializing" indicator while
 * mounted. Mount alongside the session prepare stepper so favicon and stepper
 * share exactly the same visibility condition.
 */
export function SessionFaviconInitializing() {
  useEffect(() => {
    setFavicon(FAVICONS.initializing);
    return () => setFavicon(DEFAULT_FAVICON);
  }, []);
  return null;
}

export interface SessionFaviconProps {
  /**
   * `null` leaves the default Mastra favicon in place (used when no session is
   * open on screen).
   */
  state: SessionFaviconState | null;
}

/**
 * Reflects live session state in the favicon: purple while initializing, green
 * while the agent is working, red on error, blue when it's the user's turn.
 */
export function SessionFavicon({ state }: SessionFaviconProps) {
  useEffect(() => {
    setFavicon(state ? FAVICONS[state] : DEFAULT_FAVICON);
  }, [state]);

  useEffect(() => () => setFavicon(DEFAULT_FAVICON), []);

  return null;
}
