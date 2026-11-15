import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';

import { cardLabels, sourceMetadata } from '../boardItems';
import { workItemReferenceLabel } from '../services/relationships';
import { sourceState } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';
import { MetadataLabels } from './BoardCardParts';
import { SourceStateBadge } from './SourceStateBadge';

export function CardSourceRow({
  item,
  url,
  repository,
}: {
  item: WorkItem;
  url: string | undefined;
  repository: string | undefined;
}) {
  const metadata = sourceMetadata(item);
  const state = sourceState(item);
  const labelled = cardLabels(metadata).length > 0;
  if (!url && !state && !labelled) return null;

  const reference = workItemReferenceLabel(item, repository);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {url || state ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {url ? (
            <Button
              render={<a href={url} target="_blank" rel="noreferrer" />}
              variant="ghost"
              size="sm"
              className="min-w-0"
              aria-label={`Open ${reference}`}
            >
              <span className="truncate">{reference}</span>
              <IconArrowUpRight aria-hidden />
            </Button>
          ) : null}
          <SourceStateBadge item={item} />
        </div>
      ) : null}
      {labelled ? (
        <div className="px-2">
          <MetadataLabels metadata={metadata} />
        </div>
      ) : null}
    </div>
  );
}
