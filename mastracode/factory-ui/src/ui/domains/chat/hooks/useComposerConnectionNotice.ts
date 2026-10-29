import { useEffect, useState } from 'react';

import type { ChatConnectionApi } from '../context/ChatConnectionContext';

export type ComposerConnectionNoticeState = 'reconnecting' | 'error' | 'reconnected';

const RECONNECT_DELAY_MS = 300;
const RECOVERED_DURATION_MS = 2_000;

interface Presentation {
  open: boolean;
  notice: ComposerConnectionNoticeState;
}

/** Temporal presentation state; connection readiness itself is never delayed. */
export function useComposerConnectionNotice(status: ChatConnectionApi['status']) {
  const [presentation, setPresentation] = useState<Presentation>(() => ({
    open: status === 'error',
    notice: 'reconnecting',
  }));

  useEffect(() => {
    if (status === 'reconnecting' && !presentation.open) {
      const timeout = window.setTimeout(() => {
        setPresentation({ open: true, notice: 'reconnecting' });
      }, RECONNECT_DELAY_MS);
      return () => window.clearTimeout(timeout);
    }

    if (status === 'ready' && presentation.open) {
      const timeout = window.setTimeout(() => {
        // Retain the confirmation while the shared header animates closed.
        setPresentation({ open: false, notice: 'reconnected' });
      }, RECOVERED_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }

    if ((status === 'error' && !presentation.open) || (status === 'connecting' && presentation.open)) {
      const timeout = window.setTimeout(() => {
        setPresentation({ open: status === 'error', notice: 'error' });
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [status, presentation.open]);

  const open = status === 'error' || (status !== 'connecting' && presentation.open);
  if (!open) return { open, notice: presentation.notice };
  if (status === 'ready') return { open, notice: 'reconnected' as const };
  if (status === 'error') return { open, notice: 'error' as const };
  return { open, notice: 'reconnecting' as const };
}
