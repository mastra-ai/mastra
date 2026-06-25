// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkflowRunContext } from '../../context/workflow-run-context';
import { WorkflowDebugStepControls } from '../workflow-debug-step-controls';
import {
  branchWorkflow,
  nestedWorkflow,
  parallelWorkflow,
  twoStepWorkflow,
} from './fixtures/workflow-debug-step-controls';

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
  it('renders nothing when the run is not paused', () => {
    renderControls(buildContext({ result: { ...pausedResult, status: 'running' } as ContextValue['result'] }));
    expect(screen.queryByTestId('workflow-debug-step-controls')).toBeNull();
  });

  it('shows controls for a paused run even when the debugMode flag is false', () => {
    // Landing directly on a paused run's :runId page starts with debugMode=false, but a run
    // can only be paused when it was started in per-step mode, so the controls must still show.
    renderControls(buildContext({ debugMode: false }));
    expect(screen.getByTestId('workflow-debug-step-controls')).not.toBeNull();
    expect(screen.getByRole('button', { name: /run next step/i })).not.toBeNull();
  });

  it('shows Run next step and Continue full run buttons while paused in debug mode', () => {
    renderControls(buildContext());

    expect(screen.getByTestId('workflow-debug-step-controls')).not.toBeNull();
    expect(screen.getByRole('button', { name: /run next step/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /continue full run/i })).not.toBeNull();
  });

  it('finishes the run when Run next step targets the last step so the end output is shown', () => {
    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    renderControls(buildContext({ timeTravelWorkflowStream }));

    fireEvent.click(screen.getByRole('button', { name: /run next step/i }));

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    expect(payload.step).toBe('transform');
    expect(payload.runId).toBe('run-1');
    expect(payload.workflowId).toBe('two-step-workflow');
    expect(payload.inputData).toEqual({ customerId: 'cus_123' });
    // transform is the last step, so the run must finish (per-step disabled) rather than
    // pause again, otherwise the user never sees the workflow's end output.
    expect(payload.perStep).toBe(false);
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

  it('skips the un-taken branch arm and targets the post-branch map step', () => {
    // start + short-text succeeded; long-text was never taken (absent from steps).
    // The next runnable step must be the post-branch map join, not the dead arm.
    const branchResult = {
      status: 'paused',
      input: { text: 'A' },
      steps: {
        start: {
          status: 'success',
          payload: { text: 'A' },
          output: { text: 'A' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        'short-text': {
          status: 'success',
          payload: { text: 'A' },
          output: { text: 'AS' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
      },
    } as ContextValue['result'];

    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    renderControls(
      buildContext({
        workflowId: 'branch-workflow',
        workflow: branchWorkflow,
        result: branchResult,
        timeTravelWorkflowStream,
      }),
    );

    const button = screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    expect(payload.step).toBe('mapping_join');
    // Only the taken arm's output is forwarded as the join context.
    expect(payload.context).toEqual({ 'short-text': { status: 'success', output: { text: 'AS' } } });
    // A normal advance re-pauses, so per-step is explicitly enabled regardless of the
    // in-memory debug flag (which is false when landing on a paused run's :runId page).
    expect(payload.perStep).toBe(true);
  });

  it('forwards the predecessor output as inputData when paused before an undecided branch', () => {
    // Paused right before the conditional: only `start` succeeded, neither branch arm has run
    // yet. The UI targets the conditional via the first arm id, but the branch decision is NOT
    // made client-side: it forwards the predecessor output as inputData so core re-evaluates the
    // condition at execution time and runs the correct (truthy) arm. Passing multiple arm ids
    // would make core treat it as nested travel and drop the conditional input, so a single arm
    // id plus the predecessor output is the correct payload shape.
    const undecidedBranchResult = {
      status: 'paused',
      input: { text: 'A' },
      steps: {
        start: {
          status: 'success',
          payload: { text: 'A' },
          output: { text: 'A' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
      },
    } as ContextValue['result'];

    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    renderControls(
      buildContext({
        workflowId: 'branch-workflow',
        workflow: branchWorkflow,
        result: undecidedBranchResult,
        timeTravelWorkflowStream,
      }),
    );

    const button = screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    // Target a single arm id and forward the predecessor output; core re-evaluates the
    // condition from this input and runs the correct (truthy) arm, not necessarily this one.
    expect(payload.step).toBe('short-text');
    expect(payload.inputData).toEqual({ text: 'A' });
    expect(payload.perStep).toBe(true);
  });

  it('advances to a still-idle parallel sibling instead of skipping it as a bypassed arm', () => {
    // start + add-letter-b succeeded; add-letter-c is still idle. Both arms share the
    // mapping_join successor, but parallel arms must each run, so the next runnable step
    // must be add-letter-c, NOT the join (which would strand the idle arm forever).
    const parallelResult = {
      status: 'paused',
      input: { letter: 'A' },
      steps: {
        start: {
          status: 'success',
          payload: { letter: 'A' },
          output: { letter: 'A' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        'add-letter-b': {
          status: 'success',
          payload: { letter: 'A' },
          output: { letter: 'AB' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
      },
    } as ContextValue['result'];

    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    renderControls(
      buildContext({
        workflowId: 'parallel-workflow',
        workflow: parallelWorkflow,
        result: parallelResult,
        timeTravelWorkflowStream,
      }),
    );

    const button = screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    expect(payload.step).toBe('add-letter-c');
    // A normal advance re-pauses, so per-step is explicitly enabled.
    expect(payload.perStep).toBe(true);
  });

  it('runs a nested workflow step atomically (perStep disabled) without leaving debug mode', () => {
    // start succeeded; nested-text-processor is the next runnable step. A nested workflow is
    // atomic from the parent's perspective, so "Run next step" must run it to completion by
    // disabling per-step for this single advance, while keeping debug mode on.
    const nestedResult = {
      status: 'paused',
      input: { text: 'A' },
      steps: {
        start: {
          status: 'success',
          payload: { text: 'A' },
          output: { text: 'A' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
      },
    } as ContextValue['result'];

    const timeTravelWorkflowStream = vi.fn().mockResolvedValue(undefined);
    const setDebugMode = vi.fn();
    renderControls(
      buildContext({
        workflowId: 'nested-workflow',
        workflow: nestedWorkflow,
        result: nestedResult,
        timeTravelWorkflowStream,
        setDebugMode,
      }),
    );

    const button = screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    expect(timeTravelWorkflowStream).toHaveBeenCalledTimes(1);
    const payload = timeTravelWorkflowStream.mock.calls[0][0];
    expect(payload.step).toBe('nested-text-processor');
    // Atomic: per-step disabled for this advance so the nested run completes...
    expect(payload.perStep).toBe(false);
    // ...but debug mode stays on for subsequent top-level steps.
    expect(setDebugMode).not.toHaveBeenCalled();
  });

  it('disables both buttons while streaming', () => {
    renderControls(buildContext(), { isStreaming: true });

    expect((screen.getByRole('button', { name: /run next step/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /continue full run/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
