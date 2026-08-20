import type { CreateMonitorParams, UpdateMonitorParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const MONITORS_KEY = ['monitors'] as const;

export const useMonitors = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: MONITORS_KEY,
    queryFn: () => client.listMonitors(),
  });
};

export const useMonitorEvents = (monitorId?: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: [...MONITORS_KEY, monitorId, 'events'],
    queryFn: () => client.listMonitorEvents(monitorId!, { limit: 100 }),
    enabled: Boolean(monitorId),
  });
};

export const useMonitorMutations = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: MONITORS_KEY });

  const createMonitor = useMutation({
    mutationFn: (params: CreateMonitorParams) => client.createMonitor(params),
    onSuccess: invalidate,
  });

  const updateMonitor = useMutation({
    mutationFn: ({ monitorId, params }: { monitorId: string; params: UpdateMonitorParams }) =>
      client.updateMonitor(monitorId, params),
    onSuccess: invalidate,
  });

  const deleteMonitor = useMutation({
    mutationFn: (monitorId: string) => client.deleteMonitor(monitorId),
    onSuccess: invalidate,
  });

  return { createMonitor, updateMonitor, deleteMonitor };
};
