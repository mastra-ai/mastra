import { useThinkingLevelStop, invisibleRangeInputClassName } from './use-thinking-level-stop';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface ThinkingLevelSliderProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T;
  ariaLabel: string;
  disabled?: boolean;
  /** Appended to the announced value, e.g. ` · follows base` when the level is inherited. */
  valueTextSuffix?: string;
  /** Returning the write lets the thumb hold the dropped stop until it lands. */
  onChange: (value: T) => void | Promise<unknown>;
  className?: string;
}

const EMPHASIS_TONE = {
  muted: 'text-placeholder',
  warning: 'text-warning-foreground',
} as const;

export function ThinkingLevelSlider<T extends string>({
  options,
  value,
  ariaLabel,
  disabled,
  valueTextSuffix,
  onChange,
  className,
}: ThinkingLevelSliderProps<T>) {
  const { shownStop, shownOption, isPending, rangeInputProps } = useThinkingLevelStop({ options, value, onChange });
  const lastStop = Math.max(options.length - 1, 1);
  const tone = shownOption?.emphasis ? EMPHASIS_TONE[shownOption.emphasis] : 'text-foreground';
  const valueText = `${shownOption?.label ?? ''}${isPending ? '' : (valueTextSuffix ?? '')}`;
  const travelled = `calc(0.5rem + (100% - 1rem) * ${shownStop / lastStop})`;

  return (
    <div className={cn('flex items-center gap-2', tone, disabled && 'pointer-events-none opacity-50', className)}>
      <Txt as="span" variant="caption" className="w-20 shrink-0 text-right">
        {shownOption?.label}
      </Txt>

      <span className="relative flex h-7 w-36 items-center rounded-lg bg-fill">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-lg bg-fill-strong"
          style={{ width: `calc(${travelled} + 6px)` }}
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-[6.5px] flex justify-between">
          {options.map(option => (
            <span key={option.value} className="size-[3px] rounded-full bg-current/40" />
          ))}
        </span>
        <span
          aria-hidden
          className="absolute h-4 w-[3px] -translate-x-1/2 rounded-full bg-current"
          style={{ left: travelled }}
        />
        <input
          {...rangeInputProps}
          aria-label={ariaLabel}
          aria-valuetext={valueText}
          disabled={disabled}
          className={cn('relative h-7 w-full rounded-lg', invisibleRangeInputClassName)}
        />
      </span>
    </div>
  );
}
