import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId, useState } from 'react';

import type { WorkItem } from '../services/workItems';
import { SourceDescriptionLoading, useSourceDescription } from './BoardCardDetails';
import { DescriptionMarkdown } from './DescriptionMarkdown';

// Keyword heights only animate where `calc-size` exists; elsewhere a plain cap clamps without the glide.
const clampedClass =
  'max-h-18 supports-[height:calc-size(auto,size)]:max-h-none supports-[height:calc-size(auto,size)]:h-[calc-size(auto,min(size,--spacing(18)))]';

function watchClamp(content: HTMLDivElement) {
  const box = content.parentElement;
  const description = box?.parentElement;
  if (!box || !description) return;
  const observer = new ResizeObserver(() => {
    if (description.hasAttribute('data-expanded')) return;
    description.toggleAttribute('data-clamped', content.offsetHeight > box.clientHeight + 1);
  });
  observer.observe(content);
  return () => observer.disconnect();
}

export function CardDescription({
  item,
  projectRepositoryId,
  factoryId,
  repositoryFailed,
}: {
  item: WorkItem;
  projectRepositoryId: string | undefined;
  factoryId: string | undefined;
  repositoryFailed: boolean;
}) {
  const query = useSourceDescription(item, projectRepositoryId, factoryId);
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  if (query?.isLoading) return <SourceDescriptionLoading />;
  const failed = query !== undefined && (query.isError || (repositoryFailed && query.data === undefined));
  const source = query?.data?.description?.trim() || undefined;
  const own = item.description?.trim() || undefined;
  if (!source && !own) {
    return failed ? (
      <Txt variant="meta" tone="muted" className="m-0 px-2">
        The description could not be loaded.
      </Txt>
    ) : null;
  }

  return (
    <div className="group/description flex flex-col items-start gap-0.5" data-expanded={expanded || undefined}>
      <div
        id={id}
        className={cn(
          'w-full overflow-hidden px-2 [interpolate-size:allow-keywords]',
          'motion-safe:transition-[height] motion-safe:duration-(--duration-slow) motion-safe:ease-(--resize-ease)',
          expanded ? 'h-auto' : cn(clampedClass, 'group-data-clamped/description:mask-b-from-30%'),
        )}
      >
        <div ref={watchClamp} className="flex flex-col gap-2">
          {source ? <DescriptionMarkdown titleLevel="h2">{source}</DescriptionMarkdown> : null}
          {failed ? (
            <Txt variant="meta" tone="muted" className="m-0">
              The description could not be loaded.
            </Txt>
          ) : null}
          {own ? (
            <div className="flex flex-col gap-1">
              {source ? (
                <Txt as="h3" variant="meta" tone="muted" className="m-0">
                  Added in Factory
                </Txt>
              ) : null}
              <DescriptionMarkdown titleLevel={source ? 'h3' : 'h2'}>{own}</DescriptionMarkdown>
            </div>
          ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="hidden group-data-clamped/description:inline-flex"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </Button>
    </div>
  );
}
