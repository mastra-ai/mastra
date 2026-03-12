import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { useIsCmsAvailable, useLinkComponent } from '@/index';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';

export const NoPromptBlocksInfo = () => {
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const { isCmsAvailable } = useIsCmsAvailable();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="No Prompt Blocks yet"
        descriptionSlot={
          <>
            Create reusable prompt blocks that can be <br />
            referenced in your agent instructions.
          </>
        }
        actionSlot={
          <div className="grid gap-3 justify-items-center">
            {isCmsAvailable && (
              <Button variant="primary" as={FrameworkLink} to={paths.cmsPromptBlockCreateLink()}>
                <Plus />
                Create Prompt Block
              </Button>
            )}
            <Button
              variant="ghost"
              as="a"
              href="https://mastra.ai/docs/agents/agent-instructions#prompt-blocks"
              target="_blank"
              rel="noopener noreferrer"
            >
              Prompts Documentation <ExternalLinkIcon />
            </Button>
          </div>
        }
      />
    </div>
  );
};
