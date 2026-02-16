import { describe, it, expect } from 'vitest';

const PER_PAGE = 20;

// Mirrors getNextPageParam from use-workflow-runs.ts
function getNextPageParam(
  lastPage: { runs: Array<{ runId: string }> },
  _allPages: unknown,
  lastPageParam: number,
) {
  if (lastPage.runs.length < PER_PAGE) {
    return undefined;
  }
  return lastPageParam + 1;
}

// Mirrors select from use-workflow-runs.ts
function selectRuns(data: { pages: Array<{ runs: Array<{ runId: string; workflowName: string }> }> }) {
  const seen = new Set<string>();
  return data.pages.flatMap(page => page.runs).filter(run => {
    if (seen.has(run.runId)) return false;
    seen.add(run.runId);
    return true;
  });
}

describe('useWorkflowRuns logic', () => {
  it('paginates based on page size threshold', () => {
    const fullPage = { runs: Array.from({ length: PER_PAGE }, (_, i) => ({ runId: `r${i}`, workflowName: `Run ${i}` })) };
    expect(getNextPageParam(fullPage, [], 0)).toBe(1);
    expect(getNextPageParam({ runs: [{ runId: 'r0', workflowName: 'Run 0' }] }, [], 0)).toBeUndefined();
  });

  it('deduplicates across pages, keeping first occurrence', () => {
    const data = {
      pages: [
        { runs: [{ runId: 'aaa', workflowName: 'First' }, { runId: 'bbb', workflowName: 'Bravo' }] },
        { runs: [{ runId: 'bbb', workflowName: 'Bravo (stale)' }, { runId: 'ccc', workflowName: 'Charlie' }] },
      ],
    };
    const result = selectRuns(data);
    expect(result.map(r => r.runId)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(result[1].workflowName).toBe('Bravo');
  });
});
