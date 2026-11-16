import { Collapsible, CollapsibleContent } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId } from 'react';

import type { AccountSourceChoice } from '../../hooks/useAccountSource';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { PreviewProvider } from '../../hooks/useProviderConnection';
import { FactoryDefaultModelForm } from '../FactoryDefaultModelForm';
import { OnboardingAccountHeading } from './OnboardingAccountHeading';
import { OnboardingInset } from './OnboardingInset';
import { OnboardingLaneProvider } from './OnboardingLaneProvider';
import { OnboardingLaneStatus } from './OnboardingLaneStatus';

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
  creating,
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
  /** The factory is being created: every control locks. */
  creating: boolean;
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
            <OnboardingLaneProvider
              lane={lane}
              choice={choice}
              offersGateway={offersGateway}
              creating={creating}
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
        <OnboardingLaneStatus lane={lane} scope={scope} onCancel={() => onPreviewProvider(undefined)} />
      </div>
    </div>
  );
}
