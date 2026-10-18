import { useCustomProvidersQuery } from '../../../../hooks/use-custom-providers';
import { useProvidersQuery } from '../../../../hooks/use-providers';

export function useProviderConnectionState() {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const anyConnected =
    (providersQuery.data ?? []).some(p => p.source !== 'none') || (customProvidersQuery.data ?? []).length > 0;
  const providersKnown = providersQuery.isSuccess && customProvidersQuery.isSuccess;
  return { anyConnected, providersKnown };
}
