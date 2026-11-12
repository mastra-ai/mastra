import { useProvidersQuery } from '../../../../hooks/use-providers';

export function useProviderConnectionState() {
  const providersQuery = useProvidersQuery();
  // Custom endpoints are in this list too, at the scope they are saved at.
  const anyConnected = (providersQuery.data ?? []).some(provider => provider.source !== 'none');
  return { anyConnected, providersKnown: providersQuery.isSuccess };
}
