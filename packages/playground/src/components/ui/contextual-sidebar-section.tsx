import type { ReactNode } from 'react';

/** All sidebar rows use the same inset from the frame and divider. */
export function ContextualSidebarSection({ children }: { children: ReactNode }) {
  return <div className="px-1 py-2">{children}</div>;
}
