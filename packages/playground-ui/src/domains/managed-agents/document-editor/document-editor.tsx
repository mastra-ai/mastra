import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { PageLayout } from '@/ds/components/PageLayout';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export interface DocumentEditorProps {
  breadcrumbs: ReactNode;
  title: string;
  children: ReactNode;
}

export function DocumentEditorRoot({ breadcrumbs, title, children }: DocumentEditorProps) {
  return (
    <PageLayout variant="page" body="fixed" breadcrumbs={breadcrumbs}>
      <h1 className="sr-only">{title}</h1>
      <div className="flex h-full min-h-0 gap-2 p-2">{children}</div>
    </PageLayout>
  );
}

export interface DocumentEditorMainProps {
  footer?: ReactNode;
  children: ReactNode;
}

export function DocumentEditorMain({ footer, children }: DocumentEditorMainProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 px-8 pt-4">
      <div className="flex min-h-0 w-full max-w-170 flex-1 flex-col gap-6 overflow-y-auto">{children}</div>
      {footer ? <div className="w-full max-w-170">{footer}</div> : null}
    </div>
  );
}

export interface DocumentEditorHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}

export function DocumentEditorHeader({ title, description, badge }: DocumentEditorHeaderProps) {
  return (
    <div>
      <span className="flex items-center gap-2">
        <Txt as="h2" variant="heading" tone="ink">
          {title}
        </Txt>
        {badge}
      </span>
      {description ? (
        <Txt variant="body" tone="muted">
          {description}
        </Txt>
      ) : null}
    </div>
  );
}

export function DocumentEditorBodySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export interface DocumentEditorDetailsProps {
  onClose?: () => void;
  isLoading?: boolean;
  children?: ReactNode;
}

export function DocumentEditorDetails({ onClose, isLoading, children }: DocumentEditorDetailsProps) {
  return (
    <aside
      aria-label="Details"
      aria-busy={isLoading || undefined}
      className="flex w-75 shrink-0 flex-col self-start overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)]"
    >
      <div className="flex min-h-10 items-center justify-between border-b border-surface-rim pr-2 pl-4">
        <Txt as="h2" variant="label" tone="ink">
          Details
        </Txt>
        {onClose ? (
          <Button variant="ghost" size="icon-sm" aria-label="Hide details" onClick={onClose}>
            <IconCrossMedium />
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        children
      )}
    </aside>
  );
}

export interface DocumentEditorSectionProps {
  label: string;
  children: ReactNode;
}

export function DocumentEditorSection({ label, children }: DocumentEditorSectionProps) {
  return (
    <section className="flex flex-col gap-2 border-b border-surface-rim px-4 py-3 last:border-b-0">
      <Txt as="h3" variant="caption" tone="muted">
        {label}
      </Txt>
      {children}
    </section>
  );
}

export interface DocumentEditorFactProps {
  label: ReactNode;
  value: ReactNode;
}

export function DocumentEditorFact({ label, value }: DocumentEditorFactProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt as="span" variant="body-sm" tone="ink" className="min-w-0 truncate">
        {label}
      </Txt>
      <Txt as="span" variant="body-sm" tone="muted" className="shrink-0">
        {value}
      </Txt>
    </div>
  );
}
