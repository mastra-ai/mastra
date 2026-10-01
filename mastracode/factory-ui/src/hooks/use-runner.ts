import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { RunnerPollResult, RunnerScripts, RunnerStartResult } from '../api/types';
import { readSSE } from '../ui/lib/readSSE';

/** package.json scripts at the workdir root, for the runner's quick picks. */
export function useRunnerScripts(workspacePath: string | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  const url = workspacePath ? `/web/workspace/runner/scripts?${new URLSearchParams({ workspacePath })}` : undefined;
  return useQuery<RunnerScripts>({
    queryKey: queryKeys.runnerScripts(workspacePath),
    enabled,
    staleTime: 60_000,
    queryFn: url ? () => client.get<RunnerScripts>(url) : skipToken,
  });
}

export function useRunnerStartMutation() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: (vars: { workspacePath: string; command: string }) =>
      client.post<RunnerStartResult>(
        `/web/workspace/runner/start?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { command: vars.command },
      ),
  });
}

/**
 * Live output for a run over SSE: one connection per run, frames pushed as
 * the output grows, stream closed by the server once the command exits. If
 * the connection drops mid-run (proxy idle timeout, network blip) it
 * reconnects after a short pause — the server replays the full tail-capped
 * output in the first frame, so nothing visible is lost.
 */
export function useRunnerStream(workspacePath: string | undefined, runId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const [data, setData] = useState<RunnerPollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!workspacePath || !runId) return;
    const controller = new AbortController();
    let stopped = false;

    const connect = async () => {
      while (!stopped) {
        try {
          const params = new URLSearchParams({ workspacePath, runId });
          const response = await fetch(`${baseUrl}/web/workspace/runner/stream?${params}`, {
            headers: { Accept: 'text/event-stream' },
            credentials: 'include',
            signal: controller.signal,
          });
          if (!response.ok || !response.body) throw new Error(`Runner stream failed (${response.status})`);
          let finished = false;
          await readSSE(response.body, (event, payload) => {
            if (event === 'runner') {
              const parsed = JSON.parse(payload) as RunnerPollResult;
              setData(parsed);
              if (!parsed.running) finished = true;
            } else if (event === 'runner-error') {
              const parsed = JSON.parse(payload) as { error?: string };
              setError(parsed.error ?? 'The runner stream failed.');
              finished = true;
            }
          });
          if (finished) return;
          // Stream ended without a final frame — reconnect below.
        } catch {
          if (stopped || controller.signal.aborted) return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    void connect();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [baseUrl, workspacePath, runId]);

  return { data, error };
}

export function useRunnerStopMutation() {
  const { client } = useApiConfig();
  return useMutation({
    mutationFn: (vars: { workspacePath: string; runId: string }) =>
      client.post<{ workspacePath: string; runId: string; ok: boolean }>(
        `/web/workspace/runner/stop?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { runId: vars.runId },
      ),
  });
}
