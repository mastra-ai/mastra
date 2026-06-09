// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowGraph } from '../workflow-graph';

afterEach(() => cleanup());

function stepGraph(stepId: string): GetWorkflowResponse['stepGraph'] {
  return [{ type: 'step', step: { id: stepId, description: '' } }] as GetWorkflowResponse['stepGraph'];
}

function makeSnapshot(runId: string, stepId: string): WorkflowRunState {
  return {
    runId,
    serializedStepGraph: stepGraph(stepId),
  } as WorkflowRunState;
}

const workflow = {
  name: 'Wf',
  stepGraph: stepGraph('static-step'),
} as unknown as GetWorkflowResponse;

function Harness({ snapshot }: { snapshot: WorkflowRunState }) {
  // The graph keys its React Flow node/edge state on the route-driven snapshot.runId,
  // mirroring how WorkflowLayout builds the snapshot from useParams().runId.
  return (
    <WorkflowRunContext.Provider value={{ snapshot } as never}>
      <WorkflowGraph workflowId="wf" workflow={workflow} />
    </WorkflowRunContext.Provider>
  );
}

describe('WorkflowGraph', () => {
  it('reflects the selected run by rendering the snapshot step graph, not the static workflow', () => {
    const { rerender } = render(<Harness snapshot={makeSnapshot('run-a', 'step-a')} />);

    expect(screen.getByText('step-a')).not.toBeNull();
    expect(screen.queryByText('static-step')).toBeNull();

    // Selecting a different run changes the snapshot's serialized graph. The graph must
    // remount so React Flow seeds fresh nodes instead of keeping the previous run's graph.
    rerender(<Harness snapshot={makeSnapshot('run-b', 'step-b')} />);

    expect(screen.getByText('step-b')).not.toBeNull();
    expect(screen.queryByText('step-a')).toBeNull();
  });

  it('remounts the graph when switching runs of the same workflow (shared step graph)', () => {
    // Two runs of the same workflow share an identical serializedStepGraph, so only the
    // snapshot.runId differs. Keying on snapshot.runId (not the graph) is what forces React
    // Flow to reseed per run — the exact case the previous graph-based key missed.
    const { rerender } = render(<Harness snapshot={makeSnapshot('run-a', 'shared-step')} />);

    const first = screen.getByText('shared-step');

    rerender(<Harness snapshot={makeSnapshot('run-b', 'shared-step')} />);

    const second = screen.getByText('shared-step');
    // A remount produces a new DOM node for the same label; same node would mean stale state.
    expect(second).not.toBe(first);
  });
});
