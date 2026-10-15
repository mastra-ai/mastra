import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProvidersQuery } from '../../../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../../../hooks/useFactoryAuth';
import { isProviderConnected } from '../../../hooks/useProviderConnection';
import type { ProviderConnectionMethod } from '../../../hooks/useProviderConnection';

export function OnboardingPersonalConnectionStatus({
  providerId,
  method,
}: {
  providerId?: string;
  method?: ProviderConnectionMethod;
}) {
  const providers = useProvidersQuery();
  const auth = useFactoryAuth();
  const provider = providers.data?.find(item => item.provider === providerId);
  const connected = provider
    ? isProviderConnected(provider, auth.data?.authEnabled ? 'user' : undefined, method)
    : false;
  return (
    <Txt variant="meta" tone="muted" className="mt-2">
      {connected ? 'Connected · your account' : 'Connect your account'}
    </Txt>
  );
}
