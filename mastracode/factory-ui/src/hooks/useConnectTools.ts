import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ConnectToolsSettings, ConnectToolsUpdateBody } from '../api/types';

const CONNECT_TOOLS_PATH = '/web/config/connect-tools';

export function useConnectToolsQuery() {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.connectTools(),
    queryFn: () => client.get<ConnectToolsSettings>(CONNECT_TOOLS_PATH),
  });
}

function withProvider(enabledProviders: string[], providerId: string, enabled: boolean): string[] {
  const others = enabledProviders.filter(id => id !== providerId);
  return enabled ? [...others, providerId].sort() : others;
}

interface ProviderToggle {
  providerId: string;
  enabled: boolean;
}

export function useSetConnectToolProviderMutation() {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.connectTools();

  const setProvider = (providerId: string, enabled: boolean) =>
    queryClient.setQueryData<ConnectToolsSettings>(key, current =>
      current ? { ...current, enabledProviders: withProvider(current.enabledProviders, providerId, enabled) } : current,
    );

  return useMutation({
    mutationKey: key,
    scope: { id: 'connect-tools' },
    onMutate: async ({ providerId, enabled }: ProviderToggle) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const wasEnabled = queryClient.getQueryData<ConnectToolsSettings>(key)?.enabledProviders.includes(providerId);
      setProvider(providerId, enabled);
      return { wasEnabled: wasEnabled === true };
    },
    mutationFn: ({ providerId, enabled }: ProviderToggle) => {
      const current = queryClient.getQueryData<ConnectToolsSettings>(key);
      if (!current) throw new Error('Tool settings are not loaded');
      const body: ConnectToolsUpdateBody = {
        enabledProviders: withProvider(current.enabledProviders, providerId, enabled),
      };
      return client.put<ConnectToolsSettings>(CONNECT_TOOLS_PATH, body);
    },
    onError: (_error, { providerId }, context) => {
      if (context) setProvider(providerId, context.wasEnabled);
    },
    onSuccess: settings => {
      // A queued toggle's optimistic state would be clobbered by this older response.
      if (queryClient.isMutating({ mutationKey: key }) <= 1) queryClient.setQueryData(key, settings);
    },
  });
}
