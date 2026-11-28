import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

/** A channel's name, linking to the channel in its app when there is a link. Long names truncate, like knowledge links. */
export function ChannelName({ name, url }: { name: string; url?: string }) {
  if (!url) return <span className="max-w-full min-w-0 truncate text-foreground">{name}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm text-foreground underline-offset-2 hover:underline',
        focusRing,
      )}
    >
      <span className="truncate">{name}</span>
      <IconSquareArrowTopRight aria-hidden="true" className="size-icon-xs shrink-0" />
    </a>
  );
}
