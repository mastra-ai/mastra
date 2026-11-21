import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';

import { useDefaultModelQuery, useSetDefaultModel } from '../../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { OnboardingAccountLane } from '../../workspaces/components/onboarding/OnboardingAccountLane';
import { useAccountSource } from '../../workspaces/hooks/useAccountSource';
import { useOnboardingModelLane } from '../../workspaces/hooks/useOnboardingModelLane';
import type { FactoryModelScope } from '../../workspaces/services/github';
import type { OnboardingDraftModel } from '../../workspaces/services/onboardingFlow';
import { personalLaneSelection } from '../services/memberSetup';

interface PersonalModelFormProps {
  modelScope: FactoryModelScope;
  submitLabel: string;
  onSaved?: () => void;
}

/**
 * The member's own account, as the create-factory onboarding shows it, and a button that makes the picked model
 * their personal default. Connecting a provider saves the personal credential right away (the lane's dialogs do
 * that); the button saves the model. The lane opens on what the member already connected, so it waits for that.
 */
export function PersonalModelForm(props: PersonalModelFormProps) {
  const providers = useProvidersQuery();
  const personalDefault = useDefaultModelQuery();
  if (providers.isPending || personalDefault.isPending) return null;
  const initial = personalLaneSelection(providers.data ?? [], personalDefault.data?.modelId ?? undefined);
  return <PersonalModelLaneForm initial={initial} {...props} />;
}

function PersonalModelLaneForm({
  initial,
  modelScope,
  submitLabel,
  onSaved,
}: PersonalModelFormProps & { initial: OnboardingDraftModel | undefined }) {
  const [saved, setSaved] = useState(initial);
  const lane = useOnboardingModelLane({ scope: 'user', saved, onSave: setSaved });
  const choice = useAccountSource(lane.connection);
  const setDefault = useSetDefaultModel();
  return (
    <div className="flex flex-col gap-1.5">
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
      {setDefault.isError && (
        <Notice variant="destructive">Couldn&apos;t save your default model. {setDefault.error.message}</Notice>
      )}
      <Button
        variant="primary"
        className="self-end"
        disabled={!lane.choice || setDefault.isPending}
        onClick={() => lane.choice && setDefault.mutate(lane.choice.modelId, { onSuccess: onSaved })}
      >
        {setDefault.isPending ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}
