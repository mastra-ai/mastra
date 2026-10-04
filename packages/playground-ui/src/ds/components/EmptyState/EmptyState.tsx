import { CircleSlashIcon, CircleXIcon } from 'lucide-react';
import * as React from 'react';
import { EmptyStateIllustration } from './empty-state-illustration';
import type { EmptyStateIllustrationName } from './empty-state-illustration';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type EmptyStateTone = 'default' | 'error';

const defaultIconByTone: Record<EmptyStateTone, React.ReactNode> = {
  default: <CircleSlashIcon />,
  error: <CircleXIcon />,
};

const iconColorByTone: Record<EmptyStateTone, string> = {
  default: 'text-muted-foreground',
  error: 'text-destructive-foreground',
};

const illustrationColorByTone: Record<EmptyStateTone, string> = {
  default: 'text-foreground',
  error: 'text-destructive-indicator',
};

type EmptyStateMedia =
  | {
      /** Defaults to the tone's icon, always rendered at 20px. Pass `null` to render no icon. */
      iconSlot?: React.ReactNode;
      illustration?: never;
    }
  | {
      iconSlot?: never;
      illustration: EmptyStateIllustrationName;
    };

export type EmptyStateProps = EmptyStateMedia & {
  titleSlot: React.ReactNode;
  descriptionSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  /** Colors the icon or illustration; an icon with its own text color keeps it. */
  tone?: EmptyStateTone;
  /**
   * `inline` (default) renders the block in place.
   * `fill` centers it in the full height of its parent — the parent must have a definite height.
   */
  variant?: 'inline' | 'fill';
};

export function EmptyState({
  tone = 'default',
  iconSlot = defaultIconByTone[tone],
  illustration,
  titleSlot,
  descriptionSlot,
  actionSlot,
  className,
  as: HeadingTag = 'h3',
  variant = 'inline',
}: EmptyStateProps) {
  const illustrated = illustration !== undefined;

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-6 text-center',
        'transition-opacity duration-normal ease-out-custom',
        className,
      )}
    >
      {illustrated ? (
        <div className={cn('group/illustration mb-8', illustrationColorByTone[tone])}>
          <EmptyStateIllustration name={illustration} />
        </div>
      ) : (
        iconSlot && <div className={cn('mb-3 [&_svg]:size-5', iconColorByTone[tone])}>{iconSlot}</div>
      )}
      <HeadingTag className="text-subheading text-foreground">{titleSlot}</HeadingTag>
      {descriptionSlot && (
        <Txt variant="caption" tone="muted" className={cn('max-w-md wrap-anywhere', illustrated ? 'mt-0.5' : 'mt-1.5')}>
          {descriptionSlot}
        </Txt>
      )}
      {actionSlot && <div className={illustrated ? 'mt-5' : 'mt-4'}>{actionSlot}</div>}
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
