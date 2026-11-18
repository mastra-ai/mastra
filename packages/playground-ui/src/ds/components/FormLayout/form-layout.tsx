import type { ReactNode } from 'react';
import { PageLayout } from '../PageLayout/page-layout';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { Icon } from '@/ds/icons/Icon';
import { PageHeader } from '@/ds/new/layout/page-header/page-header';
import { SettingsLayout } from '@/ds/new/settings/settings-layout';
import type { LinkComponent } from '@/ds/types/link-component';

export interface FormLayoutProps {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  isLoading?: boolean;
  LinkComponent?: LinkComponent;
  children: ReactNode;
}

/**
 * The page frame for any create or edit form: New alert, New project, Edit destination.
 *
 * A centered 640px column, the same as `SettingsLayout`, under a header made of a back link and the page title.
 * The header is inset to line up with each section's `SettingsTitle`, and sections sit 28px apart.
 * There is no breadcrumb bar: the back link is the way out, so a form page shows one way back, not two.
 *
 * Use another frame when the page is not a form:
 * - `SettingsLayout` inside a `PageLayout` with breadcrumbs, for a settings page someone browses to and changes in place.
 * - `PageLayout variant="narrow"` with a `PageHeader`, for a one-column page to read: an overview, a feed, a detail page.
 *
 * Pass the app's router link as `LinkComponent` so the back link navigates without a reload. It renders an `<a>` otherwise.
 */
export function FormLayout({
  backHref,
  backLabel,
  title,
  isLoading = false,
  LinkComponent: Link = 'a',
  children,
}: FormLayoutProps) {
  return (
    <PageLayout>
      <SettingsLayout
        header={
          <PageHeader>
            <PageHeader.Eyebrow>
              <Link href={backHref} aria-label={`Back to ${backLabel}`}>
                <Icon size="xs">
                  <IconArrowLeft aria-hidden />
                </Icon>
                {backLabel}
              </Link>
            </PageHeader.Eyebrow>
            <PageHeader.Title isLoading={isLoading} aria-busy={isLoading || undefined}>
              {title}
            </PageHeader.Title>
          </PageHeader>
        }
      >
        {children}
      </SettingsLayout>
    </PageLayout>
  );
}
