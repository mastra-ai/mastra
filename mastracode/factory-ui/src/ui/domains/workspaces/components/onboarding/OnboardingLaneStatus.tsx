import { Notice } from '@mastra/playground-ui/components/Notice';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import { ProviderConnectionDialogs } from '../ProviderConnectionDialogs';

/**
 * What went wrong with a lane's connection, plus its key and sign-in dialogs. Cancelling a dialog keeps
 * the lane's provider, so `onCancel` puts the preview back on it.
 */
export function OnboardingLaneStatus({
  lane,
  scope,
  onCancel,
}: {
  lane: OnboardingModelLane;
  scope: 'org' | 'user';
  onCancel: () => void;
}) {
  const { connection, lostConnection } = lane;
  const lostName = lostConnection && providerDisplayName(lostConnection.providerId);
  return (
    <>
      {lostConnection?.removed && (
        <Notice variant="warning">{`${lostName} is no longer available. Choose another provider.`}</Notice>
      )}
      {lostConnection && !lostConnection.removed && (
        <Notice variant="warning">
          {`Your ${lostName} connection changed since you chose it. Connect it again or choose another provider.`}
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
        onCloseKeyDialog={saved => {
          connection.closeKeyDialog(saved);
          if (!saved) onCancel();
        }}
        onCloseOAuth={() => {
          connection.closeOAuth();
          onCancel();
        }}
        onCompleteOAuth={connection.completeOAuth}
      />
    </>
  );
}
