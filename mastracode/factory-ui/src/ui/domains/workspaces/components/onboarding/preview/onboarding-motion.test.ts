import { describe, expect, it } from 'vitest';
import { boardFrame } from './onboarding-motion';

describe('onboarding board choreography', () => {
  it('keeps both visible jobs separate and above the caption throughout a loop', () => {
    for (let time = 0; time < 14; time += 1 / 60) {
      const [ax, ay, aOpacity] = boardFrame(time, 0);
      const [bx, by, bOpacity] = boardFrame(time, 1);
      expect(Math.max(ay, by) + 48).toBeLessThan(302);
      if (aOpacity < 0.01 || bOpacity < 0.01) continue;
      const overlapX = ax < bx + 104 && bx < ax + 104;
      const overlapY = ay < by + 48 && by < ay + 48;
      expect(overlapX && overlapY, `Jobs overlap at ${time.toFixed(2)}s`).toBe(false);
    }
  });

  it('gives a newly arrived job a beat before the preceding job moves to review', () => {
    expect(boardFrame(1.4, 0)).toEqual([148, 244, 1]);
    expect(boardFrame(2.4, 1)).toEqual([148, 186, 1]);
    expect(boardFrame(2.8, 1)[0]).toBeGreaterThan(148);
  });

  it('promotes the waiting job only after the first build slot is free', () => {
    expect(boardFrame(3.2, 1)).toEqual([268, 186, 1]);
    expect(boardFrame(3.5, 0)).toEqual([148, 244, 1]);
    expect(boardFrame(4.1, 0)).toEqual([148, 186, 1]);
  });

  it('loops without a visible jump or teleport', () => {
    for (const index of [0, 1]) {
      expect(boardFrame(14, index)).toEqual(boardFrame(0, index));
      for (let time = 0; time < 28; time += 1 / 60) {
        const [x, y, opacity] = boardFrame(time, index);
        const [nextX, nextY, nextOpacity] = boardFrame(time + 1 / 60, index);
        if (opacity < 0.01 && nextOpacity < 0.01) continue;
        expect(Math.hypot(nextX - x, nextY - y)).toBeLessThan(6);
        expect(Math.abs(nextOpacity - opacity)).toBeLessThan(0.05);
      }
    }
  });
});
