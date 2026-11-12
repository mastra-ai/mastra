import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  cancelBackgroundTask,
  getBackgroundProcessOutput,
  killBackgroundProcess,
  listBackgroundProcesses,
} from '../../services/background-work';
import type { BackgroundProcess } from '../../services/background-work';
import type { TimelineEntry } from '../../services/transcript';
import { backgroundExits, backgroundLaunchPid, isBackgroundLaunch, runningBackgroundTasks } from './background-work';
import type { RunningBackgroundTask } from './background-work';

// Background work ends on its own schedule, so the list is polled while any of it may still run.
const POLL_MS = 3_000;
const OUTPUT_TAIL_LINES = 200;

export interface BackgroundWorkApi {
  baseUrl: string;
  sessionId: string;
  threadId: string | undefined;
  /** Exit codes the transcript reported, by the call that started each process. */
  exits: ReadonlyMap<string, number>;
  /** The sandbox's background commands for this thread; undefined until the first read, or when it failed. */
  processes: readonly BackgroundProcess[] | undefined;
  tasks: readonly RunningBackgroundTask[];
}

const BackgroundWorkContext = createContext<BackgroundWorkApi | undefined>(undefined);

/** Undefined outside a session chat, where nothing tracks background work. */
export function useBackgroundWork(): BackgroundWorkApi | undefined {
  return useContext(BackgroundWorkContext);
}

const processesKey = (sessionId: string, threadId: string | undefined) =>
  ['background-processes', sessionId, threadId ?? null] as const;

/** Calls in the transcript that started a background process with no exit reported yet. */
function openLaunches(entries: readonly TimelineEntry[], exits: ReadonlyMap<string, number>): string[] {
  return entries.flatMap(entry =>
    entry.kind !== 'message'
      ? []
      : (entry.message.content.parts ?? []).flatMap(part => {
          if (part.type !== 'tool-invocation') return [];
          const { toolName, toolCallId } = part.toolInvocation;
          // A streamed call has its args and result on the live overlay before its part catches up.
          const runtime = entry.runtimeTools?.[toolCallId];
          const args = 'args' in part.toolInvocation ? part.toolInvocation.args : runtime?.args;
          const result = 'result' in part.toolInvocation ? part.toolInvocation.result : runtime?.result;
          const open = isBackgroundLaunch(toolName, args) && !exits.has(toolCallId) && backgroundLaunchPid(result);
          return open ? [toolCallId] : [];
        }),
  );
}

export function BackgroundWorkProvider({
  baseUrl,
  sessionId,
  threadId,
  entries,
  enabled = true,
  children,
}: {
  baseUrl: string;
  sessionId: string;
  threadId: string | undefined;
  entries: readonly TimelineEntry[];
  enabled?: boolean;
  children: ReactNode;
}) {
  const exits = useMemo(() => backgroundExits(entries), [entries]);
  const tasks = useMemo(() => runningBackgroundTasks(entries), [entries]);
  const launches = useMemo(() => openLaunches(entries, exits).join(' '), [entries, exits]);
  // Read once when the chat opens, since a command may still run after its launch left the loaded history.
  // A new launch gets a fresh read through its key; after that the list is polled only while something runs.
  const processes = useQuery({
    queryKey: [...processesKey(sessionId, threadId), launches] as const,
    queryFn: () => listBackgroundProcesses(baseUrl, sessionId, threadId),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: query => (query.state.data?.some(process => process.running) ? POLL_MS : false),
  });
  const value = useMemo(
    () => ({ baseUrl, sessionId, threadId, exits, processes: processes.data, tasks }),
    [baseUrl, sessionId, threadId, exits, processes.data, tasks],
  );
  return <BackgroundWorkContext.Provider value={value}>{children}</BackgroundWorkContext.Provider>;
}

/**
 * The newest output of a background command, polled while it is on screen until it is known to have ended. A
 * failed read is retried on the next poll: the command may still run.
 */
export function useBackgroundProcessOutput(work: BackgroundWorkApi, pid: string) {
  return useQuery({
    queryKey: ['background-process-output', work.sessionId, pid] as const,
    queryFn: () => getBackgroundProcessOutput(work.baseUrl, work.sessionId, pid, OUTPUT_TAIL_LINES),
    refetchInterval: query => (query.state.data?.running === false ? false : POLL_MS),
  });
}

export function useKillBackgroundProcess(work: BackgroundWorkApi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, toolCallId }: { pid: string; toolCallId: string }) =>
      killBackgroundProcess(work.baseUrl, work.sessionId, pid, toolCallId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: processesKey(work.sessionId, work.threadId) }),
  });
}

export function useCancelBackgroundTask(work: BackgroundWorkApi) {
  return useMutation({ mutationFn: (taskId: string) => cancelBackgroundTask(work.baseUrl, work.sessionId, taskId) });
}
