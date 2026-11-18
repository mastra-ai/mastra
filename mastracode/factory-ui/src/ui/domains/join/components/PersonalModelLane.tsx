import { useState } from 'react';

import { OnboardingAccountLane } from '../../workspaces/components/onboarding/OnboardingAccountLane';
import { useAccountSource } from '../../workspaces/hooks/useAccountSource';
import type { AccountSourceChoice } from '../../workspaces/hooks/useAccountSource';
import { useOnboardingModelLane } from '../../workspaces/hooks/useOnboardingModelLane';
import type { OnboardingModelLane } from '../../workspaces/hooks/useOnboardingModelLane';
import type { OnboardingDraftModel, OnboardingModelScope } from '../../workspaces/services/onboardingFlow';

export interface PersonalModelLaneState {
  lane: OnboardingModelLane;
  choice: AccountSourceChoice;
}

/**
 * The member's own account lane. Connecting a provider saves the personal credential right away (the lane's
 * dialogs do that); picking a model only updates `lane.choice`, so a caller that wants it as the personal
 * default saves it itself. `initial` is read once, when the lane mounts.
 */
export function usePersonalModelLane(initial?: OnboardingDraftModel): PersonalModelLaneState {
  const [saved, setSaved] = useState<OnboardingDraftModel | undefined>(initial);
  const lane = useOnboardingModelLane({ scope: 'user', saved, onSave: setSaved });
  const choice = useAccountSource(lane.connection);
  return { lane, choice };
}

/** The member's own account, as the create-factory onboarding shows it. */
export function PersonalModelLane({
  modelScope,
  state,
}: {
  modelScope: OnboardingModelScope;
  state: PersonalModelLaneState;
}) {
  return (
    <OnboardingAccountLane
      scope="user"
      name="Your account"
      lane={state.lane}
      choice={state.choice}
      // Hybrid bills the gateway to the company for work only; sessions use the member's own provider.
      offersGateway={modelScope !== 'hybrid'}
      creating={false}
      onPreviewProvider={() => undefined}
      personalNote="Used for your chats and the Slack threads you start. Change it anytime in Settings › Models."
    />
  );
}
