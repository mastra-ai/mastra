import { ACTIVITY_PERIOD_LABELS } from './activity-model';
import type { ActivityPeriod } from './activity-model';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { textStyle } from '@/ds/primitives/text';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

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
              'flex cursor-pointer items-center gap-1 rounded-sm transition-colors duration-fast ease-out-custom hover:text-foreground motion-reduce:transition-none',
              focusRing,
            )}
          />
        }
      >
        {ACTIVITY_PERIOD_LABELS[period]}
        <IconChevronDownMedium aria-hidden className="size-icon-sm" />
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
