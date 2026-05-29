import type {
  Heartbeat,
  HeartbeatTrigger,
  ListHeartbeatTriggersResponse,
  RunHeartbeatResponse,
  UpdateHeartbeatOptions,
} from '@mastra/client-js';
import { toast, useInView } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const TRIGGERS_PER_PAGE = 25;

export type UseHeartbeatsParams = {
  agentId?: string;
};

/**
 * Lists heartbeats across all agents, or scoped to one when `agentId` is
 * provided. Backed by the dedicated `/heartbeats` server surface — the
 * underlying schedule + workflow is hidden from callers.
 */
export const useHeartbeats = (params: UseHeartbeatsParams = {}) => {
  const client = useMastraClient();

  return useQuery<Heartbeat[]>({
    queryKey: ['heartbeats', params],
    queryFn: () => client.listHeartbeats(params.agentId ? { agentId: params.agentId } : {}),
  });
};

/**
 * Fetches a single heartbeat. Requires both `agentId` (owner) and
 * `heartbeatId`. The agent-scoped route 404s when the caller does not own
 * the heartbeat, so the call must know who owns it.
 */
export const useHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();

  return useQuery<Heartbeat>({
    queryKey: ['heartbeat', agentId, heartbeatId],
    enabled: !!agentId && !!heartbeatId,
    queryFn: () => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).getHeartbeat(heartbeatId);
    },
  });
};

/**
 * Patches an existing heartbeat (cron, prompt, timezone, signal options,
 * activeHours, metadata, etc.). Invalidates the detail and list queries on
 * success.
 */
export const useUpdateHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<Heartbeat, Error, UpdateHeartbeatOptions>({
    mutationFn: patch => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).updateHeartbeat(heartbeatId, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['heartbeat', agentId, heartbeatId] });
      void queryClient.invalidateQueries({ queryKey: ['heartbeats'] });
      toast.success('Heartbeat updated');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};

/**
 * Deletes a heartbeat. Invalidates the list query and clears the detail
 * query on success. Callers typically navigate back to `/heartbeats` from
 * `onSuccess`.
 */
export const useDeleteHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, void>({
    mutationFn: () => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).deleteHeartbeat(heartbeatId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['heartbeats'] });
      queryClient.removeQueries({ queryKey: ['heartbeat', agentId, heartbeatId] });
      toast.success('Heartbeat deleted');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};

/**
 * Pauses an active heartbeat. Idempotent.
 */
export const usePauseHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<Heartbeat, Error, void>({
    mutationFn: () => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).pauseHeartbeat(heartbeatId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['heartbeat', agentId, heartbeatId] });
      void queryClient.invalidateQueries({ queryKey: ['heartbeats'] });
      toast.success('Heartbeat paused');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};

/**
 * Resumes a paused heartbeat. Recomputes `nextFireAt` server-side so a
 * long-paused heartbeat does not fire a backlog. Idempotent.
 */
export const useResumeHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<Heartbeat, Error, void>({
    mutationFn: () => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).resumeHeartbeat(heartbeatId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['heartbeat', agentId, heartbeatId] });
      void queryClient.invalidateQueries({ queryKey: ['heartbeats'] });
      toast.success('Heartbeat resumed');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};

/**
 * Manually fires a heartbeat once, out-of-band from its cron schedule.
 * Runs through the same `HeartbeatWorker` pipeline as a scheduled fire and
 * records a trigger row with `triggerKind: 'manual'`. Does not advance
 * `nextFireAt`.
 */
export const useRunHeartbeat = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<RunHeartbeatResponse, Error, void>({
    mutationFn: () => {
      if (!agentId || !heartbeatId) throw new Error('agentId and heartbeatId are required');
      return client.getAgent(agentId).runHeartbeat(heartbeatId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['heartbeat-triggers', agentId, heartbeatId] });
      toast.success('Heartbeat fired');
    },
    onError: error => {
      toast.error(error.message);
    },
  });
};

/**
 * Paginated trigger history for a heartbeat, ordered by `actualFireAt`
 * descending. Auto-fetches the next page when the end-of-list sentinel
 * comes into view.
 */
export const useHeartbeatTriggers = (agentId: string | undefined, heartbeatId: string | undefined) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['heartbeat-triggers', agentId, heartbeatId],
    enabled: !!agentId && !!heartbeatId,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }): Promise<ListHeartbeatTriggersResponse> => {
      if (!agentId || !heartbeatId) return { triggers: [] as HeartbeatTrigger[] };
      return client.getAgent(agentId).listHeartbeatTriggers(heartbeatId, {
        limit: TRIGGERS_PER_PAGE,
        toActualFireAt: pageParam,
      });
    },
    getNextPageParam: lastPage => {
      if (!lastPage?.triggers?.length || lastPage.triggers.length < TRIGGERS_PER_PAGE) {
        return undefined;
      }
      return lastPage.triggers[lastPage.triggers.length - 1]!.actualFireAt;
    },
    refetchInterval: query => {
      const triggers = query.state.data?.pages.flatMap(p => p.triggers) ?? [];
      const hasActive = triggers.some(t => {
        if (!t.run) return t.outcome === 'published';
        return t.run.status === 'pending' || t.run.status === 'running' || t.run.status === 'waiting';
      });
      return hasActive ? 5_000 : false;
    },
  });

  const triggers = query.data?.pages.flatMap(page => page?.triggers ?? []) ?? [];

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, data: triggers, setEndOfListElement };
};
