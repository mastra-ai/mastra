import type { CSSProperties } from 'react';
import type { UISpanStyle } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { ProcessorIcon } from '@/ds/icons/ProcessorIcon';

type SpanTypeBadgeProps = {
  /** Raw span type (`processor_run`, `model_generation`, ...). */
  type: string;
  spanUI?: UISpanStyle | null;
};

/**
 * Small tinted square carrying the span type's icon in its colour; a dot for types without an icon.
 * Hovering it names the type.
 */
export function SpanTypeBadge({ type, spanUI }: SpanTypeBadgeProps) {
  const color = spanUI?.color;
  // Processors fall under "Other" colours, but get their own icon, so they get their own name too.
  const isProcessor = type?.toLowerCase().startsWith('processor');
  const icon = isProcessor ? <ProcessorIcon /> : spanUI?.icon;
  const label = isProcessor ? 'Processor' : spanUI?.label;
  const style: CSSProperties = {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-slot="span-type-badge"
            style={style}
            className="flex size-5 shrink-0 items-center justify-center rounded-md [&_svg]:size-3"
          />
        }
      >
        {icon ?? <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
