import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';

import type { AccountSourceChoice } from '../../hooks/useAccountSource';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { PreviewProvider } from '../../hooks/useProviderConnection';
import { OnboardingConnectGatewayButton } from './OnboardingConnectGatewayButton';
import { OnboardingGatewaySummary } from './OnboardingGatewaySummary';
import { OnboardingProviderPicker } from './OnboardingProviderPicker';

/** The lane's provider: the gateway beside your own provider when the lane offers it, else just the list. */
export function OnboardingLaneProvider({
  lane,
  choice,
  offersGateway,
  creating,
  onPreviewProvider,
}: {
  lane: OnboardingModelLane;
  choice: AccountSourceChoice;
  offersGateway: boolean;
  creating: boolean;
  onPreviewProvider: PreviewProvider;
}) {
  const { connection } = lane;
  const gateway = offersGateway ? connection.gatewayProvider : undefined;

  if (!gateway) return <OnboardingProviderPicker lane={lane} onPreviewProvider={onPreviewProvider} />;

  const onGateway = lane.connectedProvider === gateway;
  return (
    <>
      <SegmentedControl
        aria-label="Provider source"
        size="sm"
        value={choice.source}
        // Its items are not native inputs, so the creating fieldset can't lock them. A gateway connect selects
        // the gateway once it returns; switching mid-request would land it on the wrong tab.
        disabled={creating || connection.pending}
        onValueChange={next => {
          choice.choose(next);
          if (next === 'gateway') onPreviewProvider(gateway.provider, 'api_key');
          else onPreviewProvider(undefined);
        }}
        className="w-auto"
      >
        <SegmentedControlItem value="gateway" className="min-w-0 flex-1">
          Mastra Gateway
        </SegmentedControlItem>
        <SegmentedControlItem value="own" className="min-w-0 flex-1">
          Your own provider
        </SegmentedControlItem>
      </SegmentedControl>
      {choice.source === 'gateway' ? (
        <OnboardingGatewaySummary key="gateway" gateway={gateway} connected={onGateway}>
          {!onGateway && (
            <OnboardingConnectGatewayButton lane={lane} gateway={gateway} onPreviewProvider={onPreviewProvider} />
          )}
        </OnboardingGatewaySummary>
      ) : (
        // A flex column, like the lane's own, so the picker trigger stretches to the full width.
        <div key="own" className="onboarding-enter flex min-w-0 flex-col">
          <OnboardingProviderPicker lane={lane} onPreviewProvider={onPreviewProvider} />
        </div>
      )}
    </>
  );
}
