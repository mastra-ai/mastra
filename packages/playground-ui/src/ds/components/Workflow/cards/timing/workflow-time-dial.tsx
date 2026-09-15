import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type DurationUnit = 'ms' | 's' | 'min' | 'h';

const DIAL_CENTER = 58;
const CLOCK_TICK_ANGLES = Array.from({ length: 60 }, (_, index) => index * 6);
const DURATION_TICK_ANGLES = Array.from({ length: 41 }, (_, index) => -120 + index * 6);

function pointAt(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: DIAL_CENTER + Math.sin(radians) * radius,
    y: DIAL_CENTER - Math.cos(radians) * radius,
  };
}

function DialTick({ angle, major, className, ...props }: ComponentProps<'line'> & { angle: number; major: boolean }) {
  const outer = pointAt(angle, 49);
  const inner = pointAt(angle, major ? 38 : 43);
  return (
    <line
      x1={inner.x}
      y1={inner.y}
      x2={outer.x}
      y2={outer.y}
      className={cn(major ? 'stroke-neutral2' : 'stroke-border2', className)}
      {...props}
    />
  );
}

function DialHand({ angle, length }: { angle: number; length: number }) {
  const tip = pointAt(angle, length);
  return (
    <line
      x1={DIAL_CENTER}
      y1={DIAL_CENTER}
      x2={tip.x}
      y2={tip.y}
      className="stroke-neutral4 stroke-[1.5]"
      strokeLinecap="round"
    />
  );
}

function DialFace({ tickAngles, children }: { tickAngles: number[]; children: ReactNode }) {
  return (
    <span className="text-neutral4 block size-28 shrink-0" aria-hidden>
      <svg viewBox="0 0 116 116" fill="none" className="block size-full overflow-visible">
        {tickAngles.map((angle, index) => (
          <DialTick key={angle} angle={angle} major={index % 5 === 0} />
        ))}
        {children}
      </svg>
    </span>
  );
}

export function ClockDial({ date }: { date: Date }) {
  const minutes = date.getUTCMinutes();
  return (
    <DialFace tickAngles={CLOCK_TICK_ANGLES}>
      <DialHand angle={((date.getUTCHours() % 12) + minutes / 60) * 30} length={26} />
      <DialHand angle={minutes * 6} length={37} />
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={2} fill="currentColor" />
    </DialFace>
  );
}

export function DurationDial({ amount, unit }: { amount: number; unit: DurationUnit }) {
  const scale = Math.max({ h: 24, ms: 1000, s: 60, min: 60 }[unit], Math.ceil(amount / 10) * 10);
  return (
    <DialFace tickAngles={DURATION_TICK_ANGLES}>
      <DialTick
        angle={-120 + (amount / scale) * 240}
        major
        className="stroke-neutral6 stroke-2"
        strokeLinecap="round"
      />
      <text x={DIAL_CENTER} y={94} textAnchor="middle" className="fill-neutral3 text-ui-xs font-sans">
        {scale} {unit}
      </text>
      <text x={DIAL_CENTER} y={106} textAnchor="middle" className="fill-neutral2 text-ui-xs font-sans">
        scale
      </text>
    </DialFace>
  );
}
