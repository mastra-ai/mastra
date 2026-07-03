import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  buildDesktopLocalProvider,
  desktopEndpoint,
  desktopProbeProviderIdForModelUrl,
  desktopProviderNameForModelUrl,
  desktopRequest,
} from '@/lib/desktop-runtime';
import type { DesktopRuntimeState, ProbeModelsResult } from '@/lib/desktop-runtime';

export const useLLMProviders = () => {
  const client = useMastraClient();
  const endpoint = desktopEndpoint();

  const providersQuery = useQuery<ListAgentsModelProvidersResponse>({
    queryKey: ['llm-providers'],
    queryFn: async () => client.listAgentsModelProviders(),
    retry: false,
  });

  const {
    data: desktopState,
    isFetching: isDesktopStateFetching,
    isLoading: isDesktopStateLoading,
  } = useQuery({
    enabled: Boolean(endpoint),
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
    enabled: Boolean(endpoint && modelUrl?.trim()) && !isDesktopStateFetching,
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

  const data = useMemo<ListAgentsModelProvidersResponse | undefined>(() => {
    const serverProviders = providersQuery.data?.providers ?? [];
    const desktopProvider =
      desktopProbeFailed || isDesktopStateFetching
        ? undefined
        : buildDesktopLocalProvider({ probe: desktopProbe, state: desktopState });
    const nonDesktopServerProviders = serverProviders.filter(provider => !provider.id.startsWith('desktop-local/'));

    if (!desktopProvider) {
      return providersQuery.data ? { providers: nonDesktopServerProviders } : providersQuery.data;
    }

    return {
      providers: [desktopProvider, ...nonDesktopServerProviders.filter(provider => provider.id !== desktopProvider.id)],
    };
  }, [desktopProbe, desktopProbeFailed, desktopState, isDesktopStateFetching, providersQuery.data]);

  return {
    ...providersQuery,
    data,
    isFetching: providersQuery.isFetching || isDesktopStateFetching || isDesktopProbeFetching,
    isLoading:
      !data && (providersQuery.isLoading || isDesktopStateLoading || isDesktopStateFetching || isDesktopProbeFetching),
  };
};
