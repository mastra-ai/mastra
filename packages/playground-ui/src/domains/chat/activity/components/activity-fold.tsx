import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ActivityCall } from '../model/activity-members';
import { callsOutcome, liveWords, outcomeText, settledWords, wordsName } from '../model/activity-words';
import { ActivityTimedTrigger } from './activity-timed-trigger';
import {
  Activity,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
} from '@/ds/components/ai/activity';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ActivityFoldProps {
  calls: readonly ActivityCall[];
  live: boolean;
  elapsedMs?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foldable: boolean;
  /** Reads at answer size, ruled off from what it folds. */
  prominent?: boolean;
  slot?: string;
  children: ReactNode;
}

function foldStatus(live: boolean, failed: boolean): ActivityStatus {
  if (live) return 'running';
  return failed ? 'error' : 'idle';
}

/** A line that says what its calls are doing, or did, and folds what it summarises. */
export function ActivityFold({
  calls,
  live,
  elapsedMs,
  open,
  onOpenChange,
  foldable,
  prominent = false,
  slot,
  children,
}: ActivityFoldProps) {
  const words = live ? liveWords(calls) : settledWords(calls, elapsedMs);
  const outcome = callsOutcome(calls);
  const failed = !live && outcome.failed > 0;
  const outcomeLabel = live ? '' : outcomeText(outcome, calls.length);

  return (
    <Activity
      data-slot={slot}
      appearance="inline"
      status={foldStatus(live, failed)}
      open={foldable && open}
      onOpenChange={onOpenChange}
      foldable={foldable}
      aria-label={wordsName(words)}
    >
      <ActivityTimedTrigger at={calls[0]?.startedAt} className={cn(prominent && 'mb-2 border-b border-border pb-2')}>
        <ActivityHeader>
          <ActivityIcon>
            <words.icon aria-hidden />
          </ActivityIcon>
          <ActivityLabel className={cn(prominent && 'text-body', !words.detail && 'min-w-0 shrink')}>
            {words.label}
          </ActivityLabel>
          {words.detail && <ActivityDetail className={cn(prominent && 'text-body-sm')}>{words.detail}</ActivityDetail>}
          {words.duration && (
            <ActivityLabel className={cn(prominent && 'text-body', '-ml-1 tabular-nums')}>
              · {words.duration}
            </ActivityLabel>
          )}
          {failed && <X size={13} role="img" aria-label="Failed" className="shrink-0 text-destructive-foreground" />}
          {outcomeLabel && (
            <Txt as="span" variant="meta" tone="muted" className="shrink-0 tabular-nums">
              {outcomeLabel}
            </Txt>
          )}
          <ActivityDisclosure />
        </ActivityHeader>
      </ActivityTimedTrigger>
      {children}
    </Activity>
  );
}
