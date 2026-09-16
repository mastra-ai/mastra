import { describe, expect, it } from 'vitest';
import type { Step } from '../../context/use-current-run';
import { buildTimeline } from '../workflow-timeline-utils';

const step = (startedAt: number, endedAt?: number): Step => ({
  startedAt,
  endedAt,
  status: 'success',
});

const NOW = 10_000;

describe('buildTimeline', () => {
  describe('when steps are not in startedAt order', () => {
    it('returns rows sorted by startedAt ascending', () => {
      const steps: Record<string, Step> = {
        'a-very-long-first-step': step(100, 400),
        b: step(300, 350),
        'medium-final-step': step(200, 500),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['a-very-long-first-step', 'medium-final-step', 'b']);
    });
  });

  describe('when steps share the same startedAt', () => {
    it('falls back to stepId order for a deterministic result', () => {
      const steps: Record<string, Step> = {
        charlie: step(100, 200),
        alpha: step(100, 200),
        bravo: step(100, 200),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['alpha', 'bravo', 'charlie']);
    });
  });

  describe('when an input pseudo-key is present', () => {
    it('excludes input keys and still sorts the remaining steps chronologically', () => {
      const steps: Record<string, Step> = {
        input: step(0),
        'later.step': step(300, 400),
        'parent.child': step(150, 250),
        'parent.child.input': step(150),
      };

      const rows = buildTimeline(steps, NOW);

      expect(rows.map(row => row.stepId)).toEqual(['parent.child', 'later.step']);
    });
  });
});
