import type { ReactNode } from 'react';
import { PageHeader } from '@/ds/new/layout/page-header';

export interface SettingsLayoutProps {
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
 * The app's page around it gives the side gutter (`PageLayout`, Factory's settings panel, Platform's page).
 */
export function SettingsLayout({ title, titleAccessory, action, header, children }: SettingsLayoutProps) {
  return (
    <div data-slot="settings-layout" className="mx-auto grid w-full max-w-160 min-w-0 content-start gap-8 py-6">
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
      <div data-slot="settings-layout-content" className="grid min-w-0 gap-7">
        {children}
      </div>
    </div>
  );
}
