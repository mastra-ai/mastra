import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';

import { ArrowRightIcon } from 'lucide-react';
import { AgentStepContainer } from './agent-step-container';
import { Tools } from './tools';
import { useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { useWizard } from '@/domains/agent-builder/contexts/wizard-context';
import { startViewTransition } from '@/lib/routing';

export const AgentProfileToolsStep = () => {
  const { availableAgentTools } = useEditPage();
  const { next } = useWizard();
  const isStreaming = useStreamRunning();
  const selectedToolsCount = availableAgentTools.filter(tool => tool.isChecked).length;

  const handleContinue = () => {
    startViewTransition(() => {
      next();
    });
  };

  return (
    <AgentStepContainer
      title="Available tools"
      description={
        <div className="flex items-center gap-2">
          Selected tools:{' '}
          <Badge variant="default">
            <strong className="text-neutral6 font-semibold">{selectedToolsCount}</strong>
          </Badge>
        </div>
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
      <Tools availableAgentTools={availableAgentTools} editable={!isStreaming} />
    </AgentStepContainer>
  );
};
