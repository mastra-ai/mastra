import { describe, expect, it } from 'vitest';
import type { Step } from '../../context/use-current-run';
import { getWorkflowBoundaryData } from '../workflow-boundary-data';

const steps: Record<string, Step> = {
  review: { status: 'success', startedAt: 1, input: { title: 'Document' }, output: { approved: true } },
  'review.batch': {
    status: 'success',
    startedAt: 1,
    input: [{ title: 'First' }, { title: 'Second' }],
    output: [{ words: 10 }, { words: 20 }],
  },
  'empty-values': { status: 'success', startedAt: 1, input: [false, 0], output: [null, ''] },
};

describe('getWorkflowBoundaryData', () => {
  describe('when inspecting a nested workflow', () => {
    it('returns that workflow input and output', () => {
      expect(getWorkflowBoundaryData(steps, 'review')).toEqual({
        input: { title: 'Document' },
        output: { approved: true },
      });
    });
  });

  describe('when inspecting a foreach iteration inside a nested workflow', () => {
    it('returns only the selected item and its result', () => {
      expect(getWorkflowBoundaryData(steps, 'review.batch[1]')).toEqual({
        input: { title: 'Second' },
        output: { words: 20 },
      });
    });
  });

  describe('when an iteration has valid empty values', () => {
    it('preserves false, zero, null and empty strings', () => {
      expect(getWorkflowBoundaryData(steps, 'empty-values[0]')).toEqual({ input: false, output: null });
      expect(getWorkflowBoundaryData(steps, 'empty-values[1]')).toEqual({ input: 0, output: '' });
    });
  });

  describe('when the selected iteration has not completed', () => {
    it('keeps its input available without borrowing another output', () => {
      expect(
        getWorkflowBoundaryData(
          { batch: { status: 'running', startedAt: 1, input: [{ title: 'Pending' }] } },
          'batch[0]',
        ),
      ).toEqual({ input: { title: 'Pending' }, output: undefined });
    });
  });

  describe('when no run data exists for the scope', () => {
    it('leaves both boundaries unavailable', () => {
      expect(getWorkflowBoundaryData(steps, 'missing')).toEqual({ input: undefined, output: undefined });
      expect(getWorkflowBoundaryData(steps, 'review.batch[20]')).toEqual({ input: undefined, output: undefined });
    });
  });
});
