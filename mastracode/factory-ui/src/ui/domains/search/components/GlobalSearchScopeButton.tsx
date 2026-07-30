import type { ReactNode } from 'react';

export function GlobalSearchScopeButton({
  icon,
  label,
  count,
  active,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="text-ui-smd leading-ui-sm text-neutral3 hover:border-border1 hover:bg-surface4 hover:text-neutral6 data-[active=true]:border-border1 data-[active=true]:bg-surface4 data-[active=true]:text-neutral6 flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2.5 text-left transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.99]"
      data-active={active}
      aria-pressed={active}
      onClick={onSelect}
    >
      <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="border-border1 bg-surface4/70 text-neutral3 rounded-md border px-1.5 py-0.5 text-[10px] leading-none">
        {count}
      </span>
    </button>
  );
}
