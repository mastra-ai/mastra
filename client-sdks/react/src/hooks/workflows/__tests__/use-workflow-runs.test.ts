// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import type { MastraClient } from '@mastra/client-js';
import { describe, it, expect } from 'vitest';
import { getWorkflowRunsNextPageParam, selectUniqueRuns, PER_PAGE } from '../use-workflow-runs';

type WorkflowRuns = Awaited<ReturnType<ReturnType<MastraClient['getWorkflow']>['runs']>>;

function makeRunsPage(runs: Array<{ runId: string; workflowName: string }>): WorkflowRuns {
  return {
    runs: runs.map(run => ({
      ...run,
      snapshot: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    total: runs.length,
  };
}

describe('useWorkflowRuns logic', () => {
  describe('when called', () => {
    it('paginates based on page size threshold', () => {
      const fullPage = makeRunsPage(
        Array.from({ length: PER_PAGE }, (_, i) => ({ runId: `r${i}`, workflowName: `Run ${i}` })),
      );
      expect(getWorkflowRunsNextPageParam(fullPage, [], 0)).toBe(1);
      expect(
        getWorkflowRunsNextPageParam(makeRunsPage([{ runId: 'r0', workflowName: 'Run 0' }]), [], 0),
      ).toBeUndefined();
    });
  });

  describe('when called', () => {
    it('deduplicates across pages, keeping first occurrence', () => {
      const data = {
        pages: [
          makeRunsPage([
            { runId: 'aaa', workflowName: 'First' },
            { runId: 'bbb', workflowName: 'Bravo' },
          ]),
          makeRunsPage([
            { runId: 'bbb', workflowName: 'Bravo (stale)' },
            { runId: 'ccc', workflowName: 'Charlie' },
          ]),
        ],
      };
      const result = selectUniqueRuns(data);
      expect(result.map(r => r.runId)).toEqual(['aaa', 'bbb', 'ccc']);
      expect(result[1].workflowName).toBe('Bravo');
    });
  });
});
