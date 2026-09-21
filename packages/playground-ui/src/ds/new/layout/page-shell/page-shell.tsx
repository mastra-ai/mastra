import type { ReactNode } from 'react';

import { PageHeader } from '../page-header';
import { PageLayout } from '@/ds/components/PageLayout';
import { cn } from '@/lib/utils';

export interface PageShellProps {
  title: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  isLoading?: boolean;
  className?: string;
}

/**
 * Standard page wrapper: composes {@link PageLayout} and {@link PageHeader} so
 * every page places its title, icon, description, meta, and action identically.
 *
 * Use for full-bleed application pages that own the whole content area. For
 * narrow settings pages, use `ds/components/SettingsLayout`.
 *
 * `isLoading` affects the header only, blanking the title and description and
 * hiding the icon. Callers render their own loading body.
 */
export function PageShell({ title, children, icon, description, meta, action, isLoading, className }: PageShellProps) {
  return (
    <PageLayout className={cn('grid grid-rows-[auto_minmax(0,1fr)] p-4 px-6', className)}>
      <PageLayout.TopArea>
        <PageHeader>
          {icon != null && !isLoading ? <PageHeader.Icon>{icon}</PageHeader.Icon> : null}
          <PageHeader.Title isLoading={isLoading}>{title}</PageHeader.Title>
          {description != null ? (
            <PageHeader.Description isLoading={isLoading}>{description}</PageHeader.Description>
          ) : null}
          {meta != null ? <PageHeader.Meta beside>{meta}</PageHeader.Meta> : null}
          {action != null ? <PageHeader.Action>{action}</PageHeader.Action> : null}
        </PageHeader>
      </PageLayout.TopArea>
      <PageLayout.MainArea>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}
