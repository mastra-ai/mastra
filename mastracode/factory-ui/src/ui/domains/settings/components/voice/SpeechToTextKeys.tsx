import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsListHeader,
  SettingsNoticeRow,
} from '@mastra/playground-ui/new/settings';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { ProviderInfo, VoiceSettingsResponse } from '../../../../../api/types';
import { useProvidersQuery } from '../../../../../hooks/use-providers';
import type { VoiceKeyStatus } from '../../../../../hooks/use-voice-settings';
import { AddApiKeyDialog } from '../AddApiKeyDialog';
import { ConnectedProviderRow } from '../models/providers/ConnectedProviderRow';
import type { ProviderConnection } from '../models/providers/ConnectedProviderRow';
import { SettingsRowsSkeleton } from '../../../../ui/SettingsRowsSkeleton';
import { CREDENTIAL_STATUS, sharedSourceStatus, useCredentialAccess } from '../provider-credential';
import { AddSpeechToTextKeyDrawer } from './AddSpeechToTextKeyDrawer';

/**
 * Deepgram only transcribes, so the chat provider catalog does not list it. An env key wins over a stored one
 * for transcription, so it is shown as such even when the catalog reports the stored key.
 */
function speechProviderInfo(status: VoiceKeyStatus, catalog: ProviderInfo[] | undefined): ProviderInfo {
  const listed = catalog?.find(p => p.provider === status.provider);
  if (status.fromEnv) return { ...listed, provider: status.provider, source: 'env', envVar: status.envVar };
  return listed ?? { provider: status.provider, source: 'stored', envVar: status.envVar };
}

function voiceKeyConnection(status: VoiceKeyStatus, provider: ProviderInfo): ProviderConnection | undefined {
  if (!status.saved) return undefined;
  const shared = sharedSourceStatus(provider.source);
  return shared
    ? { provider, status: shared, credential: undefined, signInExpired: false }
    : { provider, status: CREDENTIAL_STATUS.api_key, credential: 'api_key', signInExpired: false };
}

export function SpeechToTextKeys({ keys, scope }: { keys: VoiceKeyStatus[]; scope: VoiceSettingsResponse['scope'] }) {
  const providersQuery = useProvidersQuery();
  const { authEnabled, requestScope, actionsDisabled, memberReason } = useCredentialAccess(
    scope === 'factory' ? 'org' : 'user',
  );
  const [addOpen, setAddOpen] = useState(false);
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  if (providersQuery.isPending) return <SpeechToTextKeysSkeleton />;

  const options = keys.map(status => {
    const provider = speechProviderInfo(status, providersQuery.data);
    return { provider, connection: voiceKeyConnection(status, provider) };
  });

  const openKeyDialog = (provider: ProviderInfo) => {
    setAddOpen(false);
    setKeyDialogProvider(provider);
  };

  const connected = options.flatMap(({ connection }) => (connection ? [connection] : []));
  const addProvider = (
    <Button size="sm" icon={<Plus />} disabled={actionsDisabled} onClick={() => setAddOpen(true)}>
      Add provider
    </Button>
  );

  return (
    <>
      <SettingsContainer>
        {connected.length === 0 ? (
          <SettingsEmptyRow action={addProvider}>No speech-to-text keys</SettingsEmptyRow>
        ) : (
          <SettingsListHeader action={addProvider}>
            {connected.length === 1 ? '1 provider' : `${connected.length} providers`}
          </SettingsListHeader>
        )}
        {connected.map(connection => (
          <ConnectedProviderRow
            key={connection.provider.provider}
            variant="settings"
            connection={connection}
            requestScope={requestScope}
            disabled={actionsDisabled}
            onUpdateKey={() => setKeyDialogProvider(connection.provider)}
          />
        ))}
        {memberReason && (
          <SettingsNoticeRow>
            <Txt as="p" variant="caption" tone="muted">
              {memberReason}
            </Txt>
          </SettingsNoticeRow>
        )}
      </SettingsContainer>
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
          fixedScope={requestScope}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}
    </>
  );
}

export function SpeechToTextKeysSkeleton() {
  return (
    <SettingsContainer>
      <SettingsRowsSkeleton label="Loading providers" rows={2} />
    </SettingsContainer>
  );
}
