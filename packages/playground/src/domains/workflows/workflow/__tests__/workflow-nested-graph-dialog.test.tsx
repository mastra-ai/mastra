// @vitest-environment jsdom
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowNestedGraphDialog } from '../workflow-nested-graph-dialog';

afterEach(() => cleanup());

const stepGraph: SerializedStepFlowEntry[] = [{ type: 'step', step: { id: 'inner-step', description: '' } }];

function renderDialog() {
  return render(
    <WorkflowRunContext.Provider value={{ result: { steps: {} } } as never}>
      <ReactFlowProvider>
        <WorkflowNestedGraphDialog stepName="sub" fullStep="parent.sub" stepGraph={stepGraph} />
      </ReactFlowProvider>
    </WorkflowRunContext.Provider>,
  );
}

describe('WorkflowNestedGraphDialog', () => {
  it('keeps the dialog closed until the trigger is clicked', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'View nested graph' })).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a titled dialog rendering the nested graph when the trigger is clicked', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'View nested graph' }));

    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByText('sub workflow')).not.toBeNull();
  });

  it('closes the dialog via the close control', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'View nested graph' }));
    expect(screen.getByRole('dialog')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
