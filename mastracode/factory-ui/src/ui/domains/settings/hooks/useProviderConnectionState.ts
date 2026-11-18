import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import { useProvidersQuery } from '../../../../hooks/use-providers';

export function useProviderConnectionState() {
  const providersQuery = useProvidersQuery();
  // An endpoint saved under a built-in provider's name keeps that provider's row unconnected.
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(provider => provider.source !== 'none') ||
    (customProvidersQuery.data ?? []).some(provider => !provider.urlProblem);
  return { anyConnected, providersKnown: providersQuery.isSuccess && customProvidersQuery.isSuccess };
}
