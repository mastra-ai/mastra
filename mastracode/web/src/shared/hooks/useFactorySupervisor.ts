import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ensureFactorySupervisorSession,
  getFactorySupervisorState,
  listFactorySupervisorApprovals,
  resolveFactorySupervisorApproval,
} from '../../web/ui/domains/factory/services/supervisor';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

export function useFactorySupervisorSession(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySupervisorSession(factoryProjectId),
    queryFn: () => ensureFactorySupervisorSession(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    retry: false,
    staleTime: Infinity,
  });
}

export function useFactorySupervisorState(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySupervisorState(factoryProjectId),
    queryFn: () => getFactorySupervisorState(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    refetchInterval: 5_000,
  });
}

export function useFactorySupervisorApprovals(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySupervisorApprovals(factoryProjectId),
    queryFn: () => listFactorySupervisorApprovals(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    refetchInterval: 5_000,
  });
}

export function useResolveFactorySupervisorApproval(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, decision }: { approvalId: string; decision: 'approve' | 'reject' }) =>
      resolveFactorySupervisorApproval(baseUrl, factoryProjectId!, approvalId, decision),
    onSuccess: async result => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factorySupervisorState(factoryProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.factorySupervisorApprovals(factoryProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryAuditAll(factoryProjectId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreadMessages(
            AGENT_CONTROLLER_ID,
            factoryProjectId,
            `${factoryProjectId}-supervisor`,
          ),
        }),
      ]);
      return result;
    },
  });
}
