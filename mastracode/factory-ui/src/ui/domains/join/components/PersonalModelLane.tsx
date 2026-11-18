import { useState } from 'react';

import type { OnboardingDraftModel, OnboardingModelScope } from '../../workspaces/services/onboardingFlow';
import { OnboardingAccountLane } from '../../workspaces/components/onboarding/OnboardingAccountLane';
import { useAccountSource } from '../../workspaces/hooks/useAccountSource';
import { useOnboardingModelLane } from '../../workspaces/hooks/useOnboardingModelLane';

/**
 * The member's own account, exactly as the create-factory onboarding shows it: Mastra Gateway beside your own
 * provider when the factory bills the gateway per person, else the provider list (subscription sign-in or API key),
 * then the default model once connected. Connecting saves the personal credential right away; the picked
 * model becomes the personal default (`PUT /web/config/default-model`), so there is no Create step to wait for.
 */
export function PersonalModelLane({
  modelScope,
  initial,
}: {
  modelScope: OnboardingModelScope;
  initial?: OnboardingDraftModel;
}) {
  const [saved, setSaved] = useState<OnboardingDraftModel | undefined>(initial);
  const lane = useOnboardingModelLane({ scope: 'user', saved, onSave: setSaved });
  const choice = useAccountSource(lane.connection);
  return (
    <OnboardingAccountLane
      scope="user"
      name="Your account"
      lane={lane}
      choice={choice}
      // Hybrid bills the gateway to the company for work only; sessions use the member's own provider.
      offersGateway={modelScope !== 'hybrid'}
      creating={false}
      onPreviewProvider={() => undefined}
      personalNote="Used for your chats and the Slack threads you start. Change it anytime in Settings › Models."
    />
  );
}
