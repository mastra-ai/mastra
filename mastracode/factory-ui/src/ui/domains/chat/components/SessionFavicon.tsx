import { useEffect } from 'react';

const DEFAULT_FAVICON = '/mastra.svg';
const STARTING_FAVICON = '/favicon-session-starting.svg';
const WORKING_FAVICON = '/favicon-session-working.svg';
const COMPLETE_FAVICON = '/favicon-session-complete.svg';

function setFavicon(href: string) {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!favicon) return;
  favicon.type = 'image/svg+xml';
  favicon.href = href;
}

/**
 * Pins the browser favicon to the orange "starting" indicator while mounted.
 * Mount alongside the session prepare stepper so favicon and stepper share
 * exactly the same visibility condition.
 */
export function SessionFaviconStarting() {
  useEffect(() => {
    setFavicon(STARTING_FAVICON);
    return () => setFavicon(DEFAULT_FAVICON);
  }, []);
  return null;
}

export interface SessionFaviconProps {
  sessionOpen: boolean;
  busy: boolean;
}

/**
 * Reflects live agent activity in the favicon once the session is ready: a
 * green dot while a run is in-flight, a green check once the turn ends.
 */
export function SessionFavicon({ sessionOpen, busy }: SessionFaviconProps) {
  useEffect(() => {
    if (!sessionOpen) {
      setFavicon(DEFAULT_FAVICON);
      return;
    }
    setFavicon(busy ? WORKING_FAVICON : COMPLETE_FAVICON);
  }, [busy, sessionOpen]);

  useEffect(() => () => setFavicon(DEFAULT_FAVICON), []);

  return null;
}
