import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

export function MobilePageActions({ children }: { children: ReactNode }) {
  // Keep gated actions mounted inside this group so an empty group can hide its trigger.
  const [container] = useState(() => document.createElement('div'));
  return (
    <Popover>
      <div
        className="contents [&:not(:has([data-slot=popover-content]_:is(button,a)))>button]:hidden"
        ref={node => {
          if (node) node.appendChild(container);
        }}
      >
        <PopoverTrigger variant="ghost" size="icon-md" aria-label="Page actions" className="size-10 shrink-0">
          <Ellipsis />
        </PopoverTrigger>
        <PopoverContent
          container={container}
          keepMounted
          align="end"
          aria-label="Page actions"
          className="flex w-auto max-w-[calc(100vw-1rem)] flex-wrap items-center gap-2 p-2"
        >
          {children}
        </PopoverContent>
      </div>
    </Popover>
  );
}
