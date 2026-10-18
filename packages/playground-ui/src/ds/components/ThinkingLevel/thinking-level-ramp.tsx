import { useThinkingLevelStop, invisibleRangeInputClassName } from './use-thinking-level-stop';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ThinkingLevelRampProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T;
  label: string;
  /** Returning the write lets the ramp hold the dropped stop until it lands. */
  onChange: (value: T) => void | Promise<unknown>;
}

function filledBarColor(option: ThinkingLevelOption) {
  return option.emphasis === 'warning' ? 'bg-warning-foreground' : 'bg-foreground';
}

export function ThinkingLevelRamp<T extends string>({ options, value, label, onChange }: ThinkingLevelRampProps<T>) {
  const { shownStop, shownOption, rangeInputProps } = useThinkingLevelStop({ options, value, onChange });
  const lastStop = Math.max(options.length - 1, 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <Txt as="p" variant="label" tone="ink">
          {label}
        </Txt>
        <Txt as="span" variant="caption" tone="muted">
          {shownOption?.label}
        </Txt>
      </div>
      <div className="flex flex-col gap-2">
        <div className="relative flex h-10 items-end gap-1">
          {options.map((option, stop) => (
            <span
              key={option.value}
              aria-hidden
              className={cn(
                'flex-1 rounded-sm transition-colors',
                stop <= shownStop ? filledBarColor(option) : 'bg-fill',
              )}
              style={{ height: `${20 + (80 * stop) / lastStop}%` }}
            />
          ))}
          <input
            {...rangeInputProps}
            aria-label={label}
            aria-valuetext={shownOption?.label}
            className={cn('absolute inset-0 size-full rounded-sm', invisibleRangeInputClassName)}
          />
        </div>
        <div className="flex justify-between">
          {options.map((option, stop) => (
            <Txt
              key={option.value}
              as="span"
              variant="meta"
              tone={stop === shownStop ? 'ink' : 'faint'}
              className="flex-1 text-center"
            >
              {option.label}
            </Txt>
          ))}
        </div>
      </div>
    </div>
  );
}
