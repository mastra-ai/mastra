import { useThinkingLevelStop, invisibleRangeInputClassName } from './use-thinking-level-stop';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { ButtonLabel, buttonVariants } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ThinkingLevelRampProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  /** Undefined while no level can be picked: the ramp keeps its size, with empty bars and a disabled slider. */
  value: T | undefined;
  label: string;
  /** Pulses the empty bars while the level loads. */
  loading?: boolean;
  /** Why no level can be picked, shown where the level would be. */
  unavailableReason?: string;
  /** A text button at the end of the header, e.g. a way back to an inherited level. */
  reset?: { label: string; onClick: () => void };
  /** Returning the write lets the ramp hold the dropped stop until it lands. */
  onChange: (value: T) => void | Promise<unknown>;
}

function filledBarColor(option: ThinkingLevelOption) {
  return option.emphasis === 'warning' ? 'bg-warning-foreground' : 'bg-foreground';
}

export function ThinkingLevelRamp<T extends string>({
  options,
  value,
  label,
  loading,
  unavailableReason,
  reset,
  onChange,
}: ThinkingLevelRampProps<T>) {
  const { shownStop, shownOption, rangeInputProps } = useThinkingLevelStop({ options, value, onChange });
  const lastStop = Math.max(options.length - 1, 1);

  return (
    <div className="flex flex-col gap-3" aria-busy={loading || undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <Txt as="p" variant="label" tone="ink" className="shrink-0">
          {label}
        </Txt>
        <div className="flex min-w-0 items-baseline gap-2">
          <Txt
            as="span"
            variant="caption"
            tone="muted"
            className="truncate"
            title={shownOption ? undefined : unavailableReason}
          >
            {shownOption ? shownOption.label : unavailableReason}
          </Txt>
          {reset ? (
            <button
              type="button"
              onClick={reset.onClick}
              className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'shrink-0')}
            >
              <ButtonLabel variant="link">{reset.label}</ButtonLabel>
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            'relative flex h-10 items-end gap-1 max-sm:h-11',
            loading && 'motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        >
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
            aria-valuetext={shownOption?.label ?? unavailableReason}
            disabled={value === undefined}
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
