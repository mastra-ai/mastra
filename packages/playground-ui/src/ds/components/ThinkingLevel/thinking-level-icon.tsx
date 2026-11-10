import { ThinkingLevelBrain } from './thinking-level-brain';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { cn } from '@/lib/utils';

export interface ThinkingLevelIconProps<T extends string> {
  options: readonly ThinkingLevelOption<T>[];
  value: T | undefined;
  /** Pulses the brain while the level loads. */
  loading?: boolean;
}

/** Same depth the ramp gives the brain of that level: empty at the first level, full at the last. */
function brainFill(stop: number, lastStop: number) {
  if (stop < 0) return 0;
  if (lastStop === 0) return 1;
  return stop / lastStop;
}

/** The thinking level as one brain, e.g. on the button that opens the ramp. Empty while no level is set. */
export function ThinkingLevelIcon<T extends string>({ options, value, loading }: ThinkingLevelIconProps<T>) {
  const stop = options.findIndex(option => option.value === value);
  const costly = options[stop]?.emphasis === 'warning';
  return (
    <ThinkingLevelBrain
      fill={brainFill(stop, options.length - 1)}
      className={cn(
        costly && 'text-warning-foreground',
        loading && 'motion-safe:animate-pulse motion-reduce:animate-none',
      )}
    />
  );
}
