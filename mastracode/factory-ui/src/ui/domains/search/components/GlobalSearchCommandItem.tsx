import { CommandItem, CommandShortcut } from '@mastra/playground-ui/components/Command';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export type GlobalSearchSelectHandler = (path: string, preserveOrigin: boolean) => void;

export function GlobalSearchCommandItem({
  icon,
  title,
  context,
  value,
  shortcut,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  context: string;
  value: string;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      className="group data-[selected=true]:border-border1 data-[selected=true]:bg-surface4/80 h-auto items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-[background-color,border-color] duration-150 ease-out"
      value={value}
      onSelect={onSelect}
    >
      <span className="text-neutral3 group-data-[selected=true]:text-neutral6 mt-0.5 flex size-4 shrink-0 items-center justify-center transition-colors [&>svg]:size-4">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Txt as="span" variant="ui-sm" className="text-neutral6 truncate font-medium">
          {title}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-neutral3 leading-ui-xs truncate">
          {context}
        </Txt>
      </span>
      {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
    </CommandItem>
  );
}
