import type {
  KnowledgeImporterRunSummary,
  KnowledgeImporterSettings,
  ListKnowledgeImportersResponse,
  SaveKnowledgeImporterSettingsParams,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The contract asks the UI to poll active runs every 2s. */
export const RUN_POLL_INTERVAL_MS = 2000;

export const importerKeys = {
  all: ['knowledge-importers'] as const,
  summaries: () => ['knowledge-importers', 'summaries'] as const,
  runs: (importerKey: string) => ['knowledge-importers', importerKey, 'runs'] as const,
  run: (runId: string | undefined) => ['knowledge-importers', 'run', runId] as const,
};

export const isRunActive = (run: KnowledgeImporterRunSummary | undefined) =>
  run?.status === 'queued' || run?.status === 'running';

// Summaries and canWrite share one cached list response; each hook selects its slice.
function useImportersList<T>(select: (response: ListKnowledgeImportersResponse) => T) {
  const client = useMastraClient();
  return useQuery({
    queryKey: importerKeys.summaries(),
    queryFn: () => client.getKnowledgeImporters().list(),
    select,
  });
}

const selectSummaries = (response: ListKnowledgeImportersResponse) => response.summaries;
const selectCanWrite = (response: ListKnowledgeImportersResponse) => response.canWrite;
const selectConnectUrl = (response: ListKnowledgeImportersResponse) => response.connectUrl ?? undefined;

export function useImporterSummaries() {
  return useImportersList(selectSummaries);
}

/** False until the list loads, so write controls never flash for read-only callers. */
export function useImporterCanWrite() {
  return useImportersList(selectCanWrite).data === true;
}

/** The project's Platform Connect settings page; undefined when the server has none configured. */
export function useImporterConnectUrl() {
  return useImportersList(selectConnectUrl).data;
}

export function useImporterRuns(importerKey: string) {
  const client = useMastraClient();
  return useQuery({
    queryKey: importerKeys.runs(importerKey),
    queryFn: async () => (await client.getKnowledgeImporters().runs(importerKey)).runs,
    refetchInterval: query => (query.state.data?.some(isRunActive) ? RUN_POLL_INTERVAL_MS : false),
  });
}

/** Polls one run until it settles, then refreshes the summaries and history it changed. */
export function useImporterRun(importerKey: string, runId: string | undefined) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: importerKeys.run(runId),
    queryFn: runId
      ? async () => {
          const run = await client.getKnowledgeImporters().getRun(runId);
          if (!isRunActive(run)) {
            void queryClient.invalidateQueries({ queryKey: importerKeys.summaries() });
            void queryClient.invalidateQueries({ queryKey: importerKeys.runs(importerKey) });
          }
          return run;
        }
      : skipToken,
    refetchInterval: query => (!query.state.data || isRunActive(query.state.data) ? RUN_POLL_INTERVAL_MS : false),
  });
}

function useStoreSummary() {
  const queryClient = useQueryClient();
  return (summary: ListKnowledgeImportersResponse['summaries'][number]) =>
    queryClient.setQueryData<ListKnowledgeImportersResponse>(importerKeys.summaries(), previous =>
      previous
        ? {
            ...previous,
            summaries: previous.summaries.map(item => (item.key === summary.key ? summary : item)),
          }
        : previous,
    );
}

export function useSaveImporterSettings(importerKey: string) {
  const client = useMastraClient();
  const storeSummary = useStoreSummary();
  return useMutation({
    mutationFn: (params: SaveKnowledgeImporterSettingsParams) =>
      client.getKnowledgeImporters().saveSettings(importerKey, params),
    onSuccess: storeSummary,
  });
}

export function useResetImporterSettings(importerKey: string) {
  const client = useMastraClient();
  const storeSummary = useStoreSummary();
  return useMutation({
    mutationFn: () => client.getKnowledgeImporters().resetSettings(importerKey),
    onSuccess: storeSummary,
  });
}

export type StartRunInput = { kind: 'dry-run'; settings: Partial<KnowledgeImporterSettings> } | { kind: 'run' };

export function useStartImporterRun(importerKey: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartRunInput) =>
      input.kind === 'dry-run'
        ? client.getKnowledgeImporters().dryRun(importerKey, input.settings)
        : client.getKnowledgeImporters().run(importerKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: importerKeys.runs(importerKey) }),
  });
}
