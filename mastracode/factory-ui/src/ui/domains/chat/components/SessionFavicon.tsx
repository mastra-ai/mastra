import { useEffect } from 'react';

const DEFAULT_FAVICON = '/mastra.svg';
const STARTING_FAVICON = '/favicon-session-starting.svg';
const WORKING_FAVICON = '/favicon-session-working.svg';
const COMPLETE_FAVICON = '/favicon-session-complete.svg';

export interface SessionFaviconProps {
  sessionOpen: boolean;
  starting: boolean;
  busy: boolean;
}

function setFavicon(href: string) {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!favicon) return;
  favicon.type = 'image/svg+xml';
  favicon.href = href;
}

export function SessionFavicon({ sessionOpen, starting, busy }: SessionFaviconProps) {
  useEffect(() => {
    if (!sessionOpen) {
      setFavicon(DEFAULT_FAVICON);
      return;
    }

    if (starting) {
      setFavicon(STARTING_FAVICON);
      return;
    }

    if (busy) {
      setFavicon(WORKING_FAVICON);
      return;
    }

    setFavicon(COMPLETE_FAVICON);
  }, [busy, sessionOpen, starting]);

  useEffect(() => () => setFavicon(DEFAULT_FAVICON), []);

  return null;
}
