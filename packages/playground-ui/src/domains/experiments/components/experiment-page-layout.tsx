import type { ReactNode } from 'react';
import { ExperimentBreadcrumbs } from './experiment-breadcrumbs';
import type { ExperimentBreadcrumbsProps } from './experiment-breadcrumbs';
import { ExperimentHeaderActions } from './experiment-header-actions';
import type { ExperimentHeaderActionsProps } from './experiment-header-actions';
import { PageLayout } from '@/ds/components/PageLayout';

export interface ExperimentPageLayoutProps
  extends ExperimentBreadcrumbsProps, Omit<ExperimentHeaderActionsProps, 'experiment'> {
  children?: ReactNode;
}

/**
 * An experiment page's frame: breadcrumbs and the experiment's actions menu over the page body.
 * The menu shows once the experiment loads, with only the actions the host passes callbacks for.
 */
export function ExperimentPageLayout({
  experimentsHref,
  experimentId,
  experiment,
  onRename,
  onDeleteClick,
  rerunSlot,
  children,
}: ExperimentPageLayoutProps) {
  return (
    <PageLayout
      variant="page"
      breadcrumbs={
        <ExperimentBreadcrumbs experimentsHref={experimentsHref} experimentId={experimentId} experiment={experiment} />
      }
      headerActions={
        experiment && (
          <ExperimentHeaderActions
            experiment={experiment}
            onRename={onRename}
            onDeleteClick={onDeleteClick}
            rerunSlot={rerunSlot}
          />
        )
      }
    >
      {children}
    </PageLayout>
  );
}
