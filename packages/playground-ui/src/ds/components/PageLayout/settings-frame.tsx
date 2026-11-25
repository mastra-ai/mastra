import type { ReactNode } from 'react';
import { PageFrame } from './page-frame';
import { PageHeader } from '@/ds/new/layout/page-header';
import { cn } from '@/lib/utils';

export interface SettingsFrameProps {
  breadcrumbs?: ReactNode;
  headerActions?: ReactNode;
  /** The page title. Leave it out when the app's own header already names the page. */
  title?: ReactNode;
  titleAccessory?: ReactNode;
  action?: ReactNode;
  /** A header of the app's own in place of `title` (a `PageHeader` whose title takes focus), with the same inset. */
  header?: ReactNode;
  /** `SettingsGroup`s, 24px apart. */
  children: ReactNode;
}

/** The frame behind `<PageLayout variant="settings">`. */
export function SettingsFrame({
  breadcrumbs,
  headerActions,
  title,
  titleAccessory,
  action,
  header,
  children,
}: SettingsFrameProps) {
  return (
    <PageFrame breadcrumbs={breadcrumbs} headerActions={headerActions}>
      {/* The content row takes the rest of the page's height, so a lone `EmptyState variant="fill"` centers in it. */}
      <div
        data-slot="settings-layout"
        className={cn(
          'mx-auto grid min-h-full w-full max-w-160 min-w-0 gap-8 pt-6',
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
          className="grid min-w-0 content-start gap-6 has-[>[data-slot=empty-state-fill]:only-child]:content-stretch"
        >
          {children}
        </div>
      </div>
    </PageFrame>
  );
}
