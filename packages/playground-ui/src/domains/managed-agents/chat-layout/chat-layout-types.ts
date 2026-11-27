import type { ReactNode } from 'react';

export interface ChatLayoutProps {
  threads?: ReactNode;
  threadsOpen?: boolean;
  onThreadsOpenChange?: (open: boolean) => void;
  details?: ReactNode;
  detailsOpen: boolean;
  onDetailsOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** The keys that toggle the side panels, for the toggles' tooltips. */
export const CHAT_LAYOUT_SHORTCUTS = { threads: '{', details: ']' } as const;
