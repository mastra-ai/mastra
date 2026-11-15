import type { ReactNode } from 'react';

import { ThinkingLevelIcon } from './thinking-level-icon';
import { ThinkingLevelRamp } from './thinking-level-ramp';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ThinkingLevelUnavailableProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  label: string;
  reason: string;
  /** The level still in effect, when the control is locked rather than unsupported. */
  value?: T;
}

export function ThinkingLevelUnavailable<T extends string>({
  options,
  label,
  reason,
  value,
}: ThinkingLevelUnavailableProps<T>) {
  const levelInEffect = options.find(option => option.value === value)?.label;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            aria-disabled="true"
            aria-label={`${label}: ${levelInEffect ?? 'unavailable'}. ${reason}`}
            className={cn(
              'inline-flex h-control-sm shrink-0 cursor-not-allowed items-center rounded-full border border-transparent px-2.5 text-placeholder',
              focusRing,
            )}
          />
        }
      >
        <ThinkingLevelIcon options={options} value={value} />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

export interface ThinkingLevelPickerProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T;
  label: string;
  /** Disables the trigger and explains why in its tooltip, e.g. when the model cannot think. */
  unavailableReason?: string;
  description?: ReactNode;
  origin?: string;
  footer?: ReactNode;
  onChange: (value: T) => void | Promise<unknown>;
}

export function ThinkingLevelPicker<T extends string>({
  options,
  value,
  label,
  unavailableReason,
  description,
  origin,
  footer,
  onChange,
}: ThinkingLevelPickerProps<T>) {
  if (unavailableReason) {
    return <ThinkingLevelUnavailable options={options} label={label} reason={unavailableReason} />;
  }

  const levelLabel = options.find(option => option.value === value)?.label ?? value;
  const triggerLabel = origin ? `${label}: ${levelLabel} (${origin})` : `${label}: ${levelLabel}`;

  return (
    <Popover>
      <PopoverTrigger variant="ghost" size="sm" aria-label={triggerLabel} tooltip={triggerLabel} className="shrink-0">
        <ThinkingLevelIcon options={options} value={value} />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-3">
        <ThinkingLevelRamp options={options} value={value} label={label} onChange={onChange} />
        {description ? (
          <Txt as="p" variant="caption" tone="muted">
            {description}
          </Txt>
        ) : null}
        {footer}
      </PopoverContent>
    </Popover>
  );
}
