import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';

export function FilterChip({
  label,
  dotClass,
  pressed,
  onClick,
}: {
  label: string;
  dotClass?: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'text-foreground',
        'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
        focusRing,
        pressed
          ? 'bg-fill-active'
          : 'hover:bg-fill hover:text-foreground focus-visible:bg-fill focus-visible:text-foreground',
      )}
    >
      {dotClass ? <span aria-hidden="true" className={cn('size-1.5 rounded-full', dotClass)} /> : null}
      <Txt as="span" variant="meta" className="block">
        {label}
      </Txt>
    </button>
  );
}
