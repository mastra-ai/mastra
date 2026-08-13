// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useCancelWorkflowRun, useCreateWorkflowRun } from './hooks';
import { WorkflowClientContextProvider, type WorkflowClientContextType } from './workflow-client-context';

describe('workflow lifecycle hooks', () => {
  it('creates and cancels runs through the native Run resource', async () => {
    const cancel = vi.fn(async () => ({ message: 'Workflow run canceled' }));
    const createRun = vi.fn(async ({ runId }: { runId?: string } = {}) =>
      runId ? { runId, cancel } : { runId: 'run-1', cancel },
    );
    const getWorkflow = vi.fn(() => ({ createRun }));
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WorkflowClientContextProvider, {
        client: { getWorkflow } as unknown as WorkflowClientContextType,
        children,
      });

    const createHook = renderHook(() => useCreateWorkflowRun(), { wrapper });
    await act(() => createHook.result.current.mutateAsync({ workflowId: 'campaign' }));

    expect(createHook.result.current.data).toEqual({ runId: 'run-1' });
    expect(getWorkflow).toHaveBeenCalledWith('campaign');

    const cancelHook = renderHook(() => useCancelWorkflowRun(), { wrapper });
    await act(() => cancelHook.result.current.mutateAsync({ workflowId: 'campaign', runId: 'run-1' }));

    expect(createRun).toHaveBeenLastCalledWith({ runId: 'run-1' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancelHook.result.current.data).toEqual({ message: 'Workflow run canceled' });
  });
});
