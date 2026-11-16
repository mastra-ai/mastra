import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId } from 'react';

import type { ProviderInfo } from '../../../../../api/types';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { PreviewProvider } from '../../hooks/useProviderConnection';

/**
 * Creates the lane's gateway key, or picks the one the account already has, and starts the lane on the
 * gateway's default model. Previews the gateway while pointed at.
 */
export function OnboardingConnectGatewayButton({
  lane,
  gateway,
  onPreviewProvider,
}: {
  lane: OnboardingModelLane;
  gateway: ProviderInfo;
  onPreviewProvider: PreviewProvider;
}) {
  const { connection } = lane;
  const preview = () => onPreviewProvider(gateway.provider, 'api_key');
  const restore = () => onPreviewProvider(undefined);
  const verb = connection.isConfigured(gateway, 'api_key') ? 'Use' : 'Connect';
  const allowed = connection.canConfigure(gateway, 'api_key');
  const reasonId = useId();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="primary"
        disabled={connection.pending || !allowed}
        aria-describedby={allowed ? undefined : reasonId}
        onMouseEnter={preview}
        onMouseLeave={restore}
        onFocus={preview}
        onBlur={restore}
        onClick={() => {
          connection.chooseGateway();
          preview();
        }}
      >
        {connection.connectingGateway ? (
          <>
            <Spinner size="sm" aria-hidden="true" />
            Connecting…
          </>
        ) : (
          `${verb} Mastra Gateway`
        )}
      </Button>
      {!allowed && (
        <Txt id={reasonId} variant="meta" tone="muted">
          Only an organization admin can connect Mastra Gateway for the company account. Choose Your own provider to use
          one that is already connected.
        </Txt>
      )}
    </div>
  );
}
