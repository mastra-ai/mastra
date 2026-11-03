import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProvidersQuery } from '../../../../../../hooks/use-providers';
import { isProviderConnected } from '../../../hooks/useProviderConnection';
import type { ProviderConnectionMethod } from '../../../hooks/useProviderConnection';

export function OnboardingPersonalConnectionStatus({
  providerId,
  method,
  local,
}: {
  providerId?: string;
  method?: ProviderConnectionMethod;
  local: boolean;
}) {
  const providers = useProvidersQuery();
  const provider = providers.data?.find(item => item.provider === providerId);
  const connected = provider ? isProviderConnected(provider, local ? undefined : 'user', method) : false;
  return (
    <Txt variant="meta" tone="muted" className="mt-2">
      {connected ? 'Connected · your account' : 'Connect your account'}
    </Txt>
  );
}
