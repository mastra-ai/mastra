import { MetricValue } from '../MetricValue';
import { cn } from '@/lib/utils';

const WIDTH = 30;
const HEIGHT = 12;
const INSET = 1;

function plot(history: number[], fallback: number): { points: string; headY: number } {
  const samples = history.length > 0 ? history : [fallback];
  const line = samples.length > 1 ? samples : [...samples, ...samples];
  const peak = Math.max(...line, 1);
  const y = (sample: number) => HEIGHT - INSET - (sample / peak) * (HEIGHT - INSET * 2);

  return {
    points: line.map((sample, index) => `${(index / (line.length - 1)) * WIDTH},${y(sample).toFixed(2)}`).join(' '),
    headY: y(line.at(-1) ?? fallback),
  };
}

export interface TokenRateProps {
  tokensPerSec: number;
  /** Recent throughput samples, oldest first. */
  history: number[];
  className?: string;
}

/** Decode throughput as a curve: the trend a bare number can't carry, digits on hover. */
export function TokenRate({ tokensPerSec, history, className }: TokenRateProps) {
  const { points, headY } = plot(history, tokensPerSec);

  return (
    <span aria-label={`${tokensPerSec} tokens per second`} className={cn('metric', className)} role="img">
      <svg aria-hidden className="overflow-visible" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH}>
        <polyline
          className="fill-none stroke-current opacity-55"
          points={points}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        <circle className="fill-current" cx={WIDTH} cy={headY} r="1.5" />
      </svg>
      <MetricValue>
        {tokensPerSec}
        <span className="text-icon2 ps-1">tok/s</span>
      </MetricValue>
    </span>
  );
}
