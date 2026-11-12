import { Notice } from '@mastra/playground-ui/components/Notice';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import { ProviderConnectionDialogs } from '../ProviderConnectionDialogs';

/** What went wrong with a lane's connection, plus its key and sign-in dialogs. */
export function OnboardingLaneStatus({ lane, scope }: { lane: OnboardingModelLane; scope: 'org' | 'user' }) {
  const { connection } = lane;
  return (
    <>
      {lane.lostConnection && connection.provider && (
        <Notice variant="warning">
          {`Your ${providerDisplayName(connection.provider.provider)} connection changed since you chose it. Connect it again or choose another provider.`}
        </Notice>
      )}
      {connection.error && (
        <Notice variant="destructive" role="alert">
          {connection.error}
        </Notice>
      )}
      <ProviderConnectionDialogs
        keyProvider={connection.keyDialogProvider}
        oauth={connection.activeOAuth}
        authEnabled={connection.authEnabled}
        fixedScope={scope}
        onCloseKeyDialog={connection.closeKeyDialog}
        onCloseOAuth={connection.closeOAuth}
        onCompleteOAuth={connection.completeOAuth}
      />
    </>
  );
}
