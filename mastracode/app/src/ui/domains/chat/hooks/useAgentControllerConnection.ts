import type { AgentControllerEvent } from '@mastra/client-js';
import { useState } from 'react';
import { getErrorDetails } from '#shared/api/errors';

import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from './useAgentControllerSessionInit';
import { useAgentControllerSessionSync } from './useAgentControllerSessionSync';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
  onEvent: (event: AgentControllerEvent) => void;
}

export function useAgentControllerConnection({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
  onEvent,
}: UseAgentControllerConnectionArgs) {
  const [sseConnectionState, setSseConnectionState] = useState<SseConnectionState>('never');
  const sseConnected = sseConnectionState === 'connected';
  const hasEverConnected = sseConnectionState !== 'never';
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });
  const initQuery = useAgentControllerSessionInit({ agentControllerId, resourceId, projectPath, baseUrl, enabled });
  const syncQuery = useAgentControllerSessionSync({
    agentControllerId,
    resourceId,
    projectPath,
    baseUrl,
    enabled: enabled && initQuery.isSuccess,
    sseConnected,
  });
  const handleConnectedChange = (connected: boolean) => {
    setSseConnectionState(current => {
      if (connected) return 'connected';
      if (current === 'connected') return 'dropped';
      return current;
    });
  };

  useAgentControllerEvents({
    session,
    enabled,
    epoch: syncQuery.dataUpdatedAt,
    onEvent,
    onConnectedChange: handleConnectedChange,
  });

  const status = deriveConnectionStatus({
    initIsError: initQuery.isError,
    syncIsError: syncQuery.isError,
    hasSyncData: Boolean(syncQuery.data),
    sseConnected,
    hasEverConnected,
    syncFailureCount: syncQuery.failureCount,
  });
  const error =
    status === 'error'
      ? getErrorDetails(initQuery.error ?? syncQuery.error, 'The MastraCode session could not connect')
      : null;

  const retry = async (): Promise<void> => {
    setSseConnectionState('never');
    const initResult = await initQuery.refetch();
    if (initResult.error) throw initResult.error;
    const syncResult = await syncQuery.refetch();
    if (syncResult.error) throw syncResult.error;
  };

  return {
    status,
    error,
    retry,
    state: syncQuery.data,
    stateUpdatedAt: syncQuery.dataUpdatedAt,
    createdThreadId: initQuery.data?.threadId ?? undefined,
  };
}

export function deriveConnectionStatus({
  initIsError,
  syncIsError,
  hasSyncData,
  sseConnected,
  hasEverConnected,
  syncFailureCount,
}: {
  initIsError: boolean;
  syncIsError: boolean;
  hasSyncData: boolean;
  sseConnected: boolean;
  hasEverConnected: boolean;
  syncFailureCount: number;
}): ConnectionStatus {
  if (initIsError || (syncIsError && !hasSyncData)) return 'error';
  if (!hasSyncData) return 'connecting';
  if (!sseConnected && syncFailureCount >= 10) return 'error';
  if (!sseConnected) return hasEverConnected ? 'reconnecting' : 'connecting';
  return 'ready';
}
