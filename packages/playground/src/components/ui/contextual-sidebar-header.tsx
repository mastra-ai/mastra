import { Header } from '@mastra/playground-ui/components/Header';
import type { ReactNode } from 'react';

/** Shared height, border and inset for headings and back navigation. */
export function ContextualSidebarHeader({ children }: { children: ReactNode }) {
  return <Header className="h-10 min-h-10 shrink-0 px-1">{children}</Header>;
}
