import type { ActiveDotProps } from 'recharts';

function isDatum(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type ClickableDotProps = Pick<ActiveDotProps, 'cx' | 'cy' | 'payload'> & {
  color: string;
  label: string;
  onClick: (datum: Record<string, unknown>) => void;
};

/** Hovered point rendered as a keyboard-reachable button, so the bucket it represents can be drilled into. */
export function ClickableDot({ cx, cy, payload, color, label, onClick }: ClickableDotProps) {
  if (cx === undefined || cy === undefined || !isDatum(payload)) return null;
  const time = typeof payload.time === 'string' ? payload.time : '';
  const open = () => onClick(payload);

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Open ${label} bucket ${time}`.trim()}
      style={{ cursor: 'pointer' }}
      onClick={open}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') open();
      }}
    >
      <circle cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeOpacity={0.3} strokeWidth={4} />
    </g>
  );
}
