import { describe, it, expect } from 'vitest';
import { getWorkflowRunsNextPageParam, selectUniqueRuns, PER_PAGE } from '../use-workflow-runs';
import type { WorkflowRuns } from '@mastra/core/storage';

function makeRunsPage(runs: Array<{ runId: string; workflowName: string }>): WorkflowRuns {
  return { runs, total: runs.length } as unknown as WorkflowRuns;
}

describe('useWorkflowRuns logic', () => {
  it('paginates based on page size threshold', () => {
    const fullPage = makeRunsPage(Array.from({ length: PER_PAGE }, (_, i) => ({ runId: `r${i}`, workflowName: `Run ${i}` })));
    expect(getWorkflowRunsNextPageParam(fullPage, [], 0)).toBe(1);
    expect(getWorkflowRunsNextPageParam(makeRunsPage([{ runId: 'r0', workflowName: 'Run 0' }]), [], 0)).toBeUndefined();
  });

  it('deduplicates across pages, keeping first occurrence', () => {
    const data = {
      pages: [
        makeRunsPage([{ runId: 'aaa', workflowName: 'First' }, { runId: 'bbb', workflowName: 'Bravo' }]),
        makeRunsPage([{ runId: 'bbb', workflowName: 'Bravo (stale)' }, { runId: 'ccc', workflowName: 'Charlie' }]),
      ],
    };
    const result = selectUniqueRuns(data);
    expect(result.map(r => r.runId)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(result[1].workflowName).toBe('Bravo');
  });
});
