import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { ConnectorLink } from '@/domains/knowledge-importers/components/connector-link';
import { ImporterDetail } from '@/domains/knowledge-importers/components/importer-detail';
import { ImporterList } from '@/domains/knowledge-importers/components/importer-list';
import { useImporterSummaries } from '@/domains/knowledge-importers/use-knowledge-importers';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/knowledge'), navCrumb('/knowledge/importers')];

function Shell({ children, fit = false }: { children: React.ReactNode; fit?: boolean }) {
  return (
    <PageLayout variant={fit ? 'fit' : 'container'} breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Knowledge importers</h1>
      {children}
    </PageLayout>
  );
}

export default function KnowledgeImportersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const summaries = useImporterSummaries();

  if (summaries.error) {
    const error = summaries.error;
    return (
      <Shell>
        {is401UnauthorizedError(error) ? (
          <SessionExpired variant="fill" />
        ) : is403ForbiddenError(error) ? (
          <PermissionDenied variant="fill" resource="knowledge" />
        ) : is404NotFoundError(error) ? (
          <EmptyState
            variant="fill"
            titleSlot="No importers on this server"
            descriptionSlot="This Mastra server doesn't expose the knowledge importers routes."
          />
        ) : (
          <EmptyState
            tone="error"
            variant="fill"
            titleSlot="Failed to load importers"
            descriptionSlot={error.message}
          />
        )}
      </Shell>
    );
  }

  if (summaries.isPending) {
    return (
      <Shell>
        <div className="flex flex-col gap-2 p-4" role="status" aria-label="Loading importers">
          <SkeletonText />
          <SkeletonText />
          <SkeletonText />
        </div>
      </Shell>
    );
  }

  if (summaries.data.length === 0) {
    return (
      <Shell>
        <EmptyState
          variant="fill"
          titleSlot="No connectors are linked to this project yet."
          actionSlot={<ConnectorLink />}
        />
      </Shell>
    );
  }

  const requested = searchParams.get('importer');
  const selected = summaries.data.find(summary => summary.key === requested) ?? summaries.data[0];

  const select = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('importer', key);
    setSearchParams(next);
  };

  return (
    <Shell fit>
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-[18rem_minmax(0,1fr)] md:overflow-hidden">
        <aside className="px-3 pt-4 md:min-h-0 md:overflow-y-auto md:border-r md:border-border">
          <ImporterList summaries={summaries.data} selectedKey={selected.key} onSelect={select} />
        </aside>
        <div className="px-4 pt-4 md:min-h-0 md:overflow-y-auto">
          <div className="mx-auto flex max-w-4xl flex-col pb-6">
            <ImporterDetail key={selected.key} summary={selected} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
