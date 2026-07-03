import type { Provider } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAllModels } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';
import {
  buildDesktopLocalProvider,
  desktopEndpoint,
  desktopProbeProviderIdForModelUrl,
  desktopProviderNameForModelUrl,
  desktopRequest,
} from '@/lib/desktop-runtime';
import type { DesktopRuntimeState, ProbeModelsResult } from '@/lib/desktop-runtime';

/**
 * Single source of truth for "what providers/models is the agent builder
 * allowed to use right now?".
 *
 * The server is the authority for the allowlist: `GET /editor/builder/models/available`
 * applies the active builder model policy and returns the already-filtered
 * provider/model list, so the starter, picker, and chat surfaces all render the
 * same set without any EE matcher running in the browser.
 */
export interface AgentBuilderAllowedModels {
  providers: Provider[];
  models: ModelInfo[];
  isLoading: boolean;
  desktopModelStatus?: {
    active: boolean;
    error?: string;
    providerName?: string;
    unavailable: boolean;
  };
}

export const useAgentBuilderAllowedModels = ({
  enabled = true,
}: { enabled?: boolean } = {}): AgentBuilderAllowedModels => {
  const client = useMastraClient();
  const endpoint = desktopEndpoint();

  const { data, isLoading } = useQuery({
    queryKey: ['builder-available-models'],
    queryFn: () => client.getBuilderAvailableModels(),
    enabled,
  });

  const {
    data: desktopState,
    isFetching: isDesktopStateFetching,
    isLoading: isDesktopStateLoading,
  } = useQuery({
    enabled: enabled && Boolean(endpoint),
    queryFn: () => {
      if (!endpoint) throw new Error('Desktop endpoint is not configured.');
      return desktopRequest<DesktopRuntimeState>(endpoint, '/state');
    },
    queryKey: ['desktop-runtime-state', endpoint],
    refetchOnMount: 'always',
    retry: false,
    staleTime: 0,
  });

  const modelUrl = desktopState?.settings.modelUrl;
  const modelApiKey = desktopState?.settings.modelApiKey;
  const probeProviderId = modelUrl ? desktopProbeProviderIdForModelUrl(modelUrl) : undefined;
  const probeProviderName = modelUrl ? desktopProviderNameForModelUrl(modelUrl) : undefined;

  const {
    data: desktopProbe,
    error: desktopProbeError,
    isFetching: isDesktopProbeFetching,
  } = useQuery({
    enabled: enabled && Boolean(endpoint && modelUrl?.trim()) && !isDesktopStateFetching,
    queryFn: () => {
      if (!endpoint || !modelUrl) throw new Error('Desktop model endpoint is not configured.');
      return desktopRequest<ProbeModelsResult>(endpoint, '/probe-models', {
        body: JSON.stringify({
          apiKey: modelApiKey,
          modelUrl,
          providerId: probeProviderId,
          providerName: probeProviderName,
        }),
        method: 'POST',
      });
    },
    queryKey: ['desktop-runtime-models', endpoint, probeProviderId, modelUrl, modelApiKey],
    refetchOnMount: 'always',
    retry: false,
    staleTime: 0,
  });

  const desktopProbeFailed =
    Boolean(endpoint && modelUrl?.trim()) &&
    !isDesktopStateFetching &&
    !isDesktopProbeFetching &&
    (desktopProbe?.ok === false || Boolean(desktopProbeError));
  const desktopModelMissingSettings = Boolean(
    endpoint && !isDesktopStateLoading && desktopState && !desktopState.settings.modelUrl.trim(),
  );
  const desktopProbeErrorMessage = desktopProbeError instanceof Error ? desktopProbeError.message : undefined;
  const desktopModelStatus = endpoint
    ? {
        active: true,
        ...(desktopProbe?.error || desktopProbeError ? { error: desktopProbe?.error ?? desktopProbeErrorMessage } : {}),
        ...(modelUrl ? { providerName: desktopProviderNameForModelUrl(modelUrl) } : {}),
        unavailable: desktopProbeFailed || desktopModelMissingSettings,
      }
    : undefined;

  const providers = useMemo<Provider[]>(() => {
    const serverProviders = (data?.providers as Provider[]) ?? [];
    const desktopProvider =
      desktopProbeFailed || isDesktopStateFetching
        ? undefined
        : buildDesktopLocalProvider({ probe: desktopProbe, state: desktopState });

    if (!desktopProvider) return serverProviders.filter(provider => !provider.id.startsWith('desktop-local/'));

    return [
      desktopProvider,
      ...serverProviders.filter(
        provider => provider.id !== desktopProvider.id && !provider.id.startsWith('desktop-local/'),
      ),
    ];
  }, [data, desktopProbe, desktopProbeFailed, desktopState, isDesktopStateFetching]);
  const models = useAllModels(providers);

  return {
    providers,
    models,
    isLoading: isLoading || isDesktopStateLoading || isDesktopStateFetching || isDesktopProbeFetching,
    ...(desktopModelStatus ? { desktopModelStatus } : {}),
  };
};
