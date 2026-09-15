import type { ReactNode } from 'react';

import { AppShell } from './AppShell';

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  main: ReactNode;
};

/** Chat pages inside the shared application frame. The main area owns its own scrolling. */
export function ChatLayout({ sidebar, header, main }: ChatLayoutProps) {
  return (
    <AppShell scroll="viewport" sidebar={sidebar} header={header}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{main}</div>
    </AppShell>
  );
}
