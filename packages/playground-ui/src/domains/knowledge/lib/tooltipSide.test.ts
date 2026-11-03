import { describe, expect, it } from 'vitest';

import { chooseTooltipSide } from './tooltipSide';
import type { Box } from './tooltipSide';

const bounds: Box = { left: 0, top: 0, right: 1000, bottom: 800 };
const tip = { width: 200, height: 80 };
const at = (x: number, y: number): Box => ({ left: x - 7, right: x + 7, top: y - 7, bottom: y + 7 });
const base = { gap: 8, tip, bounds, obstacles: [], lines: [] };

describe('chooseTooltipSide', () => {
  describe('when nothing is in the way', () => {
    it('stays above the dot', () => {
      expect(chooseTooltipSide({ ...base, dot: at(500, 400) })).toBe('top');
    });
  });

  describe('when the page the tooltip would cover is above the dot', () => {
    it('moves below it', () => {
      const focus: Box = { left: 450, right: 550, top: 280, bottom: 380 };
      expect(chooseTooltipSide({ ...base, dot: at(500, 400), obstacles: [focus] })).toBe('bottom');
    });
  });

  describe('when a highlighted line runs up from the dot', () => {
    it('leaves that side clear', () => {
      const side = chooseTooltipSide({
        ...base,
        dot: at(500, 400),
        lines: [{ from: { x: 500, y: 400 }, to: { x: 500, y: 100 } }],
      });
      expect(side).not.toBe('top');
    });

    it('does not mind a line that runs the other way', () => {
      const lines = [{ from: { x: 500, y: 400 }, to: { x: 500, y: 700 } }];
      expect(chooseTooltipSide({ ...base, dot: at(500, 400), lines })).toBe('top');
    });
  });

  describe('when the dot is near an edge of the graph', () => {
    it('picks a side that stays inside it', () => {
      expect(chooseTooltipSide({ ...base, dot: at(500, 20) })).toBe('bottom');
      expect(chooseTooltipSide({ ...base, dot: at(990, 400) })).toBe('left');
      expect(chooseTooltipSide({ ...base, dot: at(10, 400) })).toBe('right');
    });
  });

  describe('when the legend sits above and the focus below', () => {
    it('goes sideways', () => {
      const legend: Box = { left: 400, right: 600, top: 290, bottom: 390 };
      const focus: Box = { left: 400, right: 600, top: 410, bottom: 510 };
      expect(chooseTooltipSide({ ...base, dot: at(500, 400), obstacles: [legend, focus] })).toMatch(/left|right/);
    });
  });

  describe('when every side but below is covered', () => {
    const dot = at(500, 400);
    const above: Box = { left: 400, right: 600, top: 300, bottom: 380 };
    const leftOf: Box = { left: 250, right: 480, top: 360, bottom: 440 };
    const rightOf: Box = { left: 520, right: 750, top: 360, bottom: 440 };

    it('goes below, so below is a candidate like the rest', () => {
      expect(chooseTooltipSide({ ...base, dot, obstacles: [above, leftOf, rightOf] })).toBe('bottom');
    });

    it('goes below even when a line also runs up, left and right', () => {
      const lines = [
        { from: { x: 500, y: 400 }, to: { x: 500, y: 150 } },
        { from: { x: 500, y: 400 }, to: { x: 150, y: 400 } },
        { from: { x: 500, y: 400 }, to: { x: 850, y: 400 } },
      ];
      expect(chooseTooltipSide({ ...base, dot, lines })).toBe('bottom');
    });

    it('stays off below when below is the covered side instead', () => {
      const below: Box = { left: 400, right: 600, top: 420, bottom: 500 };
      expect(chooseTooltipSide({ ...base, dot, obstacles: [below] })).toBe('top');
    });
  });
});
