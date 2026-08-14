import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useKnowledgeGraph } from '../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../ui/SkeletonRows';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { KnowledgeGraph } from '../domains/factory/components/knowledge/KnowledgeGraph';

/**
 * The Knowledge page: a live force-directed graph of the project's knowledge —
 * entities as nodes, wikilink relationships as edges. The default view is
 * project scope (org + project records, the memories that carry across
 * sessions); thread-scoped knowledge is reached only by drilling into a
 * memory's capture session.
 */
export function KnowledgePage() {
  return <FactoryPageShell>{project => <KnowledgeContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function KnowledgeContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const graphQuery = useKnowledgeGraph(factoryProjectId);

  if (graphQuery.isError) {
    const message =
      graphQuery.error instanceof Error ? graphQuery.error.message : 'Unable to load the knowledge graph.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  if (graphQuery.isPending) {
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Knowledge graph">
        <SkeletonRows label="Loading knowledge graph" rows={6} />
      </section>
    );
  }

  const graph = graphQuery.data;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 pt-2" aria-label="Knowledge graph">
      <header className="shrink-0">
        <Txt as="h1" variant="header-md" className="font-semibold text-icon6">
          Knowledge Graph
        </Txt>
        <Txt as="p" variant="ui-md" className="mt-1 text-icon3">
          Explore entities and the relationships captured by the agent over time.
        </Txt>
      </header>
      {graph.nodes.length === 0 ? (
        <Txt as="p" variant="ui-md" className="text-icon3">
          No knowledge captured yet — the graph fills in as factory sessions work.
        </Txt>
      ) : (
        <div className="min-h-0 flex-1" data-testid="knowledge-graph-container">
          <KnowledgeGraph payload={graph} />
        </div>
      )}
    </section>
  );
}
