import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';

import { useProjectPullRequestsQuery } from '../../../../shared/hooks/useFactoryData';
import { useUpdateWorkItemMutation, useWorkItemsQuery } from '../../../../shared/hooks/useWorkItems';
import { stagesAfterMove } from './boardUtils';
import { Board, LoadMoreButton } from './components/Board';
import type { BoardCard } from './components/Board';
import { FactoryPageShell } from './components/FactoryPageShell';

export function ReviewBoardPage() {
  return (
    <FactoryPageShell title="Review" description="Review active work and open pull requests before completion.">
      {factory => <ReviewBoard githubProjectId={factory.binding.githubProjectId} />}
    </FactoryPageShell>
  );
}

function ReviewBoard({ githubProjectId }: { githubProjectId: string }) {
  const items = useWorkItemsQuery(githubProjectId);
  const pulls = useProjectPullRequestsQuery(githubProjectId);
  const update = useUpdateWorkItemMutation(githubProjectId);

  if (items.isPending || pulls.isPending) return <p role="status">Loading Review board</p>;
  if (items.isError || pulls.isError) {
    const error = items.error ?? pulls.error;
    return <Notice variant="destructive">{error instanceof Error ? error.message : 'Failed to load Review'}</Notice>;
  }

  const reviewItems = (items.data ?? []).filter(item => item.stages.includes('review'));
  const knownPulls = new Set(
    (items.data ?? []).flatMap(item => item.source === 'github-pr' && typeof item.metadata.number === 'number' ? [item.metadata.number] : []),
  );
  const cards: BoardCard[] = [
    ...reviewItems.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url ?? undefined,
      meta: item.source.replaceAll('-', ' '),
      action: <Button size="sm" onClick={() => update.mutate({ id: item.id, patch: { stages: stagesAfterMove(item.stages, 'review', 'done') } })}>Mark done</Button>,
    })),
    ...(pulls.data ?? []).filter(pull => !knownPulls.has(pull.number)).map(pull => ({
      id: `github-pr:${pull.number}`,
      title: pull.title,
      url: pull.url,
      meta: `#${pull.number}${pull.author ? ` · ${pull.author}` : ''}`,
    })),
  ];

  return (
    <Board
      error={update.error instanceof Error ? update.error.message : undefined}
      columns={[{
        id: 'review',
        title: 'Review',
        cards,
        emptyLabel: 'Nothing is waiting for review.',
        footer: pulls.hasNextPage ? <LoadMoreButton onClick={() => void pulls.fetchNextPage()} pending={pulls.isFetchingNextPage} /> : undefined,
      }]}
    />
  );
}
