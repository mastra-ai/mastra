import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { KnowledgeFlyout } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeFlyout';
import { KnowledgeGraph } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeGraph';
import { KnowledgeSearch } from '@mastra/playground-ui/domains/knowledge/components/KnowledgeSearch';
import { KnowledgeDataSourceProvider } from '@mastra/playground-ui/domains/knowledge/data-source-provider';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import {
  useKnowledgeGraph,
  useKnowledgeInstances,
  useKnowledgeScopes,
  useStudioKnowledgeDataSource,
} from '@/domains/knowledge/use-studio-knowledge';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/knowledge')];
const ALL_SCOPES = '__all__';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Knowledge</h1>
      {children}
    </PageLayout>
  );
}

export default function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const instances = useKnowledgeInstances();
  const knowledgeKey = searchParams.get('instance') ?? instances.data?.[0]?.key;
  const scopeNodeId = searchParams.get('scope') ?? undefined;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const dataSource = useStudioKnowledgeDataSource(knowledgeKey, scopeNodeId);
  const scopes = useKnowledgeScopes(knowledgeKey);
  const graph = useKnowledgeGraph(knowledgeKey, scopeNodeId);

  const error = instances.error ?? scopes.error ?? graph.error;
  if (error && is401UnauthorizedError(error)) {
    return (
      <Shell>
        <SessionExpired variant="fill" />
      </Shell>
    );
  }
  if (error && is403ForbiddenError(error)) {
    return (
      <Shell>
        <PermissionDenied variant="fill" resource="knowledge" />
      </Shell>
    );
  }
  if (instances.error) {
    return (
      <Shell>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load Knowledge"
          descriptionSlot={instances.error.message}
        />
      </Shell>
    );
  }
  if (instances.data && instances.data.length === 0) {
    return (
      <Shell>
        <EmptyState
          variant="fill"
          titleSlot="No Knowledge instances"
          descriptionSlot="Register one on your Mastra instance with the `knowledge` option to browse it here."
        />
      </Shell>
    );
  }

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'instance') next.delete('scope');
    setSelectedNodeId(null);
    setSearchParams(next);
  };

  return (
    <Shell>
      <KnowledgeDataSourceProvider value={dataSource}>
        <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {instances.data && instances.data.length > 1 ? (
              <Select value={knowledgeKey} onValueChange={value => setParam('instance', value)}>
                <SelectTrigger aria-label="Knowledge instance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {instances.data.map(instance => (
                    <SelectItem key={instance.key} value={instance.key}>
                      {instance.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={scopeNodeId ?? ALL_SCOPES}
              onValueChange={value => setParam('scope', value === ALL_SCOPES ? undefined : value)}
            >
              <SelectTrigger aria-label="Scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SCOPES}>All scopes</SelectItem>
                {(scopes.data?.scopes ?? []).map(scope => (
                  <SelectItem key={scope.id} value={scope.id}>
                    {`${scope.name} (${scope.address})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <KnowledgeSearch onSelect={result => setSelectedNodeId(result.id)} />
          </div>

          {graph.isPending ? (
            <p className="text-ui-md text-neutral3 p-4">Loading knowledge…</p>
          ) : graph.isError ? (
            <EmptyState
              tone="error"
              variant="fill"
              titleSlot="Failed to load the graph"
              descriptionSlot={graph.error.message}
            />
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="relative min-h-0 min-w-0 flex-1" data-testid="knowledge-graph-container">
                <KnowledgeGraph
                  payload={graph.data}
                  showPinnedFilter={false}
                  focusedId={selectedNodeId}
                  onFocusChange={id => {
                    if (!id) setSelectedNodeId(null);
                  }}
                  onNodeClick={node => setSelectedNodeId(node.id)}
                />
              </div>
              {selectedNodeId ? (
                <KnowledgeFlyout
                  nodeId={selectedNodeId}
                  scopeLevel="org"
                  onClose={() => setSelectedNodeId(null)}
                  onNodeRef={name => {
                    const target = graph.data.nodes.find(node => node.name.toLowerCase() === name.toLowerCase());
                    if (target) setSelectedNodeId(target.id);
                  }}
                />
              ) : null}
            </div>
          )}
        </div>
      </KnowledgeDataSourceProvider>
    </Shell>
  );
}
