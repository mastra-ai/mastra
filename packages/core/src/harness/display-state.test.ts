import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';
import { defaultDisplayState } from './types';

function createHarness(storage?: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    storage: storage ?? new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

describe('defaultDisplayState', () => {
  it('returns a fresh display state with correct defaults', () => {
    const ds = defaultDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.activeTools).toBeInstanceOf(Map);
    expect(ds.activeTools.size).toBe(0);
    expect(ds.toolInputBuffers).toBeInstanceOf(Map);
    expect(ds.toolInputBuffers.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingQuestion).toBeNull();
    expect(ds.pendingPlanApproval).toBeNull();
    expect(ds.activeSubagents).toBeInstanceOf(Map);
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.omProgress.status).toBe('idle');
    expect(ds.omProgress.pendingTokens).toBe(0);
    expect(ds.omProgress.threshold).toBe(30000);
    expect(ds.modifiedFiles).toBeInstanceOf(Map);
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
  });

  it('returns independent instances', () => {
    const ds1 = defaultDisplayState();
    const ds2 = defaultDisplayState();
    ds1.tasks.push({ content: 'test', status: 'pending', activeForm: 'Testing' });
    expect(ds2.tasks).toEqual([]);
  });
});

describe('Harness.getDisplayState()', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  it('returns display state with correct initial values', () => {
    const ds = harness.getDisplayState();
    expect(ds.isRunning).toBe(false);
    expect(ds.currentMessage).toBeNull();
    expect(ds.tokenUsage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(ds.activeTools.size).toBe(0);
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingQuestion).toBeNull();
    expect(ds.pendingPlanApproval).toBeNull();
    expect(ds.activeSubagents.size).toBe(0);
    expect(ds.modifiedFiles.size).toBe(0);
    expect(ds.tasks).toEqual([]);
    expect(ds.previousTasks).toEqual([]);
  });

  it('returns the same reference (not a copy)', () => {
    const ds1 = harness.getDisplayState();
    const ds2 = harness.getDisplayState();
    expect(ds1).toBe(ds2);
  });
});

describe('Display state updates via events', () => {
  let harness: Harness;
  let events: HarnessEvent[];

  beforeEach(() => {
    harness = createHarness();
    events = [];
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
    });
  });

  // Helpers to emit events via subscribe listener
  // Since we can't call emit() directly (it's private), we test display state
  // updates by triggering the Harness's public APIs that emit events.

  describe('task tracking', () => {
    it('tracks tasks through task_updated events', () => {
      // task_updated is emitted by the built-in task_write tool,
      // but we can verify the display state initializes correctly
      const ds = harness.getDisplayState();
      expect(ds.tasks).toEqual([]);
      expect(ds.previousTasks).toEqual([]);
    });
  });

  describe('OM progress', () => {
    it('initializes with default OM progress state', () => {
      const ds = harness.getDisplayState();
      expect(ds.omProgress.status).toBe('idle');
      expect(ds.omProgress.pendingTokens).toBe(0);
      expect(ds.omProgress.threshold).toBe(30000);
      expect(ds.omProgress.thresholdPercent).toBe(0);
      expect(ds.omProgress.observationTokens).toBe(0);
      expect(ds.omProgress.reflectionThreshold).toBe(40000);
      expect(ds.omProgress.reflectionThresholdPercent).toBe(0);
      expect(ds.omProgress.buffered.observations.status).toBe('idle');
      expect(ds.omProgress.buffered.reflection.status).toBe('idle');
      expect(ds.omProgress.generationCount).toBe(0);
      expect(ds.omProgress.stepNumber).toBe(0);
    });
  });

  describe('isRunning tracking', () => {
    it('starts as not running', () => {
      expect(harness.getDisplayState().isRunning).toBe(false);
    });

    it('matches harness.isRunning()', () => {
      expect(harness.getDisplayState().isRunning).toBe(harness.isRunning());
    });
  });
});

describe('Display state OMProgressState', () => {
  it('has correct OMProgressState shape', () => {
    const ds = defaultDisplayState();
    const omp = ds.omProgress;
    expect(omp).toHaveProperty('status');
    expect(omp).toHaveProperty('pendingTokens');
    expect(omp).toHaveProperty('threshold');
    expect(omp).toHaveProperty('thresholdPercent');
    expect(omp).toHaveProperty('observationTokens');
    expect(omp).toHaveProperty('reflectionThreshold');
    expect(omp).toHaveProperty('reflectionThresholdPercent');
    expect(omp).toHaveProperty('buffered');
    expect(omp.buffered).toHaveProperty('observations');
    expect(omp.buffered).toHaveProperty('reflection');
    expect(omp).toHaveProperty('generationCount');
    expect(omp).toHaveProperty('stepNumber');
  });
});

describe('agent_end cleanup', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  function emit(event: HarnessEvent) {
    (harness as any).emit(event);
  }

  it('clears pendingQuestion on agent_end', () => {
    emit({ type: 'ask_question', questionId: 'q1', question: 'What?', options: [] });
    expect(harness.getDisplayState().pendingQuestion).not.toBeNull();

    emit({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().pendingQuestion).toBeNull();
  });

  it('clears pendingPlanApproval on agent_end', () => {
    emit({ type: 'plan_approval_required', planId: 'p1', title: 'Plan', plan: '# Plan' });
    expect(harness.getDisplayState().pendingPlanApproval).not.toBeNull();

    emit({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().pendingPlanApproval).toBeNull();
  });

  it('marks running tools as error on agent_end', () => {
    emit({ type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('running');

    emit({ type: 'agent_end', reason: 'aborted' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('error');
  });

  it('does not change completed tools on agent_end', () => {
    emit({ type: 'tool_start', toolCallId: 't1', toolName: 'read_file', args: { path: 'test.ts' } });
    emit({ type: 'tool_end', toolCallId: 't1', toolName: 'read_file', result: 'ok', isError: false });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('completed');

    emit({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState().activeTools.get('t1')?.status).toBe('completed');
  });
});

describe('resetThreadDisplayState', () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  function emit(event: HarnessEvent) {
    (harness as any).emit(event);
  }

  it('resets omProgress on thread_created', () => {
    // Mutate omProgress via an om_observation_start event
    emit({ type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    expect(harness.getDisplayState().omProgress.status).toBe('observing');

    emit({ type: 'thread_created', threadId: 'new-thread', title: 'New' });
    expect(harness.getDisplayState().omProgress.status).toBe('idle');
    expect(harness.getDisplayState().omProgress.pendingTokens).toBe(0);
  });

  it('resets omProgress on thread_changed', () => {
    emit({ type: 'om_observation_start', cycleId: 'c1', operationType: 'observation', tokensToObserve: 5000 });
    expect(harness.getDisplayState().omProgress.status).toBe('observing');

    emit({ type: 'thread_changed', threadId: 'other-thread', title: 'Other' });
    expect(harness.getDisplayState().omProgress.status).toBe('idle');
  });
});
