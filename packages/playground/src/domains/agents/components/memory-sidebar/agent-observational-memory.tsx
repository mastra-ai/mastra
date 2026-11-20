import { ObservationalMemoryDisplay } from '@mastra/playground-ui/domains/memory/components/observational-memory-display';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useObservationalMemoryWithHistory, useMemoryWithOMStatus, useMemoryConfig } from '@mastra/react/hooks/memory';
import { useEffect } from 'react';
import { getObservationWindowTokens } from './lib/observation-window';
import { useMemoryTimeline, useObservationalMemoryContext } from '@/domains/agents/context';

const getModelLabel = (model: unknown, modelRouting?: Array<{ upTo: number; model: string }>) => {
  if (typeof model === 'string') return model;
  if (modelRouting?.length) return 'Auto (tiered)';
  return undefined;
};

type ThresholdValue = number | { min: number; max: number };
const getThresholdValue = (threshold: ThresholdValue | undefined, defaultValue: number) => {
  if (!threshold) return defaultValue;
  return typeof threshold === 'number' ? threshold : threshold.max;
};
const getBaseThresholdValue = (threshold: ThresholdValue | undefined, defaultValue: number) => {
  if (!threshold) return defaultValue;
  return typeof threshold === 'number' ? threshold : threshold.min;
};

interface AgentObservationalMemoryProps {
  agentId: string;
  resourceId: string;
  threadId?: string;
}

export const AgentObservationalMemory = ({ agentId, resourceId, threadId }: AgentObservationalMemoryProps) => {
  const { isPanelOpen: isDetailViewOpen, openPanel: openDetailView, closePanel: closeDetailView } = useMemoryTimeline();
  const { isObservingFromStream, isReflectingFromStream, streamProgress, clearProgress } =
    useObservationalMemoryContext();

  useEffect(() => {
    clearProgress();
  }, [threadId, clearProgress]);

  // The provider retains progress across thread switches.
  const liveProgress = streamProgress?.threadId === threadId ? streamProgress : null;

  const { data: configData } = useMemoryConfig({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });

  const { data: statusData, isLoading: isStatusLoading } = useMemoryWithOMStatus({
    agentId,
    resourceId,
    threadId,
    queryOptions: { enabled: Boolean(agentId) },
  });

  // Crashed operations can leave stale server flags.
  const STALE_OBSERVATION_THRESHOLD_MS = 2 * 60 * 1000;
  const serverLastObservedAt = statusData?.observationalMemory?.lastObservedAt;
  const isServerStatusStale = serverLastObservedAt
    ? Date.now() - new Date(serverLastObservedAt).getTime() > STALE_OBSERVATION_THRESHOLD_MS
    : true;

  const hasHadStreamActivity = isObservingFromStream || isReflectingFromStream;
  const isObservingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isObserving || false);
  const isReflectingFromServer =
    !isServerStatusStale && !hasHadStreamActivity && (statusData?.observationalMemory?.isReflecting || false);
  const isObserving = isObservingFromStream || isObservingFromServer;
  const isReflecting = isReflectingFromStream || isReflectingFromServer;
  const isOMActive = isObserving || isReflecting;

  const { data: omData, isLoading: isOMLoading } = useObservationalMemoryWithHistory({
    agentId: agentId,
    resourceId: resourceId,
    threadId: threadId,
    isActive: isOMActive,
    queryOptions: {
      enabled:
        Boolean(statusData?.observationalMemory?.enabled) &&
        Boolean(agentId) &&
        (Boolean(resourceId) || Boolean(threadId)),
    },
  });

  const isLoading = isStatusLoading || isOMLoading;
  const isEnabled = statusData?.observationalMemory?.enabled ?? false;
  const record = omData?.record;

  const omAgentConfig = (
    configData?.config as {
      observationalMemory?: {
        enabled: boolean;
        model?: unknown;
        scope?: 'thread' | 'resource';
        messageTokens?: number | { min: number; max: number };
        observationTokens?: number | { min: number; max: number };
        observation?: {
          messageTokens?: number | { min: number; max: number };
          model?: string;
          routing?: Array<{ upTo: number; model: string }>;
        };
        reflection?: {
          observationTokens?: number | { min: number; max: number };
          model?: string;
          routing?: Array<{ upTo: number; model: string }>;
        };
        observationModel?: string;
        reflectionModel?: string;
        observationModelRouting?: Array<{ upTo: number; model: string }>;
        reflectionModelRouting?: Array<{ upTo: number; model: string }>;
      };
    }
  )?.observationalMemory;
  const recordConfig = record?.config as
    | {
        observation?: { messageTokens?: number; model?: string; routing?: Array<{ upTo: number; model: string }> };
        reflection?: { observationTokens?: number; model?: string; routing?: Array<{ upTo: number; model: string }> };
        observationModel?: string;
        reflectionModel?: string;
        observationModelRouting?: Array<{ upTo: number; model: string }>;
        reflectionModelRouting?: Array<{ upTo: number; model: string }>;
      }
    | undefined;

  const observationModelRouting =
    recordConfig?.observationModelRouting ??
    recordConfig?.observation?.routing ??
    omAgentConfig?.observationModelRouting ??
    omAgentConfig?.observation?.routing;
  const reflectionModelRouting =
    recordConfig?.reflectionModelRouting ??
    recordConfig?.reflection?.routing ??
    omAgentConfig?.reflectionModelRouting ??
    omAgentConfig?.reflection?.routing;

  const observationModel = getModelLabel(
    recordConfig?.observationModel ??
      recordConfig?.observation?.model ??
      omAgentConfig?.observationModel ??
      omAgentConfig?.model ??
      omAgentConfig?.observation?.model,
    observationModelRouting,
  );
  const reflectionModel = getModelLabel(
    recordConfig?.reflectionModel ??
      recordConfig?.reflection?.model ??
      omAgentConfig?.reflectionModel ??
      omAgentConfig?.model ??
      omAgentConfig?.reflection?.model,
    reflectionModelRouting,
  );

  const isAdaptiveMode = omAgentConfig?.messageTokens !== undefined && typeof omAgentConfig.messageTokens !== 'number';

  const totalBudget = isAdaptiveMode ? getThresholdValue(omAgentConfig?.messageTokens, 30000) : 0;

  const baseMessageTokens = isAdaptiveMode ? getBaseThresholdValue(omAgentConfig?.messageTokens, 30000) : undefined;
  const baseObservationTokens = isAdaptiveMode
    ? getBaseThresholdValue(omAgentConfig?.observationTokens, 40000)
    : undefined;

  const {
    messageTokens: pendingMessageTokens,
    messageThreshold: messageTokensThreshold,
    observationTokens: observationTokenCount,
    observationThreshold: observationTokensThreshold,
  } = getObservationWindowTokens({ record, liveProgress, agentConfig: omAgentConfig });

  return (
    <ObservationalMemoryDisplay
      isLoading={isLoading}
      isEnabled={isEnabled}
      pendingMessageTokens={pendingMessageTokens}
      messageTokensThreshold={messageTokensThreshold}
      isObserving={isObserving}
      observationModel={observationModel}
      observationModelRouting={observationModelRouting}
      baseMessageTokens={baseMessageTokens}
      totalBudget={totalBudget}
      observationTokenCount={observationTokenCount}
      observationTokensThreshold={observationTokensThreshold}
      isReflecting={isReflecting}
      baseObservationTokens={baseObservationTokens}
      reflectionModel={reflectionModel}
      reflectionModelRouting={reflectionModelRouting}
      onAnalyze={() => (isDetailViewOpen ? closeDetailView() : openDetailView())}
    />
  );
};
