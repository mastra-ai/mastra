import type { ReactNode } from 'react';
import { PageLayout } from '../PageLayout/page-layout';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { Icon } from '@/ds/icons/Icon';
import { PageHeader } from '@/ds/new/layout/page-header/page-header';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export interface FormLayoutProps {
  breadcrumbs?: ReactNode;
  backHref: string;
  backLabel: string;
  title: ReactNode;
  isLoading?: boolean;
  LinkComponent?: LinkComponent;
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * The page frame for any create or edit form: New alert, New project, Edit destination.
 *
 * A centered 640px column, the same width as `SettingsLayout`, under a header made of a back link and the page title.
 * The back link, the title, each section's `SettingsTitle` and the field labels share one left edge, and sections sit 28px apart.
 * There is no breadcrumb bar: the back link is the way out, so a form page shows one way back, not two.
 *
 * Use another frame when the page is not a form:
 * - `SettingsLayout`, for a settings page someone browses to and changes in place.
 * - `PageLayout`, for every other page: lists, dashboards, detail pages and explorers.
 *
 * Pass the app's router link as `LinkComponent` so the back link navigates without a reload. It renders an `<a>` otherwise.
 */
export function FormLayout({
  breadcrumbs,
  backHref,
  backLabel,
  title,
  isLoading = false,
  LinkComponent: Link = 'a',
  aside,
  children,
}: FormLayoutProps) {
  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <div className="@container grid min-h-full">
        <div
          data-slot="form-layout"
          className={cn(
            'mx-auto grid w-full max-w-160 min-w-0 gap-8 py-6',
            aside == null
              ? 'grid-rows-[auto_1fr]'
              : 'grid-rows-[auto_auto_1fr] @4xl:max-w-7xl @4xl:grid-cols-[minmax(0,--spacing(160))_minmax(--spacing(64),1fr)] @4xl:grid-rows-[auto_1fr] @4xl:gap-x-10',
          )}
        >
          <PageHeader className="@4xl:col-start-1">
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
          {aside != null && (
            <div data-slot="form-layout-aside" className="min-w-0 @4xl:col-start-2 @4xl:row-start-2">
              <div className="@4xl:sticky @4xl:top-6">{aside}</div>
            </div>
          )}
          <div
            data-slot="form-layout-content"
            className="grid min-w-0 content-start gap-7 has-[>[data-slot=empty-state-fill]:only-child]:content-stretch @4xl:col-start-1 @4xl:row-start-2"
          >
            {children}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
