import type { ObjectWrapperProps } from '@autoform/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Braces, ChevronRight } from 'lucide-react';

export function ObjectWrapper({ label, children }: ObjectWrapperProps) {
  if (label === '\u200B' || label === '') return <div className="flex flex-col gap-2">{children}</div>;

  return (
    <Collapsible className="motion-reduce:[&_[data-slot=collapsible-content]]:transition-none motion-reduce:[&_svg]:transition-none">
      <CollapsibleTrigger className="text-ui-sm text-neutral3 flex min-h-11 w-full items-center gap-2 text-left">
        <ChevronRight aria-hidden className="size-3.5 shrink-0" />
        <span className="flex min-w-0 items-center gap-1.5">
          <Braces aria-hidden className="size-3.5" />
          {label}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="border-border1 border-l pt-2 pl-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
