import { ChevronDownIcon } from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import type { DropdownMenuRadioOption } from '@/ds/components/DropdownMenu';
import { cn } from '@/lib/utils';

export type MetricsCardTitleMenuProps<V extends string> = {
  /** The card title for the picked view (e.g. "Spend by model"). */
  title: string;
  value: V;
  onValueChange: (value: V) => void;
  /** The views (e.g. "By model", "By provider"). */
  options: readonly DropdownMenuRadioOption<V>[];
  className?: string;
};

/**
 * A card title that switches the card's view, as on Vercel's usage cards: the title is the
 * trigger, with a chevron. The hover fill bleeds past the text so the title stays aligned.
 */
export function MetricsCardTitleMenu<V extends string>({
  title,
  value,
  onValueChange,
  options,
  className,
}: MetricsCardTitleMenuProps<V>) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            className={cn(
              '-mx-1.5 -my-0.5 flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-left text-body font-medium text-foreground hover:bg-fill-subtle',
              className,
            )}
          />
        }
      >
        {title}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioOptions options={options} value={value} onValueChange={onValueChange} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
