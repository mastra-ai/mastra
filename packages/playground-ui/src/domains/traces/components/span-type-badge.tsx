import type { CSSProperties } from 'react';
import { ProcessorIcon } from '../../../ds/icons/ProcessorIcon';
import type { UISpanStyle } from '../types';

type SpanTypeBadgeProps = {
  /** Raw span type (`processor_run`, `model_generation`, ...). */
  type: string;
  spanUI?: UISpanStyle | null;
};

/** Small tinted square carrying the span type's icon in its colour; a dot for types without an icon. */
export function SpanTypeBadge({ type, spanUI }: SpanTypeBadgeProps) {
  const color = spanUI?.color;
  // Processors count as "Other" in the legend, but the sidebar gives them their own icon.
  const icon = type?.toLowerCase().startsWith('processor') ? <ProcessorIcon /> : spanUI?.icon;
  const style: CSSProperties = {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
  };

  return (
    <span
      aria-hidden
      title={spanUI?.label}
      style={style}
      className="flex size-5 shrink-0 items-center justify-center rounded-md [&_svg]:size-3"
    >
      {icon ?? <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
    </span>
  );
}
