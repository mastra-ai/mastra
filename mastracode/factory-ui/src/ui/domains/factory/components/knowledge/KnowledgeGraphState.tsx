import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import type { useKnowledgeGraph } from '../../../../../hooks/useKnowledgeGraph';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import type { KnowledgeGraphPayload } from '../../services/knowledge';
import { RequestError } from '../../services/request';

export function KnowledgeGraphState({
  query,
  threadId,
  onBackToProject,
  children,
}: {
  query: ReturnType<typeof useKnowledgeGraph>;
  threadId?: string;
  onBackToProject: () => void;
  children: (payload: KnowledgeGraphPayload) => ReactNode;
}) {
  if (query.isError) {
    if (threadId && query.error instanceof RequestError && query.error.status === 404) {
      return (
        <div data-testid="knowledge-thread-gone" className="flex flex-col items-start gap-2 p-8">
          <Txt tone="muted" as="p" variant="body">
            This session's knowledge is no longer available.
          </Txt>
          <button type="button" className="text-badge-purple-indicator hover:underline" onClick={onBackToProject}>
            <Txt as="span" variant="body">
              Back to the project view
            </Txt>
          </button>
        </div>
      );
    }
    const message = query.error instanceof Error ? query.error.message : 'Unable to load the knowledge graph.';
    return (
      <div className="p-4">
        <Notice variant="destructive">{message}</Notice>
      </div>
    );
  }
  if (query.isPending)
    return (
      <div className="p-4">
        <SkeletonRows label="Loading knowledge graph" rows={6} />
      </div>
    );
  if (query.data.nodes.length === 0)
    return (
      <div className="p-8">
        <Txt tone="muted" as="p" variant="body">
          No knowledge captured yet — the graph fills in as factory sessions work.
        </Txt>
      </div>
    );
  return children(query.data);
}
