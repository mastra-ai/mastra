import { useCallback, useState } from 'react';

import type { WorkflowRunStreamResult } from './workflow-run-context';

type RunResultOverride = { runId: string; result: WorkflowRunStreamResult };
type LocalRun = { runId: string; payload: unknown; override: RunResultOverride | null };

const NO_LOCAL_RUN: LocalRun = { runId: '', payload: null, override: null };

export function useLocalRun(initialRunId: string | undefined) {
  const [localRun, setLocalRun] = useState(NO_LOCAL_RUN);
  const runId = initialRunId ?? localRun.runId;
  const override = localRun.override?.runId === runId ? localRun.override.result : null;

  const setRunId = useCallback((runId: string) => setLocalRun(current => ({ ...current, runId })), []);
  const setPayload = useCallback((payload: unknown) => setLocalRun(current => ({ ...current, payload })), []);
  const setResult = useCallback(
    (result: WorkflowRunStreamResult | null) =>
      setLocalRun(current => ({
        ...current,
        override: result && { runId: initialRunId ?? current.runId, result },
      })),
    [initialRunId],
  );
  const dropOverride = useCallback(
    (runId: string) =>
      setLocalRun(current => (current.override?.runId === runId ? { ...current, override: null } : current)),
    [],
  );
  const reset = useCallback(() => setLocalRun(NO_LOCAL_RUN), []);

  return { runId, payload: localRun.payload, override, setRunId, setPayload, setResult, dropOverride, reset };
}
