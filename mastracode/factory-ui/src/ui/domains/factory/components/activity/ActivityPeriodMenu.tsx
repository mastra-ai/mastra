import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown } from 'lucide-react';

import { ACTIVITY_PERIOD_LABELS } from '../../periodActivity';
import type { ActivityPeriod } from '../../periodActivity';

const PERIOD_OPTIONS = (['today', 'week', 'month'] as const).map(value => ({
  value,
  label: ACTIVITY_PERIOD_LABELS[value],
}));

export function ActivityPeriodMenu({
  period,
  onPeriodChange,
}: {
  period: ActivityPeriod;
  onPeriodChange: (period: ActivityPeriod) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            className={cn(
              textStyle({ variant: 'caption', tone: 'muted' }),
              'hover:text-foreground duration-fast ease-out-custom flex cursor-pointer items-center gap-1 rounded-sm transition-colors motion-reduce:transition-none',
              focusRing,
            )}
          />
        }
      >
        {ACTIVITY_PERIOD_LABELS[period]}
        <ChevronDown aria-hidden className="size-3.5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.RadioOptions
          options={PERIOD_OPTIONS}
          value={period}
          onValueChange={onPeriodChange}
          closeOnSelect
        />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
