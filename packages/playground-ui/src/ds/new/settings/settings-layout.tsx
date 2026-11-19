import type { ReactNode } from 'react';
import { PageLayout } from '@/ds/components/PageLayout/page-layout';
import { PageHeader } from '@/ds/new/layout/page-header';
import { cn } from '@/lib/utils';

export interface SettingsLayoutProps {
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** The page title. Leave it out when the app's own header already names the page. */
  title?: ReactNode;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  /** A header of the app's own in place of `title` (a `PageHeader` whose title takes focus), with the same inset. */
  header?: ReactNode;
  /** `SettingsGroup`s, 28px apart. */
  children: ReactNode;
}

/**
 * A settings page: a centered 640px column with the title, inset like the section titles, above its sections.
 */
export function SettingsLayout({
  breadcrumbs,
  headerActions,
  title,
  titleAccessory,
  action,
  header,
  children,
}: SettingsLayoutProps) {
  return (
    <PageLayout breadcrumbs={breadcrumbs} headerActions={headerActions}>
      {/* The content row takes the rest of the page's height, so a lone `EmptyState variant="fill"` centers in it. */}
      <div
        data-slot="settings-layout"
        className={cn(
          'mx-auto grid min-h-full w-full max-w-160 min-w-0 gap-8 py-6',
          header != null || title != null ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
        )}
      >
        {header != null && (
          <div data-slot="settings-page-header" className="ps-2.5">
            {header}
          </div>
        )}
        {header == null && title != null && (
          <PageHeader data-slot="settings-page-header" className="ps-2.5">
            <PageHeader.Title>{title}</PageHeader.Title>
            {titleAccessory != null && <PageHeader.Meta beside>{titleAccessory}</PageHeader.Meta>}
            {action != null && <PageHeader.Action>{action}</PageHeader.Action>}
          </PageHeader>
        )}
        <div
          data-slot="settings-layout-content"
          className="grid min-w-0 content-start gap-7 has-[>[data-slot=empty-state-fill]:only-child]:content-stretch"
        >
          {children}
        </div>
      </div>
    </PageLayout>
  );
}
