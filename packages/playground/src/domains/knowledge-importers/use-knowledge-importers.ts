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
  connections: (importerId: string) => ['knowledge-importers', importerId, 'connections'] as const,
  runs: (importerId: string) => ['knowledge-importers', importerId, 'runs'] as const,
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

export function useImporterSummaries() {
  return useImportersList(selectSummaries);
}

/** False until the list loads, so write controls never flash for read-only callers. */
export function useImporterCanWrite() {
  return useImportersList(selectCanWrite).data === true;
}

export function useImporterConnections(importerId: string, enabled: boolean) {
  const client = useMastraClient();
  return useQuery({
    queryKey: importerKeys.connections(importerId),
    queryFn: enabled
      ? async () => (await client.getKnowledgeImporters().connections(importerId)).connections
      : skipToken,
  });
}

export function useImporterRuns(importerId: string) {
  const client = useMastraClient();
  return useQuery({
    queryKey: importerKeys.runs(importerId),
    queryFn: async () => (await client.getKnowledgeImporters().runs(importerId)).runs,
    refetchInterval: query => (query.state.data?.some(isRunActive) ? RUN_POLL_INTERVAL_MS : false),
  });
}

/** Polls one run until it settles, then refreshes the summaries and history it changed. */
export function useImporterRun(importerId: string, runId: string | undefined) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: importerKeys.run(runId),
    queryFn: runId
      ? async () => {
          const run = await client.getKnowledgeImporters().getRun(runId);
          if (!isRunActive(run)) {
            void queryClient.invalidateQueries({ queryKey: importerKeys.summaries() });
            void queryClient.invalidateQueries({ queryKey: importerKeys.runs(importerId) });
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
            summaries: previous.summaries.map(item => (item.importerId === summary.importerId ? summary : item)),
          }
        : previous,
    );
}

export function useSaveImporterSettings(importerId: string) {
  const client = useMastraClient();
  const storeSummary = useStoreSummary();
  return useMutation({
    mutationFn: (params: SaveKnowledgeImporterSettingsParams) =>
      client.getKnowledgeImporters().saveSettings(importerId, params),
    onSuccess: storeSummary,
  });
}

export function useResetImporterSettings(importerId: string) {
  const client = useMastraClient();
  const storeSummary = useStoreSummary();
  return useMutation({
    mutationFn: () => client.getKnowledgeImporters().resetSettings(importerId),
    onSuccess: storeSummary,
  });
}

export type StartRunInput = { kind: 'dry-run'; settings: Partial<KnowledgeImporterSettings> } | { kind: 'run' };

export function useStartImporterRun(importerId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartRunInput) =>
      input.kind === 'dry-run'
        ? client.getKnowledgeImporters().dryRun(importerId, input.settings)
        : client.getKnowledgeImporters().run(importerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: importerKeys.runs(importerId) }),
  });
}
