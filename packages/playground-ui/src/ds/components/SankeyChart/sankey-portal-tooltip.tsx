import { createPortal } from 'react-dom';

import { SANKEY_TOOLTIP_MAX_WIDTH_PX } from './use-sankey-hover-tooltip';
import type { SankeyTooltipPosition } from './use-sankey-hover-tooltip';

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
    <div
      aria-label={`${title}: ${description}`}
      className="bg-surface-active shadow-elevated pointer-events-none fixed z-50 rounded-md border border-(--border-subtle) p-2 text-xs leading-4 text-(--text-primary)"
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
      <div className="font-medium">{title}</div>
      <div className="whitespace-pre-wrap text-(--text-primary)">{description}</div>
    </div>,
    document.body,
  );
}
