import { createPortal } from 'react-dom';

import { SANKEY_TOOLTIP_MAX_WIDTH_PX } from './use-sankey-hover-tooltip';
import type { SankeyTooltipPosition } from './use-sankey-hover-tooltip';
import { ChartTooltip } from '@/ds/components/ChartTooltip';

export function SankeyPortalTooltip({
  id,
  title,
  description,
  position,
  visible,
}: {
  id: string;
  title: string;
  description: string;
  position: SankeyTooltipPosition | undefined;
  visible: boolean;
}) {
  if (!visible || !position) return null;

  return createPortal(
    <ChartTooltip
      aria-label={`${title}: ${description}`}
      className="pointer-events-none fixed z-50 p-2"
      id={id}
      role="tooltip"
      style={{
        left: position.left,
        maxWidth: `min(${SANKEY_TOOLTIP_MAX_WIDTH_PX}px, calc(100vw - 2rem))`,
        top: position.top,
        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
        width: 'max-content',
      }}
    >
      <div className="text-column">{title}</div>
      <div className="text-muted-foreground whitespace-pre-wrap">{description}</div>
    </ChartTooltip>,
    document.body,
  );
}
