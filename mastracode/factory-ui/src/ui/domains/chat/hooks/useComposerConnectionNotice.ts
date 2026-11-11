import { useEffect, useState } from 'react';

import type { ChatConnectionApi } from '../context/ChatConnectionContext';

export type ComposerConnectionNoticeState = 'reconnecting' | 'error';

/** Drops that heal within this window (blips, tab resumes) are never shown. */
export const RECONNECT_NOTICE_DELAY_MS = 2_000;

/**
 * What the composer should say about the connection. Presentation only; the
 * connection's readiness is never delayed. A reconnect surfaces only once it
 * has outlasted the delay, and recovery clears it without a confirmation.
 */
export function useComposerConnectionNotice(
  status: ChatConnectionApi['status'],
): ComposerConnectionNoticeState | undefined {
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (status !== 'reconnecting') return;
    const timeout = window.setTimeout(() => setDelayElapsed(true), RECONNECT_NOTICE_DELAY_MS);
    return () => {
      window.clearTimeout(timeout);
      setDelayElapsed(false);
    };
  }, [status]);

  if (status === 'error') return 'error';
  if (status === 'reconnecting' && delayElapsed) return 'reconnecting';
  return undefined;
}
