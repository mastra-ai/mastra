import type { ReactNode } from 'react';

import { PageLayout } from './PageLayout';

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  content?: ReactNode;
  /** A complete main area when content and footer need to share one provider boundary. */
  main?: ReactNode;
  /** Optional pinned region below the chat content (e.g. composer). */
  footer?: ReactNode;
};

/** Slot-based chat content arrangement inside the shared application page frame. */
export function ChatLayout({ sidebar, header, content, main, footer }: ChatLayoutProps) {
  return (
    <PageLayout sidebar={sidebar} header={header}>
      {main ?? (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
          {content}
          {footer}
        </div>
      )}
    </PageLayout>
  );
}
