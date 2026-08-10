import { useId, useState } from 'react';

export type SankeyTooltipPosition = {
  left: number;
  top: number;
  placement: 'above' | 'below';
};

const TOOLTIP_TOP_FLIP_THRESHOLD = 120;
const TOOLTIP_RIGHT_INSET = 336;
const TOOLTIP_EDGE_INSET = 16;

export function useSankeyHoverTooltip(enabled: boolean) {
  const id = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState<SankeyTooltipPosition>();

  function showAt(target: Element) {
    if (!enabled) return;
    const rect = target.getBoundingClientRect();
    const placement = rect.top < TOOLTIP_TOP_FLIP_THRESHOLD ? 'below' : 'above';
    setPosition({
      left: Math.min(
        Math.max(rect.left, TOOLTIP_EDGE_INSET),
        Math.max(window.innerWidth - TOOLTIP_RIGHT_INSET, TOOLTIP_EDGE_INSET),
      ),
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  }

  return {
    id,
    position,
    isVisible: Boolean(enabled && position && (isHovered || isFocused)),
    showOnHover(target: Element) {
      setIsHovered(true);
      showAt(target);
    },
    hideOnLeave() {
      setIsHovered(false);
    },
    showOnFocus(target: Element) {
      setIsFocused(true);
      showAt(target);
    },
    hideOnBlur() {
      setIsFocused(false);
    },
  };
}
