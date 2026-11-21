import { Txt } from '@mastra/playground-ui/components/Txt';

import { StepCard } from '../../workspaces/components/onboarding/OnboardingStepCard';
import type { FactoryModelScope } from '../../workspaces/services/github';
import { PersonalModelForm } from './PersonalModelForm';

export function ModelStep({
  index,
  modelScope,
  onSaved,
}: {
  index: number;
  modelScope: FactoryModelScope;
  onSaved: () => void;
}) {
  return (
    <StepCard
      index={index}
      label="Your model"
      notice={
        <Txt as="p" variant="caption" tone="muted" className="px-3 pb-2">
          {modelScope === 'hybrid'
            ? 'Board work runs on the company account. Your chats and the Slack threads you start run on your own account, so connect one to get going.'
            : 'Sessions in this Factory run on your own account, so connect one to get going.'}
        </Txt>
      }
    >
      <PersonalModelForm modelScope={modelScope} submitLabel="Continue" onSaved={onSaved} />
    </StepCard>
  );
}
