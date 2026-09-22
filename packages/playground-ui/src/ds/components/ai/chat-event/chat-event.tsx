import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useArriving } from '@/ds/components/Arrival';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Txt } from '@/ds/components/Txt';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export interface ChatEventProps {
  density?: 'row' | 'card';
  icon: ReactNode;
  label: string;
  detail?: string;
  detailFont?: 'mono' | 'sans';
  badges?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  'aria-label': string;
  'data-signal-kind'?: string;
  'data-notification-state'?: string;
  'data-skill-name'?: string;
}

function RowDetail({ children, font, wraps }: { children: string; font: 'mono' | 'sans'; wraps: boolean }) {
  const arriving = useArriving();
  return (
    <Txt
      as="span"
      variant="meta"
      tone="muted"
      font={font === 'mono' ? 'mono' : undefined}
      className={cn('min-w-0', wraps ? 'break-words' : 'truncate', arriving)}
    >
      {children}
    </Txt>
  );
}

export function ChatEvent({
  density = 'row',
  icon,
  label,
  detail,
  detailFont = 'mono',
  badges,
  children,
  collapsible = density === 'row',
  defaultOpen,
  ...props
}: ChatEventProps) {
  const folds = Boolean(collapsible && children);

  if (density === 'card') {
    const header = (
      <div className="flex w-full items-start gap-3 text-left">
        <span className="text-muted-foreground mt-0.5 flex size-4 shrink-0 items-center justify-center">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Txt variant="column" tone="ink">
              {label}
            </Txt>
            {badges}
          </div>
          {detail && (
            <Txt variant="meta" tone="muted" className="mt-1 break-all">
              {detail}
            </Txt>
          )}
          {!folds && children && <div className="mt-2">{children}</div>}
        </div>
        {folds && (
          <ChevronRight
            aria-hidden
            className="text-muted-foreground size-4 shrink-0 group-data-[panel-open]/event:rotate-90 motion-safe:transition-transform"
          />
        )}
      </div>
    );

    const card = cn(raisedSurfaceStyle, 'text-foreground overflow-hidden rounded-lg');

    if (!folds) {
      return (
        <div className={cn(card, 'px-4 py-3')} role="group" {...props}>
          {header}
        </div>
      );
    }

    return (
      <Collapsible defaultOpen={defaultOpen} className={card} role="group" {...props}>
        <CollapsibleTrigger className="group/event state-layer w-full cursor-pointer px-4 py-3">
          {header}
        </CollapsibleTrigger>
        <CollapsibleContent className="border-border border-t px-4 py-3">{children}</CollapsibleContent>
      </Collapsible>
    );
  }

  const header = (
    <span className="flex w-full min-w-0 items-center gap-2 px-1.5 py-1">
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <Txt as="span" variant="caption" tone="muted" className="max-w-[55%] shrink-0 truncate">
        {label}
      </Txt>
      {badges}
      {detail && (
        <RowDetail font={detailFont} wraps={!folds}>
          {detail}
        </RowDetail>
      )}
      <span aria-hidden className="min-w-2 flex-1" />
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
        {folds && (
          <span className="text-muted-foreground/60 group-hover/event:text-muted-foreground group-focus-visible/event:text-muted-foreground group-data-[panel-open]/event:text-muted-foreground flex group-data-[panel-open]/event:rotate-90 motion-safe:transition motion-safe:duration-150">
            <ChevronRight size={13} />
          </span>
        )}
      </span>
    </span>
  );

  if (!folds) {
    return (
      <div className="max-w-full min-w-0" role="group" {...props}>
        {header}
        {children && <div className="ml-[14px] max-w-full min-w-0 py-1.5 pr-1 pl-4">{children}</div>}
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="max-w-full min-w-0" role="group" {...props}>
      <CollapsibleTrigger className="group/event hover:bg-fill-subtle w-full cursor-pointer rounded-md text-left motion-safe:transition-colors">
        {header}
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className="before:bg-border relative ml-[14px] max-w-full min-w-0 py-1.5 pr-1 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-px before:mask-b-from-[calc(100%-min(40%,80px))] before:content-['']">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
