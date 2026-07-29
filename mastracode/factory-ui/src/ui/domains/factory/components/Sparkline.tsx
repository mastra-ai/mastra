import { useId } from 'react';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const PADDING = 2;

export function Sparkline({ values, color, className }: { values: number[]; color: string; className?: string }) {
  const gradientId = useId();
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const step = VIEW_WIDTH / (values.length - 1);
  const plot = (value: number) => VIEW_HEIGHT - PADDING - (value / max) * (VIEW_HEIGHT - PADDING * 2);
  const line = values.map((value, index) => `${index * step},${plot(value)}`).join(' L ');
  const lastValue = values[values.length - 1] ?? 0;

  return (
    <div aria-hidden="true" className={`relative ${className ?? ''}`}>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M ${line} L ${VIEW_WIDTH},${VIEW_HEIGHT} L 0,${VIEW_HEIGHT} Z`} fill={`url(#${gradientId})`} />
        <path
          d={`M ${line}`}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* dot in HTML, not SVG — preserveAspectRatio=none would squash a circle */}
      <span
        className="ring-surface3 absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
        style={{ backgroundColor: color, left: '100%', top: `${(plot(lastValue) / VIEW_HEIGHT) * 100}%` }}
      />
    </div>
  );
}
