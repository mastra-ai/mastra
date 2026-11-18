import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { SOURCE_LABELS, cardLabels, sourceMetadata } from '../boardItems';
import { workItemReference } from '../services/relationships';
import { sourceState } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';
import { MetadataLabels } from './BoardCardParts';
import { outboundArrowClass } from './ChangeRequestLink';
import { SourceStateBadge } from './SourceStateBadge';

const sourceRowClass = 'flex min-w-0 flex-col gap-1';
const referenceRowClass = 'flex min-w-0 items-center gap-1.5';
const labelsRowClass = 'px-2';
const PLACEHOLDER_LABELS = ['w-16', 'w-20', 'w-24'];

export function CardSourceRowSkeleton() {
  return (
    <div aria-hidden className={sourceRowClass}>
      <div className={referenceRowClass}>
        <Skeleton className="h-control-sm w-28 rounded-full motion-reduce:before:animate-none" />
      </div>
      <div className={labelsRowClass}>
        <div className="flex items-center gap-1.5">
          {PLACEHOLDER_LABELS.map(width => (
            <Skeleton key={width} className={cn('h-5 rounded-full motion-reduce:before:animate-none', width)} />
          ))}
        </div>
      </div>
    </div>
  );
}

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

  const reference = workItemReference(item, repository) ?? SOURCE_LABELS[item.source];
  return (
    <div className={sourceRowClass}>
      {url || state ? (
        <div className={referenceRowClass}>
          {url ? (
            <Button
              render={<a href={url} target="_blank" rel="noreferrer" />}
              variant="ghost"
              size="sm"
              className="group/outbound min-w-0"
              aria-label={`Open ${reference}`}
            >
              <span className="truncate">{reference}</span>
              <IconArrowUpRight aria-hidden className={outboundArrowClass} />
            </Button>
          ) : null}
          <SourceStateBadge item={item} />
        </div>
      ) : null}
      {labelled ? (
        <div className={labelsRowClass}>
          <MetadataLabels metadata={metadata} />
        </div>
      ) : null}
    </div>
  );
}
