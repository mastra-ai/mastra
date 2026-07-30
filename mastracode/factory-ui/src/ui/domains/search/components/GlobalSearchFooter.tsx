import { Kbd } from '@mastra/playground-ui/components/Kbd';

export function GlobalSearchFooter() {
  return (
    <div className="global-search-footer text-ui-xs text-neutral3 pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 px-4 pt-5 pb-2">
      <span className="truncate">Factory search</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Kbd className="min-w-5 px-1 text-[10px]">↑</Kbd>
        <Kbd className="min-w-5 px-1 text-[10px]">↓</Kbd>
        <Kbd className="min-w-5 px-1 text-[10px]">↵</Kbd>
        <Kbd className="min-w-5 px-1 text-[10px]">Esc</Kbd>
      </span>
    </div>
  );
}
