// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowDebugStepControls } from '../workflow-debug-step-controls';
import { twoStepWorkflow } from './fixtures/workflow-debug-step-controls';

afterEach(() => cleanup());

type ContextValue = React.ComponentProps<typeof WorkflowRunContext.Provider>['value'];

const pausedResult = {
  status: 'paused',
  input: { request: true },
  steps: {
    extract: {
      status: 'success',
      payload: { request: true },
      output: { customerId: 'cus_123' },
      startedAt: Date.now(),
      endedAt: Date.now(),
    },
  },
} as ContextValue['result'];

const buildContext = (overrides: Partial<ContextValue> = {}): ContextValue =>
  ({
    workflowId: 'two-step-workflow',
    workflow: twoStepWorkflow,
    runId: 'run-1',
    result: pausedResult,
    debugMode: true,
    setDebugMode: vi.fn(),
    timeTravelWorkflowStream: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as ContextValue;

const renderControls = (value: ContextValue, props = {}) =>
  render(
    <WorkflowRunContext.Provider value={value}>
      <WorkflowDebugStepControls {...props} />
    </WorkflowRunContext.Provider>,
  );

describe('WorkflowDebugStepControls', () => {
  it('renders nothing when not in debug mode', () => {
    renderControls(buildContext({ debugMode: false }));
    expect(screen.queryByTestId('workflow-debug-step-controls')).toBeNull();
  });

  it('renders nothing when the run is not paused', () => {
    renderControls(buildContext({ result: { ...pausedResult, status: 'running' } as ContextValue['result'] }));
    expect(screen.queryByTestId('workflow-debug-step-controls')).toBeNull();
  });

  it('shows Run next step and Continue full run buttons while paused in debug mode', () => {
    renderControls(buildContext());

    expect(screen.getByTestId('workflow-debug-step-controls')).not.toBeNull();
    expect(screen.getByRole('button', { name: /run next step/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /continue full run/i })).not.toBeNull();
  });

  it('runs the resolved next step with perStep semantics when clicking Run next step', () => {
    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    renderControls(buildContext({ timeTravelWorkflowStream }));

    fireEvent.click(screen.getByRole('button', { name: /run next step/i }));

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    expect(payload.step).toBe('transform');
    expect(payload.runId).toBe('run-1');
    expect(payload.workflowId).toBe('two-step-workflow');
    expect(payload.inputData).toEqual({ customerId: 'cus_123' });
    expect(payload.perStep).toBeUndefined();
  });

  it('continues the full run and disables debug mode when clicking Continue full run', () => {
    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    const setDebugMode = vi.fn();
    renderControls(buildContext({ timeTravelWorkflowStream, setDebugMode }));

    fireEvent.click(screen.getByRole('button', { name: /continue full run/i }));

    expect(setDebugMode).toHaveBeenCalledWith(false);
    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    expect(timeTravelWorkflowStream.mock.calls[0][0].perStep).toBe(false);
  });

  it('disables Run next step when no next step can be resolved', () => {
    const completedResult = {
      status: 'paused',
      input: { request: true },
      steps: {
        extract: {
          status: 'success',
          payload: { request: true },
          output: { customerId: 'cus_123' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        transform: {
          status: 'success',
          payload: { customerId: 'cus_123' },
          output: { done: true },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
      },
    } as ContextValue['result'];

    renderControls(buildContext({ result: completedResult }));

    const button = screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables both buttons while streaming', () => {
    renderControls(buildContext(), { isStreaming: true });

    expect((screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /continue full run/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
