import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ProviderInfo } from '../../../../../api/types';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { PreviewProvider } from '../../hooks/useProviderConnection';
import { FactoryDefaultModelForm } from '../FactoryDefaultModelForm';
import { MastraGatewayBilling } from '../MastraGatewayBilling';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
import { pendingGateway } from './OnboardingAccountSource';
import type { AccountSource, AccountSourceChoice } from './OnboardingAccountSource';
import { OnboardingAccountHeading } from './OnboardingAccountHeading';
import { OnboardingLaneStatus } from './OnboardingLaneStatus';
import { OnboardingInset } from './OnboardingInset';
import { OnboardingProviderPicker } from './OnboardingProviderPicker';
import { OnboardingProviderSummary, RecommendedBadge } from './OnboardingProviderSummary';

/**
 * One account the Factory runs on, inside the Model card, as its own inset. When the account can use the
 * Mastra Gateway, a switch puts it beside your own provider so both paths are visible: the gateway connects
 * in one click, your own provider opens a searchable list. Once connected, the account's default model
 * follows. The company lane uses the org credential, the personal lane yours.
 */
export function OnboardingAccountLane({
  scope,
  name,
  heading,
  lane,
  choice,
  offersGateway = true,
  onPreviewProvider,
}: {
  scope: 'org' | 'user';
  /** Group name while the account has no visible heading. */
  name: string;
  /** What the account powers and whose it is; shown when the card holds two accounts, so each needs one. */
  heading?: { label: string; detail: string; shown: boolean };
  lane: OnboardingModelLane;
  choice: AccountSourceChoice;
  /** False when this account pays itself, so the organization-billed gateway doesn't fit it. */
  offersGateway?: boolean;
  onPreviewProvider: PreviewProvider;
}) {
  const labelId = useId();
  const headed = Boolean(heading?.shown);
  return (
    <div
      role="group"
      aria-label={headed ? undefined : name}
      aria-labelledby={headed ? labelId : undefined}
      className="flex min-w-0 flex-col"
    >
      {heading && (
        <Collapsible open={heading.shown} className="onboarding-collapse">
          <CollapsibleContent className="pb-0.5">
            <OnboardingAccountHeading id={labelId} label={heading.label} detail={heading.detail} />
          </CollapsibleContent>
        </Collapsible>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {/* The account's controls sit straight in the inset, like every other section's choices: no card of
            their own, so the Model card stays two layers deep (frame, inset) whether it holds one account or two. */}
        <OnboardingInset className="gap-0 p-3">
          <div className="flex min-w-0 flex-col gap-3">
            <LaneProvider
              lane={lane}
              choice={choice}
              offersGateway={offersGateway}
              onPreviewProvider={onPreviewProvider}
            />
          </div>
          {/* The default model follows the connection, so it opens once there is one. */}
          <Collapsible open={Boolean(lane.connectedProvider)} className="onboarding-collapse">
            <CollapsibleContent className="flex min-w-0 flex-col gap-3 pt-3">
              {lane.connectedProvider && <FactoryDefaultModelForm scope={scope} lane={lane} />}
              {scope === 'user' && (
                <Txt variant="meta" tone="muted">
                  Creating this Factory also updates your personal default model.
                </Txt>
              )}
            </CollapsibleContent>
          </Collapsible>
        </OnboardingInset>
        <OnboardingLaneStatus lane={lane} scope={scope} />
      </div>
    </div>
  );
}

const SOURCES: AccountSource[] = ['gateway', 'own'];

function LaneProvider({
  lane,
  choice,
  offersGateway,
  onPreviewProvider,
}: {
  lane: OnboardingModelLane;
  choice: AccountSourceChoice;
  offersGateway: boolean;
  onPreviewProvider: PreviewProvider;
}) {
  const { connection } = lane;
  const gateway = offersGateway ? connection.gatewayProvider : undefined;

  if (connection.isPending)
    return (
      <div role="status" aria-label="Loading model providers" className="flex items-center gap-3">
        <Skeleton className="size-5 rounded-full motion-reduce:before:animate-none" />
        <Skeleton className="h-4 w-40 rounded-full motion-reduce:before:animate-none" />
      </div>
    );
  if (connection.catalogError)
    return (
      <div className="flex flex-col items-start gap-3">
        <Txt variant="caption" role="alert">
          {connection.catalogError.message}
        </Txt>
        <Button onClick={connection.retry}>Retry</Button>
      </div>
    );
  if (!gateway) return <OnboardingProviderPicker lane={lane} onPreviewProvider={onPreviewProvider} />;

  return (
    <>
      <SegmentedControl
        aria-label="Provider source"
        size="sm"
        value={choice.source}
        onValueChange={next => {
          const source = SOURCES.find(value => value === next);
          if (!source) return;
          choice.choose(source);
          if (source === 'gateway') onPreviewProvider(gateway.provider, 'api_key');
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
        <GatewaySummary key="gateway" gateway={gateway} connected={lane.connectedProvider === gateway}>
          {pendingGateway(lane, choice.source) && (
            <ConnectGatewayButton lane={lane} gateway={gateway} onPreviewProvider={onPreviewProvider} />
          )}
        </GatewaySummary>
      ) : (
        // A flex column, like the lane's own, so the picker trigger stretches to the full width.
        <div key="own" className="onboarding-enter flex min-w-0 flex-col">
          <OnboardingProviderPicker lane={lane} onPreviewProvider={onPreviewProvider} />
        </div>
      )}
    </>
  );
}

/** The gateway as the lane's provider: nothing to pick, one button connects it. */
function GatewaySummary({
  gateway,
  connected,
  children,
}: {
  gateway: ProviderInfo;
  connected: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="onboarding-enter flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <OnboardingProviderSummary
          icon={<ProviderBrandIcon provider={gateway.provider} />}
          title={providerDisplayName(gateway.provider)}
          badge={<RecommendedBadge />}
          meta={
            <Metadata>
              {connected && <Metadata.Item>Connected</Metadata.Item>}
              <Metadata.Item>
                <MastraGatewayBilling />
              </Metadata.Item>
            </Metadata>
          }
        />
      </div>
      {/* Lined up with the title, past the icon column. */}
      {children && <div className="ps-8">{children}</div>}
    </div>
  );
}

/**
 * Creates the lane's gateway key, or picks the one the account already has, and starts the lane on the
 * gateway's default model. Previews the gateway while pointed at.
 */
function ConnectGatewayButton({
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
  const verb = connection.isConfigured(gateway, 'api_key') ? 'Use' : 'Connect';
  return (
    <Button
      variant="primary"
      disabled={connection.pending || !connection.canConfigure(gateway, 'api_key')}
      onMouseEnter={preview}
      onFocus={preview}
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
  );
}
