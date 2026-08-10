import { useId, useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

/** A theme-presence point with an instant portal tooltip. */
export function LifelinePoint({
  title,
  positionPercent,
  height,
  color,
  onSelect,
}: {
  title: string;
  positionPercent: number | undefined;
  height: number;
  color: string;
  onSelect: (() => void) | undefined;
}) {
  const tooltipId = useId();
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number }>();
  const style = { left: `${positionPercent}%`, height: `${height}px`, backgroundColor: color };

  function showTooltipAt(target: HTMLElement) {
    const bounds = target.getBoundingClientRect();
    setTooltipPosition({ left: bounds.left + bounds.width / 2, top: bounds.top - 6 });
  }

  function hideTooltip() {
    setTooltipPosition(undefined);
  }

  const interactionProps = {
    'aria-describedby': tooltipPosition ? tooltipId : undefined,
    onMouseEnter: (event: MouseEvent<HTMLElement>) => showTooltipAt(event.currentTarget),
    onMouseLeave: hideTooltip,
    onFocus: (event: FocusEvent<HTMLElement>) => showTooltipAt(event.currentTarget),
    onBlur: hideTooltip,
  };

  return (
    <>
      {onSelect ? (
        <button
          aria-label={title}
          className="absolute bottom-px w-1.5 -translate-x-1/2 cursor-pointer rounded-xs hover:brightness-125"
          onClick={onSelect}
          style={style}
          type="button"
          {...interactionProps}
        />
      ) : (
        <span
          aria-label={title}
          className="absolute bottom-px w-1.5 -translate-x-1/2 rounded-xs"
          style={style}
          {...interactionProps}
        />
      )}
      {tooltipPosition
        ? createPortal(
            <div
              className="border-border1 bg-surface5 text-neutral6 shadow-elevated pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 font-mono text-[11px] whitespace-nowrap tabular-nums"
              id={tooltipId}
              role="tooltip"
              style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
            >
              {title}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
