import * as React from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconCircleBanSign } from '@/ds/icons/central/IconCircleBanSign';
import { IconCircleX } from '@/ds/icons/central/IconCircleX';
import { cn } from '@/lib/utils';

type EmptyStateTone = 'default' | 'error';

const defaultIconByTone: Record<EmptyStateTone, React.ReactNode> = {
  default: <IconCircleBanSign />,
  error: <IconCircleX />,
};

const iconColorByTone: Record<EmptyStateTone, string> = {
  default: 'text-muted-foreground',
  error: 'text-destructive-foreground',
};

export type EmptyStateProps = {
  /** Defaults to the tone's icon. A bare icon renders at 20px; pass `<EmptyStateIllustration />` for artwork. Pass `null` to render no icon. */
  iconSlot?: React.ReactNode;
  titleSlot: React.ReactNode;
  descriptionSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Colors the icon or illustration; an icon with its own text color keeps it. */
  tone?: EmptyStateTone;
  /**
   * `inline` (default) renders the block in place.
   * `fill` centers it in the full height of its parent — the parent must have a definite height.
   */
  variant?: 'inline' | 'fill';
  layout?: 'stacked' | 'split';
};

export function EmptyState({
  tone = 'default',
  iconSlot = defaultIconByTone[tone],
  titleSlot,
  descriptionSlot,
  actionSlot,
  statusSlot,
  className,
  as: HeadingTag = 'h3',
  variant = 'inline',
  layout = 'stacked',
}: EmptyStateProps) {
  const split = layout === 'split';
  const text = (
    <>
      <HeadingTag className={cn('text-foreground', split ? 'text-heading' : 'text-subheading')}>{titleSlot}</HeadingTag>
      {descriptionSlot && (
        <Txt variant={split ? 'body' : 'caption'} tone="muted" className="mt-1.5 max-w-md wrap-anywhere">
          {descriptionSlot}
        </Txt>
      )}
      {actionSlot && <div className={cn('max-w-full', split ? 'mt-6' : 'mt-4')}>{actionSlot}</div>}
      {statusSlot && (
        <Txt as="p" variant="caption" tone="muted" className="mt-2 flex max-w-full items-center gap-2">
          {statusSlot}
        </Txt>
      )}
    </>
  );

  const content = (
    <div
      data-slot="empty-state"
      data-tone={tone}
      data-layout={layout}
      className={cn(
        'group/empty-state flex max-w-full px-4 py-6',
        split ? '@container w-full justify-center' : 'flex-col items-center justify-center text-center',
        'transition-opacity duration-normal ease-out-custom',
        className,
      )}
    >
      {split ? (
        <div className="flex flex-col-reverse items-center gap-6 text-center @2xl:flex-row @2xl:gap-12 @2xl:text-left">
          <div className="flex w-80 max-w-full flex-col items-center @2xl:items-start">{text}</div>
          {iconSlot && (
            <div
              data-slot="empty-state-art-slot"
              className={cn(
                'flex h-60 w-52 max-w-full shrink-0 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full',
                iconColorByTone[tone],
              )}
            >
              {iconSlot}
            </div>
          )}
        </div>
      ) : (
        <>
          {iconSlot && (
            <div className={cn('mb-3 max-w-full [&>svg]:size-icon-lg', iconColorByTone[tone])}>{iconSlot}</div>
          )}
          {text}
        </>
      )}
    </div>
  );

  if (variant === 'fill') {
    return (
      <div data-slot="empty-state-fill" className="flex h-full items-center-safe justify-center-safe">
        {content}
      </div>
    );
  }

  return content;
}
