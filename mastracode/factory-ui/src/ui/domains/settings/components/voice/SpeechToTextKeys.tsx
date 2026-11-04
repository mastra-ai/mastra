import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../../api/types';
import { useOrgKeyAdminQuery, useProvidersQuery } from '../../../../../hooks/use-providers';
import type { VoiceKeyStatus, VoiceSettings } from '../../../../../hooks/use-voice-settings';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { AddApiKeyDialog } from '../AddApiKeyDialog';
import { ConnectedProviderRow } from '../models/providers/ConnectedProviderRow';
import type { ProviderConnection } from '../models/providers/ConnectedProviderRow';
import { ProviderRows, ProviderRowsSkeleton } from '../models/providers/ProviderRows';
import {
  CREDENTIAL_STATUS,
  ORG_SCOPE_MEMBER_REASON,
  sharedSourceStatus,
  storedCredentialScope,
} from '../provider-credential';
import { AddSpeechToTextKeyDrawer } from './AddSpeechToTextKeyDrawer';

/** Deepgram only transcribes, so the chat provider catalog does not list it. */
function speechProviderInfo(status: VoiceKeyStatus, catalog: ProviderInfo[] | undefined): ProviderInfo {
  return (
    catalog?.find(p => p.provider === status.provider) ?? {
      provider: status.provider,
      source: 'none',
      envVar: status.envVar,
    }
  );
}

function voiceKeyConnection(status: VoiceKeyStatus, provider: ProviderInfo): ProviderConnection | undefined {
  if (!status.saved) return undefined;
  const shared = sharedSourceStatus(provider.source);
  return shared
    ? { provider, status: shared, credential: undefined, signInExpired: false }
    : { provider, status: CREDENTIAL_STATUS.api_key, credential: 'api_key', signInExpired: false };
}

export function SpeechToTextKeys({ keys, scope }: { keys: VoiceKeyStatus[]; scope: VoiceSettings['scope'] }) {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  if (providersQuery.isPending) return <ProviderRowsSkeleton />;

  const authEnabled = authQuery.data?.authEnabled === true;
  const credentialScope = storedCredentialScope(scope === 'factory' ? 'org' : 'user', authEnabled);
  const readOnly = credentialScope === 'org' && orgKeyAdminQuery.data === false;
  const actionsDisabled = authQuery.isPending || readOnly;
  const options = keys.map(status => {
    const provider = speechProviderInfo(status, providersQuery.data);
    return { provider, connection: voiceKeyConnection(status, provider) };
  });

  const openKeyDialog = (provider: ProviderInfo) => {
    setAddOpen(false);
    setKeyDialogProvider(provider);
  };

  return (
    <div className="flex flex-col gap-2">
      <ProviderRows addDisabled={actionsDisabled} onAdd={() => setAddOpen(true)}>
        {options.flatMap(({ connection }) =>
          connection ? (
            <ConnectedProviderRow
              key={connection.provider.provider}
              connection={connection}
              requestScope={authEnabled ? credentialScope : undefined}
              disabled={actionsDisabled}
              onUpdateKey={() => setKeyDialogProvider(connection.provider)}
            />
          ) : (
            []
          ),
        )}
      </ProviderRows>
      {readOnly && (
        <Txt as="p" variant="caption" tone="muted">
          {ORG_SCOPE_MEMBER_REASON}
        </Txt>
      )}
      <AddSpeechToTextKeyDrawer
        open={addOpen}
        options={options.map(({ provider, connection }) => ({ provider, connectedAs: connection?.status.label }))}
        onAddKey={openKeyDialog}
        onClose={() => setAddOpen(false)}
      />
      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authEnabled}
          fixedScope={authEnabled ? credentialScope : undefined}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}
    </div>
  );
}
