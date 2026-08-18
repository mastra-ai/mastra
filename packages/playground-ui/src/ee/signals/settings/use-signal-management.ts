import type { CreateTraceSignalDefinitionInput, UpdateTraceSignalDefinitionInput } from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TraceSignalManagement } from '../trace-intelligence-context';
import { useTraceIntelligence } from '../use-trace-intelligence';

function requireSignalManagement(signalManagement: TraceSignalManagement | undefined) {
  if (!signalManagement) throw new Error('Signal management is not available.');
  return signalManagement;
}

export function useSignalManagementList() {
  const { cacheScope, signalManagement } = useTraceIntelligence();
  return useQuery({
    queryKey: ['trace-intelligence', cacheScope, 'signal-management'],
    queryFn: () => requireSignalManagement(signalManagement).list(),
    enabled: Boolean(signalManagement),
  });
}

export function useSignalManagementMutations() {
  const { cacheScope, signalManagement } = useTraceIntelligence();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['trace-intelligence', cacheScope, 'signal-management'] });

  return {
    create: useMutation({
      mutationFn: (input: CreateTraceSignalDefinitionInput) => requireSignalManagement(signalManagement).create(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateTraceSignalDefinitionInput }) =>
        requireSignalManagement(signalManagement).update(id, input),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => requireSignalManagement(signalManagement).archive(id),
      onSuccess: invalidate,
    }),
    restore: useMutation({
      mutationFn: (id: string) => requireSignalManagement(signalManagement).restore(id),
      onSuccess: invalidate,
    }),
    setProjectEnabled: useMutation({
      mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
        requireSignalManagement(signalManagement).setProjectEnabled(id, enabled),
      onSuccess: invalidate,
    }),
  };
}
