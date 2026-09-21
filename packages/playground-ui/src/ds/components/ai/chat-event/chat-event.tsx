import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useArriving } from '@/ds/components/Arrival';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

interface ChatEventProps {
  label: string;
  detail?: string;
  icon: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  'aria-label': string;
  'data-signal-kind'?: string;
  'data-notification-state'?: string;
  'data-skill-name'?: string;
}

function ChatEventDetail({ children }: { children: string }) {
  const arriving = useArriving();
  return (
    <Txt as="span" variant="meta" font="mono" className={cn('text-icon3 min-w-0 truncate', arriving)}>
      {children}
    </Txt>
  );
}

export function ChatEvent({ label, detail, icon, children, defaultOpen, ...props }: ChatEventProps) {
  const header = (
    <span className="flex w-full min-w-0 items-center gap-2 px-1.5 py-1">
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <Txt as="span" variant="caption" className="text-icon3 max-w-[55%] shrink-0 truncate">
        {label}
      </Txt>
      {detail && <ChatEventDetail>{detail}</ChatEventDetail>}
      <span aria-hidden className="min-w-2 flex-1" />
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
        {children && (
          <span className="text-icon3 flex opacity-0 group-hover/event:opacity-100 group-focus-visible/event:opacity-100 group-data-[panel-open]/event:rotate-90 group-data-[panel-open]/event:opacity-100 motion-safe:transition motion-safe:duration-150">
            <ChevronRight size={13} />
          </span>
        )}
      </span>
    </span>
  );

  if (!children) {
    return (
      <div className="max-w-full min-w-0" role="group" {...props}>
        {header}
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="max-w-full min-w-0" role="group" {...props}>
      <CollapsibleTrigger className="group/event hover:bg-neutral6/5 w-full cursor-pointer rounded-md text-left motion-safe:transition-colors">
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className="before:bg-border1 relative ml-[14px] max-w-full min-w-0 py-1.5 pr-1 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-px before:mask-b-from-[calc(100%-min(40%,80px))] before:content-['']">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
