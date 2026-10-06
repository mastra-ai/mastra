import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { GitBranch } from 'lucide-react';
import { Link } from 'react-router';

import { PANEL } from './panel';

export function PipelineEmptyState({
  hasWorkItems,
  rangeDays,
  factoryProjectId,
}: {
  hasWorkItems: boolean;
  rangeDays: number;
  factoryProjectId: string | undefined;
}) {
  return (
    <div className={`${PANEL} flex min-h-64 items-center justify-center`}>
      <EmptyState
        iconSlot={<GitBranch aria-hidden />}
        titleSlot={hasWorkItems ? `No new work in the last ${rangeDays} days` : 'Your pipeline starts here'}
        descriptionSlot={
          hasWorkItems
            ? 'The graph shows work created in this date range that the Factory has run. Try a wider range, or open the board to start new work.'
            : 'Once the Factory starts work on an item, this graph will show its progress through the pipeline. Open the board to get started.'
        }
        actionSlot={
          factoryProjectId ? (
            <Button size="sm" render={<Link to={`/factories/${factoryProjectId}/work`} />}>
              Open board
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
