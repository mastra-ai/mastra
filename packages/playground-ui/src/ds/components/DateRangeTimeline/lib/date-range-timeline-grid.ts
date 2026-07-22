import {
  buildTimelineTickOffsets,
  getTimelinePosition,
  type TimelineIndexRange,
} from './date-range-timeline';

const MAX_GRID_INTERVALS = 24;

export interface DateRangeGridMarker {
  index: number;
  position: number;
  emphasis: 'major' | 'medium' | 'minor';
}

function addVisibleMarker(markerIndices: Set<number>, index: number, viewport: TimelineIndexRange) {
  if (index >= viewport.from && index <= viewport.to) {
    markerIndices.add(index);
  }
}

function getMarkerEmphasis(
  index: number,
  majorIndices: Set<number>,
  mediumIndices: Set<number>,
): DateRangeGridMarker['emphasis'] {
  if (majorIndices.has(index)) return 'major';
  if (mediumIndices.has(index)) return 'medium';
  return 'minor';
}

export function createDateRangeGridMarkers(
  viewport: TimelineIndexRange,
  selection: TimelineIndexRange,
): DateRangeGridMarker[] {
  const viewportSpan = Math.max(0, viewport.to - viewport.from);
  if (viewportSpan === 0) {
    return [{ index: viewport.from, position: 50, emphasis: 'major' }];
  }

  const sampleStep = Math.max(1, Math.ceil(viewportSpan / MAX_GRID_INTERVALS));
  const markerIndices = new Set<number>();
  const majorIndices = new Set<number>();
  const mediumIndices = new Set<number>();
  const tickOffsets = buildTimelineTickOffsets(viewportSpan);

  for (let index = viewport.from; index <= viewport.to; index += sampleStep) {
    markerIndices.add(index);
  }

  for (let index = 0; index < tickOffsets.length; index += 1) {
    const tickOffset = tickOffsets[index];
    if (tickOffset === undefined) continue;

    const majorIndex = viewport.from + tickOffset;
    markerIndices.add(majorIndex);
    majorIndices.add(majorIndex);

    const nextTickOffset = tickOffsets[index + 1];
    if (nextTickOffset === undefined) continue;

    const mediumIndex = viewport.from + Math.round((tickOffset + nextTickOffset) / 2);
    markerIndices.add(mediumIndex);
    mediumIndices.add(mediumIndex);
  }

  addVisibleMarker(markerIndices, selection.from, viewport);
  addVisibleMarker(markerIndices, selection.to, viewport);

  return [...markerIndices]
    .sort((left, right) => left - right)
    .map((index) => ({
      index,
      position: getTimelinePosition(index, viewport),
      emphasis: getMarkerEmphasis(index, majorIndices, mediumIndices),
    }));
}
