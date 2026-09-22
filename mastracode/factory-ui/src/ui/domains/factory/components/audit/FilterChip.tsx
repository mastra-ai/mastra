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
        'text-meta focus-visible:ring-accent1 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold outline-none transition-colors focus-visible:ring-1',
        pressed
          ? 'bg-fill-active text-foreground'
          : 'text-neutral3 hover:bg-fill hover:text-neutral5 focus-visible:bg-fill focus-visible:text-neutral5',
      )}
    >
      {dotClass ? <span aria-hidden="true" className={cn('size-1.5 rounded-full', dotClass)} /> : null}
      {label}
    </button>
  );
}
