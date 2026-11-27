import type { ReactNode } from 'react';
import { PageFrame } from './page-frame';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { Icon } from '@/ds/icons/Icon';
import { PageHeader } from '@/ds/new/layout/page-header/page-header';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export interface FormFrameProps {
  breadcrumbs?: ReactNode;
  backHref?: string;
  backLabel?: string;
  title: ReactNode;
  isLoading?: boolean;
  LinkComponent?: LinkComponent;
  aside?: ReactNode;
  asidePlacement?: 'start' | 'end';
  children: ReactNode;
}

/** The frame behind `<PageLayout variant="form">`. */
export function FormFrame({
  breadcrumbs,
  backHref,
  backLabel,
  title,
  isLoading = false,
  LinkComponent: Link = 'a',
  aside,
  asidePlacement = 'end',
  children,
}: FormFrameProps) {
  const hasAside = Boolean(aside);
  const asideStart = hasAside && asidePlacement === 'start';

  return (
    // A form shows one way back: breadcrumbs (multi-step create flows) replace the back link, never both.
    <PageFrame breadcrumbs={breadcrumbs}>
      <div className="@container grid min-h-full">
        <div
          data-slot="form-layout"
          className={cn(
            'mx-auto grid w-full max-w-160 min-w-0 grid-cols-1 gap-8 pt-6',
            !hasAside
              ? 'grid-rows-[auto_1fr]'
              : asideStart
                ? 'grid-rows-[auto_auto_1fr] @4xl:max-w-226 @4xl:grid-cols-[--spacing(56)_minmax(0,--spacing(160))] @4xl:grid-rows-[auto_1fr] @4xl:gap-x-10'
                : 'grid-rows-[auto_auto_1fr] @4xl:max-w-7xl @4xl:grid-cols-[minmax(0,--spacing(160))_minmax(--spacing(64),1fr)] @4xl:grid-rows-[auto_1fr] @4xl:gap-x-10',
          )}
        >
          <PageHeader className={asideStart ? '@4xl:col-span-2' : '@4xl:col-start-1'}>
            {!breadcrumbs && backHref !== undefined && backLabel !== undefined && (
              <PageHeader.Eyebrow>
                <Link href={backHref} aria-label={`Back to ${backLabel}`}>
                  <Icon size="xs">
                    <IconArrowLeft aria-hidden />
                  </Icon>
                  {backLabel}
                </Link>
              </PageHeader.Eyebrow>
            )}
            <PageHeader.Title isLoading={isLoading} aria-busy={isLoading || undefined}>
              {title}
            </PageHeader.Title>
          </PageHeader>
          {hasAside && (
            <div
              data-slot="form-layout-aside"
              data-placement={asidePlacement}
              className={cn('min-w-0 @4xl:row-start-2', asideStart ? '@4xl:col-start-1' : '@4xl:col-start-2')}
            >
              <div className="@4xl:sticky @4xl:top-6">{aside}</div>
            </div>
          )}
          <div
            data-slot="form-layout-content"
            className={cn(
              'grid min-w-0 grid-cols-1 content-start gap-6 has-[>[data-slot=empty-state-fill]:only-child]:content-stretch @4xl:row-start-2',
              asideStart ? '@4xl:col-start-2' : '@4xl:col-start-1',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
