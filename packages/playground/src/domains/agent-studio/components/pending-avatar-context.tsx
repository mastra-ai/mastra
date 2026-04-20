import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PendingAvatar } from './create-agent-avatar-picker';

interface PendingAvatarContextValue {
  pendingAvatar: PendingAvatar | null;
  setPendingAvatar: (value: PendingAvatar | null) => void;
}

const PendingAvatarContext = createContext<PendingAvatarContextValue | null>(null);

export function PendingAvatarProvider({ children }: { children: ReactNode }) {
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const value = useMemo(() => ({ pendingAvatar, setPendingAvatar }), [pendingAvatar]);
  return <PendingAvatarContext.Provider value={value}>{children}</PendingAvatarContext.Provider>;
}

/** Returns pending-avatar state when inside a provider, or null otherwise. */
export function useOptionalPendingAvatar() {
  return useContext(PendingAvatarContext);
}
