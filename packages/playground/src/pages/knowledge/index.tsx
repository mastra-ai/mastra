import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
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
  useStudioKnowledgeDataSource,
} from '@/domains/knowledge/use-studio-knowledge';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/knowledge')];

/** Scope tags are typed as `ns:value` words separated by spaces or commas. */
function parseScopeInput(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))];
}

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
  const keyParam = searchParams.get('instance') ?? undefined;
  const scope = searchParams.getAll('scope');
  const knowledgeKey = keyParam ?? instances.data?.[0]?.key;
  const [scopeText, setScopeText] = useState(scope.join(' '));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const dataSource = useStudioKnowledgeDataSource(knowledgeKey, scope);
  const graph = useKnowledgeGraph(knowledgeKey, scope);

  const error = instances.error ?? graph.error;
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

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.delete('scope');
    for (const tag of parseScopeInput(scopeText)) next.append('scope', tag);
    setSelectedNodeId(null);
    setSearchParams(next);
  };

  return (
    <Shell>
      <KnowledgeDataSourceProvider value={dataSource}>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <form onSubmit={apply} className="flex flex-wrap items-center gap-2">
            {instances.data && instances.data.length > 1 ? (
              <select
                aria-label="Knowledge instance"
                className="h-8 rounded border border-border bg-card px-2 text-body"
                value={knowledgeKey}
                onChange={event => {
                  const next = new URLSearchParams(searchParams);
                  next.set('instance', event.target.value);
                  setSelectedNodeId(null);
                  setSearchParams(next);
                }}
              >
                {instances.data.map(instance => (
                  <option key={instance.key} value={instance.key}>
                    {instance.key}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              aria-label="Scope tags"
              placeholder="Scope tags, e.g. org:acme project:web"
              className="h-8 min-w-72 flex-1 rounded border border-border bg-card px-2 text-body"
              value={scopeText}
              onChange={event => setScopeText(event.target.value)}
            />
            <Button type="submit" size="sm">
              View
            </Button>
            {scope.length > 0 ? <KnowledgeSearch onSelect={result => setSelectedNodeId(result.id)} /> : null}
          </form>

          {scope.length === 0 ? (
            <EmptyState
              variant="fill"
              titleSlot="Choose a scope"
              descriptionSlot="Knowledge shows a record only when every one of its scope tags is in the set you enter. Enter the tags of the view you want to browse."
            />
          ) : graph.isPending ? (
            <p className="p-4 text-body text-muted-foreground">Loading knowledge…</p>
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
