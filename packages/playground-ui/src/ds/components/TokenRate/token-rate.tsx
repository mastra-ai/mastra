import { cn } from '@/lib/utils';

const SLOTS = 12;
const BAR = 2;
const GAP = 1;
const HEIGHT = 12;
const WIDTH = SLOTS * (BAR + GAP) - GAP;
/** Rate that fills the box. Fixed, so height reads as speed instead of speed relative to this run's own peak. */
const CEILING = 120;

function barHeight(tokensPerSec: number) {
  return Math.max(BAR, Math.round(Math.min(tokensPerSec / CEILING, 1) * HEIGHT));
}

export interface TokenRateProps {
  tokensPerSec: number;
  /** Recent throughput samples, oldest first. */
  history: number[];
  className?: string;
}

/** Decode throughput: the rate, and a waveform for the trend a bare number can't carry. */
export function TokenRate({ tokensPerSec, history, className }: TokenRateProps) {
  const samples = history.slice(-SLOTS);
  const offset = SLOTS - samples.length;

  return (
    <span className={cn('inline-flex items-center tabular-nums', className)}>
      <svg aria-hidden height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH}>
        {samples.map((sample, index) => {
          const height = barHeight(sample);
          return (
            <rect
              className="fill-current"
              height={height}
              key={index}
              opacity={index === samples.length - 1 ? 1 : 0.45}
              rx={BAR / 2}
              width={BAR}
              x={(offset + index) * (BAR + GAP)}
              y={(HEIGHT - height) / 2}
            />
          );
        })}
      </svg>
      <span className="ps-1">
        {tokensPerSec}
        <span className="text-icon2 ps-0.5">tok/s</span>
      </span>
    </span>
  );
}
