import { Card, IconButton, Icon, Txt } from '@mastra/playground-ui';
import { X } from 'lucide-react';
import { usePanelVisibility } from '../../context/use-panel-visibility';
import { AgentMemory } from './agent-memory';

export interface MemoryCardSectionProps {
  agentId: string;
  threadId: string;
  memoryType?: 'local' | 'gateway';
}

export function MemoryCardSection({ agentId, threadId, memoryType }: MemoryCardSectionProps) {
  const { toggleMemory } = usePanelVisibility();

  return (
    <Card elevation="flat" as="section">
      <div className="flex items-center justify-between border-b border-border1 px-3 py-2">
        <Txt variant="ui-sm" className="text-neutral5 font-medium">
          Memory
        </Txt>
        <IconButton variant="ghost" size="sm" tooltip="Hide Memory" onClick={toggleMemory}>
          <Icon>
            <X />
          </Icon>
        </IconButton>
      </div>
      <AgentMemory agentId={agentId} threadId={threadId} memoryType={memoryType} />
    </Card>
  );
}
