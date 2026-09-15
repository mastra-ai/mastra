import { clamp } from './date-range-timeline';

const PREFERRED_PICKER_WIDTH = 160;
const PREFERRED_PICKER_GAP = 8;

interface BoundaryPositions {
  from: number;
  to: number;
}

interface BoundaryPickerRect {
  left: number;
  width: number;
}

export interface DateRangeBoundaryLayout {
  from: BoundaryPickerRect;
  to: BoundaryPickerRect;
  gap: number;
}

export function resolveDateRangeBoundaryLayout(
  requestedWidth: number,
  positions: BoundaryPositions,
): DateRangeBoundaryLayout {
  const width = Math.max(0, requestedWidth);
  const gap = Math.min(PREFERRED_PICKER_GAP, width);
  const pickerWidth = Math.min(PREFERRED_PICKER_WIDTH, Math.max(0, (width - gap) / 2));
  const maximumLeft = Math.max(0, width - pickerWidth);
  const fromAnchor = (clamp(positions.from, 0, 100) / 100) * width;
  const toAnchor = (clamp(positions.to, 0, 100) / 100) * width;
  const preferredFromLeft = clamp(fromAnchor - pickerWidth - gap / 2, 0, maximumLeft);
  const preferredToLeft = clamp(toAnchor + gap / 2, 0, maximumLeft);
  const overlap = preferredFromLeft + pickerWidth + gap - preferredToLeft;

  if (overlap <= 0) {
    return {
      from: { left: preferredFromLeft, width: pickerWidth },
      to: { left: preferredToLeft, width: pickerWidth },
      gap,
    };
  }

  const pairWidth = pickerWidth * 2 + gap;
  const pairLeft = clamp(preferredFromLeft - overlap / 2, 0, Math.max(0, width - pairWidth));

  return {
    from: { left: pairLeft, width: pickerWidth },
    to: { left: pairLeft + pickerWidth + gap, width: pickerWidth },
    gap,
  };
}
