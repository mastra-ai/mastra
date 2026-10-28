import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  Activity,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
} from '@mastra/playground-ui/components/ai/activity';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { TimedTrigger } from '../TimedTrigger';
import type { StretchHeader } from '../activity-header';

function outcomeText({ tools, failed, incomplete }: StretchHeader): string {
  if (tools <= 1) return incomplete ? 'incomplete' : '';
  return [failed && `${failed} failed`, incomplete && `${incomplete} incomplete`].filter(Boolean).join(' · ');
}

/** A line that folds what it summarises, opening where the reader last left it. Prominent lines read at answer size. */
export function ActivityFold({
  slot,
  header,
  view,
  foldable,
  prominent = false,
  onOpenChange,
  children,
}: {
  slot?: string;
  header: StretchHeader;
  view: { open: boolean };
  foldable: boolean;
  prominent?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(view.open);
  const outcome = outcomeText(header);

  function toggle(next: boolean) {
    view.open = next;
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <Activity
      data-slot={slot}
      appearance="inline"
      status={header.status}
      open={foldable && open}
      onOpenChange={toggle}
      foldable={foldable}
      aria-label={header.name}
    >
      <TimedTrigger at={header.startedAt} className={cn(prominent && 'mb-2 border-b border-border pb-2')}>
        <ActivityHeader>
          <ActivityIcon>
            <header.icon aria-hidden />
          </ActivityIcon>
          <ActivityLabel className={cn(prominent && 'text-body', !header.detail && 'min-w-0 shrink')}>
            {header.label}
          </ActivityLabel>
          {header.detail && (
            <ActivityDetail className={cn(prominent && 'text-body-sm')}>{header.detail}</ActivityDetail>
          )}
          {header.duration && (
            <ActivityLabel className={cn(prominent && 'text-body', '-ml-1 tabular-nums')}>
              · {header.duration}
            </ActivityLabel>
          )}
          {header.failed > 0 && (
            <X size={13} role="img" aria-label="Failed" className="shrink-0 text-destructive-foreground" />
          )}
          {outcome && (
            <Txt as="span" variant="meta" tone="muted" className="shrink-0 tabular-nums">
              {outcome}
            </Txt>
          )}
          <ActivityDisclosure />
        </ActivityHeader>
      </TimedTrigger>
      {children}
    </Activity>
  );
}
