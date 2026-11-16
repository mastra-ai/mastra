import { useEffect, useRef } from 'react';

import type { ChatSessionPhase } from '../../workspaces/services/sessionStatus';

const FAVICONS: Record<ChatSessionPhase, string> = {
  initializing: '/favicon-session-initializing.svg',
  working: '/favicon-session-working.svg',
  awaiting: '/favicon-session-awaiting.svg',
  error: '/favicon-session-error.svg',
};

function getFavicon() {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
}

function setFavicon(href: string) {
  const favicon = getFavicon();
  if (!favicon) return;
  favicon.type = 'image/svg+xml';
  favicon.href = href;
}

export interface SessionFaviconProps {
  /** Omitted leaves the page's default favicon in place (green in Vite dev). */
  state?: ChatSessionPhase;
}

/**
 * Sole writer of the browser favicon. Mount exactly one per route branch — two
 * at once race each other's cleanup and leave the default icon behind.
 */
export function SessionFavicon({ state }: SessionFaviconProps) {
  const defaultFavicon = useRef<string | null>(null);

  useEffect(() => {
    defaultFavicon.current ??= getFavicon()?.getAttribute('href') ?? '/mastra.svg';
    const fallback = defaultFavicon.current;
    setFavicon(state ? FAVICONS[state] : fallback);
    return () => setFavicon(fallback);
  }, [state]);

  return null;
}
