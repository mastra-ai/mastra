import { Badge, Button, Icon } from '@mastra/playground-ui';

import { ArrowRightIcon } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { AgentStepContainer } from './agent-step-container';
import { Models } from './models';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { ProviderLogo } from '@/domains/llm/components/provider-logo';
import { startViewTransition } from '@/lib/routing';

interface ActiveModelBadgeProps {
  provider: string;
  name: string;
}
const ActiveModelBadge = ({ provider, name }: ActiveModelBadgeProps) => {
  return (
    <Badge variant="default">
      <ProviderLogo providerId={provider} size={16} /> {provider}/{name}
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
      cta={
        <Button onClick={handleContinue} disabled={isStreaming}>
          Continue{' '}
          <Icon>
            <ArrowRightIcon />
          </Icon>
        </Button>
      }
    >
      <Models editable />
    </AgentStepContainer>
  );
};
