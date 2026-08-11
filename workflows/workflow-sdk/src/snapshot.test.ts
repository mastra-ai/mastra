import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { readSdkRunId, SDK_RUN_ID_SNAPSHOT_KEY, withSdkRunId } from './snapshot';

function snapshot(extra: Record<string, unknown> = {}): WorkflowRunState {
  return {
    runId: 'mastra-run',
    status: 'running',
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    waitingPaths: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    timestamp: 0,
    ...extra,
  } as WorkflowRunState;
}

describe('readSdkRunId', () => {
  it('reads the mirrored id', () => {
    expect(readSdkRunId(snapshot({ [SDK_RUN_ID_SNAPSHOT_KEY]: 'sdk-run' }))).toBe('sdk-run');
  });

  it('returns undefined for a snapshot without one', () => {
    expect(readSdkRunId(snapshot())).toBeUndefined();
    expect(readSdkRunId(null)).toBeUndefined();
    expect(readSdkRunId(snapshot({ [SDK_RUN_ID_SNAPSHOT_KEY]: '' }))).toBeUndefined();
  });
});

describe('withSdkRunId', () => {
  it('adds the id without disturbing the rest of the snapshot', () => {
    const written = withSdkRunId(snapshot({ status: 'suspended' }), 'sdk-run');

    expect(readSdkRunId(written)).toBe('sdk-run');
    expect(written.status).toBe('suspended');
  });

  it('keeps an already-stored id when the writer has none', () => {
    // Snapshots are persisted whole, so a write from a context that cannot see
    // the Workflow SDK run id must not erase one an earlier write established.
    const written = withSdkRunId(snapshot({ [SDK_RUN_ID_SNAPSHOT_KEY]: 'sdk-run' }), undefined);

    expect(readSdkRunId(written)).toBe('sdk-run');
  });

  it('leaves the snapshot alone when there is no id anywhere', () => {
    const input = snapshot();

    expect(withSdkRunId(input, undefined)).toBe(input);
  });
});
