import { describe, expect, it } from 'vitest';

import { keptReviewBoard, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { fitScale, movesCanvasVariant, movesLayout, PAN_ZOOM_BELOW } from '../moves/movesLayout';
import { movesMap } from '../moves/movesMap';
import { seededRoutes } from './fixtures';

/** Two cards whose corners span `width` by `height`. */
const spanning = (width: number, height: number) => [
  { position: { x: 0, y: 0 }, width: 10, measured: { width: 10, height: 10 } },
  { position: { x: width - 10, y: height - 10 }, width: 10, measured: { width: 10, height: 10 } },
];

/** A board's map as laid out once the canvas has measured every card at `cardHeight`. */
function measuredNodes(board: typeof workBoardInfo, cardHeight: number) {
  const map = movesMap(board, seededRoutes());
  const unmeasured = movesLayout(map, undefined).nodes;
  const heights = new Map(unmeasured.map(node => [node.id, cardHeight]));
  return movesLayout(map, undefined, heights).nodes.map(node => ({
    ...node,
    measured: 'width' in node && node.width ? { width: node.width, height: cardHeight } : { width: 1, height: 1 },
  }));
}

describe('the card moves canvas', () => {
  it('fits a map at the largest scale that keeps 20px around it, never above 1', () => {
    expect(fitScale(spanning(1000, 500), 520, 1040)).toBeCloseTo(0.48);
    expect(fitScale(spanning(1000, 500), 2000, 2000)).toBe(1);
  });

  it('stays inline down to the threshold and becomes pannable just below it', () => {
    // 1000px wide fits a canvas 640px wide at exactly 0.6.
    expect(fitScale(spanning(1000, 100), 640, 1000)).toBeCloseTo(PAN_ZOOM_BELOW);
    expect(movesCanvasVariant(spanning(1000, 100), 640, 1000)).toBe('inline');
    expect(movesCanvasVariant(spanning(1000, 100), 638, 1000)).toBe('default');
  });

  it('stays inline until the canvas has a size', () => {
    expect(movesCanvasVariant(spanning(5000, 5000), 0, 0)).toBe('inline');
  });

  it('lets a big board pan and zoom, and keeps a small one fit to its box', () => {
    // Eight phases and every default move: fitting it into the page would shrink the cards past reading.
    const big = measuredNodes(workBoardInfo, 150);
    expect(movesCanvasVariant(big, 960, 1100)).toBe('default');
    const small = measuredNodes(keptReviewBoard, 110);
    expect(movesCanvasVariant(small, 960, 700)).toBe('inline');
  });
});
