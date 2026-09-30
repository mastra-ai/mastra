import { skipToken, useMutation, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { RunnerPollResult, RunnerScripts, RunnerStartResult } from '../api/types';

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

/** Poll a run's output; the interval stops once the command exits. */
export function useRunnerPoll(workspacePath: string | undefined, runId: string | undefined) {
  const { client } = useApiConfig();
  const url =
    workspacePath && runId
      ? `/web/workspace/runner/poll?${new URLSearchParams({ workspacePath, runId })}`
      : undefined;
  return useQuery<RunnerPollResult>({
    queryKey: queryKeys.runnerPoll(workspacePath, runId),
    enabled: Boolean(url),
    refetchInterval: query => (query.state.data && !query.state.data.running ? false : 1000),
    queryFn: url ? () => client.get<RunnerPollResult>(url) : skipToken,
  });
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
