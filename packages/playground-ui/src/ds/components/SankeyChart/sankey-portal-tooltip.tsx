import { createPortal } from 'react-dom';

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
      className="border-border1 bg-surface5 text-neutral6 shadow-elevated pointer-events-none fixed z-50 rounded-md border p-2 text-xs leading-4"
      id={id}
      role="tooltip"
      style={{
        left: position.left,
        maxWidth: 'min(20rem, calc(100vw - 2rem))',
        top: position.top,
        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
        width: 'max-content',
      }}
    >
      <div className="font-medium">{title}</div>
      <div className="text-neutral4 whitespace-pre-wrap">{description}</div>
    </div>,
    document.body,
  );
}
