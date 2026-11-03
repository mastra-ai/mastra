import { Txt } from '@mastra/playground-ui/components/Txt';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { providerDisplayName } from '@mastra/factory/provider-display-name';

export function SharedCredentialNotice({ modelId }: { modelId?: string }) {
  const authQuery = useFactoryAuth();
  const providersQuery = useProvidersQuery();

  if (authQuery.data?.authEnabled !== true || !modelId) return null;
  const providerId = modelId.split('/')[0];
  const provider = providersQuery.data?.find(entry => entry.provider === providerId);
  if (!provider) return null;

  const personalOnly = (provider.source === 'stored-user' || provider.source === 'oauth-user') && !provider.orgKey;
  if (!personalOnly) return null;

  return (
    <Txt tone="muted" as="p" variant="caption" className="m-0" role="note">
      Personal {providerDisplayName(provider.provider)} credential. Teammates without their own can&apos;t run this
      model.
    </Txt>
  );
}
