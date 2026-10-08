import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { ContextualSidebarHeader } from './contextual-sidebar-header';
import { ContextualSidebarLayout } from './contextual-sidebar-layout';
import { ContextualSidebarSection } from './contextual-sidebar-section';

/** Position shared chrome while each primitive owns its items and actions. */
export function ResourceNavigationLayout({
  title,
  label,
  search,
  children,
}: {
  title: string;
  label: string;
  search: ReactNode;
  children: ReactNode;
}) {
  return (
    <ContextualSidebarLayout
      label={label}
      className="w-full"
      header={
        <div className="shrink-0">
          <ContextualSidebarHeader>
            <Txt variant="subheading" className="px-3">
              {title}
            </Txt>
          </ContextualSidebarHeader>
          {search}
        </div>
      }
    >
      <ContextualSidebarSection>{children}</ContextualSidebarSection>
    </ContextualSidebarLayout>
  );
}
