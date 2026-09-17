import { Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { RunOptionsContent } from './run-options-content';
import type { RunOptionsContentProps } from './run-options-content';
import { Button } from '@/ds/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';

// Only `align` deviates from base-ui's defaults (side: 'flip', fallbackAxisSide: 'end').
// 'shift' keeps the wide popup anchored to its trigger and slides it into view instead of
// flipping start↔end, which would make it jump sides.
const RUN_OPTIONS_COLLISION_AVOIDANCE = {
  align: 'shift',
} as const;

export interface RunOptionsPopoverProps extends RunOptionsContentProps {
  /** `icon`: round settings button. `labelled`: ghost "Run options" text button. */
  triggerVariant: 'icon' | 'labelled';
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra node appended to the trigger tooltip (e.g. a keyboard shortcut hint). */
  shortcutHint?: ReactNode;
  testId?: string;
}

function TriggerTooltip({ shortcutHint }: { shortcutHint?: ReactNode }) {
  if (!shortcutHint) return <>Run options</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      Run options
      {shortcutHint}
    </span>
  );
}

/**
 * Popover holding the per-entity run options (request context + optional extra section).
 * Requires `RequestContextProvider`.
 */
export function RunOptionsPopover({
  triggerVariant,
  align = 'start',
  open,
  onOpenChange,
  shortcutHint,
  testId,
  ...contentProps
}: RunOptionsPopoverProps) {
  const tooltip = <TriggerTooltip shortcutHint={shortcutHint} />;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          triggerVariant === 'icon' ? (
            <Button
              variant="default"
              size="icon-md"
              type="button"
              aria-label="Run options"
              tooltip={tooltip}
              data-testid={testId}
            >
              <Settings2 />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" type="button" tooltip={tooltip} data-testid={testId} icon={<Settings2 />}>
              Run options
            </Button>
          )
        }
      />
      <PopoverContent
        align={align}
        collisionAvoidance={RUN_OPTIONS_COLLISION_AVOIDANCE}
        className="w-[min(760px,calc(100vw-2rem))] p-0"
      >
        <RunOptionsContent {...contentProps} />
      </PopoverContent>
    </Popover>
  );
}
