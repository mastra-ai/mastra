import { Card, IconButton, Icon, Txt } from '@mastra/playground-ui';
import { X } from 'lucide-react';
import { usePanelVisibility } from '../../context/use-panel-visibility';
import { AgentMetadata } from '../agent-metadata';

export interface OverviewCardSectionProps {
  agentId: string;
}

export function OverviewCardSection({ agentId }: OverviewCardSectionProps) {
  const { toggleOverview } = usePanelVisibility();

  return (
    <Card elevation="flat" as="section">
      <div className="flex items-center justify-between border-b border-border1 px-3 py-2">
        <Txt variant="ui-sm" className="text-neutral5 font-medium">
          Overview
        </Txt>
        <IconButton variant="ghost" size="sm" tooltip="Hide Overview" onClick={toggleOverview}>
          <Icon>
            <X />
          </Icon>
        </IconButton>
      </div>
      <AgentMetadata agentId={agentId} />
    </Card>
  );
}
