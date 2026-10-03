import type { ReactNode } from 'react';

import { ThinkingLevelRamp } from './thinking-level-ramp';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ThinkingLevelBarsProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T | undefined;
}

export function ThinkingLevelBars<T extends string>({ options, value }: ThinkingLevelBarsProps<T>) {
  const thinkingOptions = options.filter(option => option.emphasis !== 'muted');
  const filled = thinkingOptions.findIndex(option => option.value === value) + 1;
  const barCount = Math.max(thinkingOptions.length, 1);
  return (
    <span aria-hidden className="flex h-3 items-end gap-0.5">
      {Array.from({ length: barCount }, (_, index) => (
        <span
          key={index}
          className={cn('w-[3px] rounded-xs', index < filled ? 'bg-current' : 'bg-current/25')}
          style={{ height: `${40 + (60 * index) / Math.max(barCount - 1, 1)}%` }}
        />
      ))}
    </span>
  );
}

export interface ThinkingLevelPickerProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T;
  label: string;
  /** Disables the trigger and explains why in its tooltip, e.g. when the model cannot think. */
  unavailableReason?: string;
  description?: ReactNode;
  onChange: (value: T) => void | Promise<unknown>;
}

export function ThinkingLevelPicker<T extends string>({
  options,
  value,
  label,
  unavailableReason,
  description,
  onChange,
}: ThinkingLevelPickerProps<T>) {
  if (unavailableReason) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="button"
              tabIndex={0}
              aria-disabled="true"
              aria-label={`${label}: unavailable. ${unavailableReason}`}
              className={cn(
                'inline-flex h-control-sm shrink-0 cursor-not-allowed items-center rounded-full border border-transparent px-2.5 text-placeholder',
                focusRing,
              )}
            />
          }
        >
          <ThinkingLevelBars options={options} value={undefined} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64">
          {unavailableReason}
        </TooltipContent>
      </Tooltip>
    );
  }

  const triggerLabel = `${label}: ${options.find(option => option.value === value)?.label ?? value}`;

  return (
    <Popover>
      <PopoverTrigger variant="ghost" size="sm" aria-label={triggerLabel} tooltip={triggerLabel} className="shrink-0">
        <ThinkingLevelBars options={options} value={value} />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-3">
        <ThinkingLevelRamp options={options} value={value} label={label} onChange={onChange} />
        {description ? (
          <Txt as="p" variant="caption" tone="muted">
            {description}
          </Txt>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
