'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkflowId } from '@/lib/workflows';

type RunStatus = {
  status?: string;
  result?: unknown;
  error?: unknown;
  suspendedSteps?: string[];
};

type Run = RunStatus & {
  runId: string;
  workflow: WorkflowId;
};

const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled', 'bailed', 'tripwire']);

export default function Page() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startRun = useCallback(async (workflow: WorkflowId, input: Record<string, unknown>) => {
    setError(null);

    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflow, ...input }),
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? 'Failed to start run');
      return;
    }

    setRuns(current => [{ runId: body.runId, workflow, status: 'running' }, ...current]);
  }, []);

  const resumeRun = useCallback(async (runId: string, approved: boolean) => {
    setError(null);

    const response = await fetch(`/api/runs/${runId}/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approved, approver: 'sam@example.com' }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? 'Failed to resume run');
      return;
    }

    // The decision is recorded but the run has not finished replaying yet.
    // Move it off 'suspended' so the buttons go away and polling picks up the
    // real status on the next tick.
    setRuns(current => current.map(run => (run.runId === runId ? { ...run, status: 'running' } : run)));
  }, []);

  // Poll every run that hasn't finished yet.
  useEffect(() => {
    const pending = runs.filter(run => !TERMINAL_STATUSES.has(run.status ?? ''));
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      const updates = await Promise.all(
        pending.map(async run => {
          const response = await fetch(`/api/runs/${run.runId}?workflow=${run.workflow}`);
          if (!response.ok) return null;
          return { runId: run.runId, status: (await response.json()) as RunStatus };
        }),
      );

      setRuns(current =>
        current.map(run => {
          const update = updates.find(candidate => candidate?.runId === run.runId);
          return update ? { ...run, ...update.status } : run;
        }),
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [runs]);

  return (
    <>
      <h1>Mastra on the Workflow SDK</h1>
      <p>
        Both workflows below are ordinary Mastra workflows. Every step runs as a durable Workflow
        SDK step, so a run survives a server restart and can wait for a human without holding a
        function open. Run <code>npx workflow web</code> to inspect the underlying runs.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
        <button type="button" onClick={() => startRun('incrementWorkflow', { value: 0 })}>
          Start increment-workflow
        </button>
        <button type="button" onClick={() => startRun('approvalWorkflow', { amount: 250 })}>
          Start approval-workflow
        </button>
      </div>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {runs.map(run => (
            <li
              key={run.runId}
              style={{
                border: '1px solid #d4d4d4',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <strong>{run.workflow}</strong>
                <span>{run.status ?? 'unknown'}</span>
              </div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                {run.runId}
              </div>

              {run.status === 'suspended' && run.workflow === 'approvalWorkflow' ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="button" onClick={() => resumeRun(run.runId, true)}>
                    Approve
                  </button>
                  <button type="button" onClick={() => resumeRun(run.runId, false)}>
                    Reject
                  </button>
                </div>
              ) : null}

              {run.result ? (
                <pre style={{ fontSize: '0.8rem', overflowX: 'auto' }}>
                  {JSON.stringify(run.result, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
