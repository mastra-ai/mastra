import { Badge, Button, Icon } from '@mastra/playground-ui';

import { ArrowRightIcon } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { AgentStepContainer } from './agent-step-container';
import { Models } from './models';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { ProviderLogo } from '@/domains/llm/components/provider-logo';
import { cleanProviderId } from '@/domains/llm/utils';
import { startViewTransition } from '@/lib/routing';

interface ActiveModelBadgeProps {
  provider: string;
  name: string;
}
const ActiveModelBadge = ({ provider, name }: ActiveModelBadgeProps) => {
  const providerId = cleanProviderId(provider);
  return (
    <Badge variant="default">
      <ProviderLogo providerId={providerId} size={16} /> {providerId}/{name}
    </Badge>
  );
};

export const AgentProfileModelStep = () => {
  const { next } = useWizard();
  const isStreaming = useStreamRunning();
  const model = useWatch({ name: 'model' });

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Available models"
      description={
        model ? (
          <div className="flex items-center gap-2">
            Selected model: <ActiveModelBadge provider={model.provider} name={model.name} />
          </div>
        ) : undefined
      }
      contentClassName="overflow-hidden"
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <Models editable={!isStreaming} />
    </AgentStepContainer>
  );
};
