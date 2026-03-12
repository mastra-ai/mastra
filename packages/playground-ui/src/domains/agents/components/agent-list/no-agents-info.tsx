import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';

export interface NoAgentsInfoProps {
  onCreateClick?: () => void;
}

export const NoAgentsInfo = ({ onCreateClick }: NoAgentsInfoProps) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Agents yet"
      descriptionSlot={
        onCreateClick
          ? 'Create your first agent or configure agents in code.'
          : 'Configure agents in code to get started.'
      }
      actionSlot={
        <div className="grid gap-3 justify-items-center">
          {onCreateClick && (
            <Button onClick={onCreateClick}>
              <Plus />
              Create Agent
            </Button>
          )}
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/docs/agents/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Agents Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
