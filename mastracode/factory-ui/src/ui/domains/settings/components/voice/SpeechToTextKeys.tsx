import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../../api/types';
import { useOrgKeyAdminQuery, useProvidersQuery } from '../../../../../hooks/use-providers';
import type { VoiceKeyStatus } from '../../../../../hooks/use-voice-settings';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { AddApiKeyDialog } from '../AddApiKeyDialog';
import { hasVoiceKey } from './key-scope';
import type { VoiceKeyScope } from './key-scope';

function keyStatusLabel({ user, org }: VoiceKeyStatus): string {
  if (user && org) return 'Personal and organization keys';
  if (user) return 'Personal key';
  if (org) return 'Organization key';
  return 'No key';
}

/** One row per speech-to-text provider, each opening the shared add-key dialog at the Factory's key scope. */
export function SpeechToTextKeys({ keys, keyScope }: { keys: VoiceKeyStatus[]; keyScope: VoiceKeyScope }) {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const [dialogProvider, setDialogProvider] = useState<ProviderInfo>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const cannotAddOrgKey = keyScope === 'org' && orgKeyAdminQuery.data === false;

  const openDialog = ({ provider, envVar }: VoiceKeyStatus) =>
    setDialogProvider(providersQuery.data?.find(p => p.provider === provider) ?? { provider, source: 'none', envVar });

  return (
    <>
      <SettingsContainer>
        {keys.map(status => {
          const name = providerDisplayName(status.provider);
          const action = hasVoiceKey(status, keyScope) ? 'Replace' : 'Add';
          return (
            <SettingsRow key={status.provider} label={name} description={keyStatusLabel(status)}>
              <Button
                size="sm"
                icon={<KeyRound />}
                disabled={cannotAddOrgKey}
                aria-label={`${action} ${name} key`}
                onClick={() => openDialog(status)}
              >
                {action} key
              </Button>
            </SettingsRow>
          );
        })}
      </SettingsContainer>
      {dialogProvider && (
        <AddApiKeyDialog
          provider={dialogProvider}
          authEnabled={authEnabled}
          fixedScope={authEnabled ? keyScope : undefined}
          onClose={() => setDialogProvider(undefined)}
        />
      )}
    </>
  );
}
