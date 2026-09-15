import { Txt } from '@mastra/playground-ui/components/Txt';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

/**
 * Warns when a factory-wide default model is backed only by the caller's
 * personal credential (tenant mode): the model works for them but fails for
 * teammates without their own key. Renders nothing when the credential is
 * shared org-wide, auth is off, or the provider is unknown (custom providers
 * manage keys separately).
 */
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
    <Txt as="p" variant="ui-sm" className="text-icon4 m-0" role="note">
      Personal {providerDisplayName(provider.provider)} credential — teammates without their own can&apos;t run this
      model.
    </Txt>
  );
}
