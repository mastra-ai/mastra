import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { PendingSwitch } from '../../../ui/PendingField';
import type { CardRule } from '../boardDraft';
import { startsText } from '../phaseSummary';
import { Muted } from './PhaseTimeline';

const STARTS_ROW = 'flex items-center gap-3';

export function StartsToggleSkeleton() {
  return (
    <div className={STARTS_ROW}>
      <span className="min-w-0 flex-1">
        <SkeletonText line="text-caption" className="w-24 motion-reduce:before:animate-none" />
      </span>
      <PendingSwitch />
    </div>
  );
}

/**
 * How a phase starts, with a switch to start it on its own when `onChange` is given. Turning it off drops the cards it
 * was limited to, as the phase's settings do.
 */
export function StartsToggle({
  label,
  autoStart,
  autoStartWhen,
  onChange,
  pending = false,
  failed = false,
}: {
  label: string;
  autoStart: boolean;
  autoStartWhen: CardRule | null | undefined;
  onChange?: (on: boolean) => void;
  pending?: boolean;
  failed?: boolean;
}) {
  const starts = startsText({ autoStart, autoStartWhen });
  if (!onChange) return <Muted>{starts}</Muted>;
  return (
    <label className={cn(STARTS_ROW, 'cursor-pointer')}>
      <span className="min-w-0 flex-1">
        {failed ? (
          <Txt as="span" variant="caption" className="text-destructive-foreground">
            Didn’t save, try again
          </Txt>
        ) : (
          <Muted>{starts}</Muted>
        )}
      </span>
      <Switch
        aria-label={`${label}: start on its own`}
        checked={autoStart}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </label>
  );
}
