import { useId, useState } from 'react';
import type { CSSProperties } from 'react';

import { DescriptionMarkdown } from './description-markdown';
import { Button } from '@/ds/components/Button';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const CLAMP_REM = 6.25;
const clampStyle: CSSProperties & { '--clamp': string } = { '--clamp': `${CLAMP_REM}rem` };

// Keyword heights only animate where `calc-size` exists; elsewhere a plain cap clamps without the glide.
const clampedClass =
  'max-h-(--clamp) supports-[height:calc-size(auto,size)]:max-h-none supports-[height:calc-size(auto,size)]:h-[calc-size(auto,min(size,var(--clamp)))]';

/** Against the cap, not the box: the box's height animates, so measuring it would flicker the toggle. */
function markClamped(content: HTMLDivElement) {
  const observer = new ResizeObserver(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    content.toggleAttribute('data-clamped', content.offsetHeight > CLAMP_REM * rem + 1);
  });
  observer.observe(content);
  return () => observer.disconnect();
}

export function SourceDescriptionLines() {
  return (
    <div aria-hidden className="px-2">
      <SkeletonText line="text-caption" className="w-full motion-reduce:before:animate-none" />
      <SkeletonText line="text-caption" className="w-4/5 motion-reduce:before:animate-none" />
      <SkeletonText line="text-caption" className="w-2/3 motion-reduce:before:animate-none" />
    </div>
  );
}

export function SourceDescriptionLoading() {
  return (
    <div role="status" aria-label="Loading description">
      <SourceDescriptionLines />
    </div>
  );
}

export interface CardDescriptionProps {
  /** The body fetched from the card's upstream source. */
  source?: string | null;
  /** The body written on the card itself. */
  own?: string | null;
  loading?: boolean;
  /** The upstream body could not be read. */
  failed?: boolean;
  /** Names where `own` was written, shown when both bodies are present. */
  ownLabel?: string;
}

/** A card's description, clamped with a "Show more" toggle; the upstream body first, the card's own under it. */
export function CardDescription({
  source: sourceText,
  own: ownText,
  loading = false,
  failed = false,
  ownLabel = 'Added in Factory',
}: CardDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  if (loading) return <SourceDescriptionLoading />;
  const source = sourceText?.trim() || undefined;
  const own = ownText?.trim() || undefined;
  if (!source && !own) {
    return failed ? (
      <Txt variant="meta" tone="muted" className="m-0 px-2">
        The description could not be loaded.
      </Txt>
    ) : null;
  }

  return (
    <div className="group/description relative flex flex-col items-center gap-0.5" style={clampStyle}>
      <div
        id={id}
        className={cn(
          'w-full overflow-hidden px-2 [interpolate-size:allow-keywords]',
          'motion-safe:transition-[height] motion-safe:duration-(--duration-slow) motion-safe:ease-(--resize-ease)',
          expanded ? 'h-auto' : cn(clampedClass, 'has-data-clamped:mask-b-from-50%'),
        )}
      >
        <div ref={markClamped} className="flex flex-col gap-2">
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
                  {ownLabel}
                </Txt>
              ) : null}
              <DescriptionMarkdown titleLevel={source ? 'h3' : 'h2'}>{own}</DescriptionMarkdown>
            </div>
          ) : null}
        </div>
      </div>
      <Button
        variant="default"
        size="sm"
        className={cn(
          'hidden group-has-data-clamped/description:inline-flex',
          !expanded && 'absolute bottom-0 left-1/2 -translate-x-1/2',
        )}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </Button>
    </div>
  );
}
