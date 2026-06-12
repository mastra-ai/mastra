import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { hydrateRunScopeFromInternal } from './hydrate-run-scope';
import {
  AGENT_BACKGROUND_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_CONFIG_KEY,
  BACKGROUND_TASK_MANAGER_KEY,
  CURRENT_DATE_KEY,
  DELEGATION_BAILED_KEY,
  DRAIN_PENDING_SIGNALS_KEY,
  GENERATE_ID_KEY,
  INITIAL_SIGNAL_ECHOES_KEY,
  MEMORY_CONFIG_KEY,
  MEMORY_KEY,
  NOW_KEY,
  RESOURCE_ID_KEY,
  SAVE_QUEUE_MANAGER_KEY,
  SKIP_BG_TASK_WAIT_KEY,
  STEP_ACTIVE_TOOLS_KEY,
  STEP_TOOLS_KEY,
  STEP_WORKSPACE_KEY,
  THREAD_EXISTS_KEY,
  THREAD_ID_KEY,
  TOOL_PAYLOAD_TRANSFORM_KEY,
  TRANSPORT_REF_KEY,
} from './run-scope-keys';
import type { StreamInternal } from './types';

function makeMastra() {
  return new Mastra({ logger: false });
}

describe('hydrateRunScopeFromInternal', () => {
  it('is a no-op when internal is undefined', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');
    expect(() => hydrateRunScopeFromInternal(mastra, 'run-1', undefined)).not.toThrow();
    const scope = mastra.__getRunScope('run-1')!;
    expect(scope.size).toBe(0);
    mastra.__releaseRunScope('run-1');
  });

  it('is a no-op when no scope exists for the runId', () => {
    const mastra = makeMastra();
    const internal: StreamInternal = { threadId: 't' };
    // Must not throw even though no scope was created for this runId.
    expect(() => hydrateRunScopeFromInternal(mastra, 'missing-run', internal)).not.toThrow();
    expect(mastra.__getRunScope('missing-run')).toBeUndefined();
  });

  it('copies every supported bootstrap field from _internal into the scope', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');

    const now = () => 1234;
    const generateId = (() => 'id') as StreamInternal['generateId'];
    const currentDate = () => new Date(0);
    const saveQueueManager = { tag: 'saveQueueManager' } as any;
    const memory = { tag: 'memory' } as any;
    const memoryConfig = { tag: 'memoryConfig' } as any;
    const transportRef = { tag: 'transportRef' } as any;
    const backgroundTaskManager = { tag: 'backgroundTaskManager' } as any;
    const agentBackgroundConfig = { tag: 'agentBackgroundConfig' } as any;
    const backgroundTaskManagerConfig = { tag: 'backgroundTaskManagerConfig' } as any;
    const drainPendingSignals = (() => []) as StreamInternal['drainPendingSignals'];
    const initialSignalEchoes = [{ tag: 'echo' }] as any;
    const toolPayloadTransform = { tag: 'toolPayloadTransform' } as any;

    const internal: StreamInternal = {
      now,
      generateId,
      currentDate,
      saveQueueManager,
      memory,
      memoryConfig,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      threadExists: true,
      transportRef,
      backgroundTaskManager,
      agentBackgroundConfig,
      backgroundTaskManagerConfig,
      skipBgTaskWait: true,
      drainPendingSignals,
      initialSignalEchoes,
      toolPayloadTransform,
    };

    hydrateRunScopeFromInternal(mastra, 'run-1', internal);
    const scope = mastra.__getRunScope('run-1')!;

    expect(scope.get(NOW_KEY)).toBe(now);
    expect(scope.get(GENERATE_ID_KEY)).toBe(generateId);
    expect(scope.get(CURRENT_DATE_KEY)).toBe(currentDate);
    expect(scope.get(SAVE_QUEUE_MANAGER_KEY)).toBe(saveQueueManager);
    expect(scope.get(MEMORY_KEY)).toBe(memory);
    expect(scope.get(MEMORY_CONFIG_KEY)).toBe(memoryConfig);
    expect(scope.get(THREAD_ID_KEY)).toBe('thread-1');
    expect(scope.get(RESOURCE_ID_KEY)).toBe('resource-1');
    expect(scope.get(THREAD_EXISTS_KEY)).toBe(true);
    expect(scope.get(TRANSPORT_REF_KEY)).toBe(transportRef);
    expect(scope.get(BACKGROUND_TASK_MANAGER_KEY)).toBe(backgroundTaskManager);
    expect(scope.get(AGENT_BACKGROUND_CONFIG_KEY)).toBe(agentBackgroundConfig);
    expect(scope.get(BACKGROUND_TASK_MANAGER_CONFIG_KEY)).toBe(backgroundTaskManagerConfig);
    expect(scope.get(SKIP_BG_TASK_WAIT_KEY)).toBe(true);
    expect(scope.get(DRAIN_PENDING_SIGNALS_KEY)).toBe(drainPendingSignals);
    expect(scope.get(INITIAL_SIGNAL_ECHOES_KEY)).toBe(initialSignalEchoes);
    expect(scope.get(TOOL_PAYLOAD_TRANSFORM_KEY)).toBe(toolPayloadTransform);

    mastra.__releaseRunScope('run-1');
  });

  it('does NOT hydrate runtime-write fields (stepTools, stepActiveTools, stepWorkspace, _delegationBailed)', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');

    const internal: StreamInternal = {
      stepTools: { someTool: { description: 'x' } as any },
      stepActiveTools: ['someTool'],
      stepWorkspace: { tag: 'workspace' } as any,
      _delegationBailed: true,
    };

    hydrateRunScopeFromInternal(mastra, 'run-1', internal);
    const scope = mastra.__getRunScope('run-1')!;

    expect(scope.has(STEP_TOOLS_KEY)).toBe(false);
    expect(scope.has(STEP_ACTIVE_TOOLS_KEY)).toBe(false);
    expect(scope.has(STEP_WORKSPACE_KEY)).toBe(false);
    expect(scope.has(DELEGATION_BAILED_KEY)).toBe(false);
    expect(scope.size).toBe(0);

    mastra.__releaseRunScope('run-1');
  });

  it('treats falsy-but-defined values per field semantics', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');

    // threadId/resourceId guard on `!== undefined` — empty string IS hydrated.
    // threadExists/skipBgTaskWait guard on `!== undefined` — false IS hydrated.
    hydrateRunScopeFromInternal(mastra, 'run-1', {
      threadId: '',
      resourceId: '',
      threadExists: false,
      skipBgTaskWait: false,
    });

    const scope = mastra.__getRunScope('run-1')!;
    expect(scope.get(THREAD_ID_KEY)).toBe('');
    expect(scope.get(RESOURCE_ID_KEY)).toBe('');
    expect(scope.get(THREAD_EXISTS_KEY)).toBe(false);
    expect(scope.get(SKIP_BG_TASK_WAIT_KEY)).toBe(false);

    mastra.__releaseRunScope('run-1');
  });

  it('skips undefined fields (does not write `undefined` over an existing slot)', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');
    const scope = mastra.__getRunScope('run-1')!;

    // Pre-seed THREAD_ID_KEY; an internal with `threadId: undefined` must leave it alone.
    scope.set(THREAD_ID_KEY, 'pre-existing');
    hydrateRunScopeFromInternal(mastra, 'run-1', { threadId: undefined });
    expect(scope.get(THREAD_ID_KEY)).toBe('pre-existing');

    mastra.__releaseRunScope('run-1');
  });

  it('does not change refcount (caller still owns the original hold)', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('run-1');

    hydrateRunScopeFromInternal(mastra, 'run-1', { threadId: 't' });

    // Single release should drop the scope — proving hydrate did not bump refcount.
    mastra.__releaseRunScope('run-1');
    expect(mastra.__getRunScope('run-1')).toBeUndefined();
  });
});
