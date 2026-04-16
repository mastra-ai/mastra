import { Button, EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useLinkComponent } from '@/lib/framework';

export const NoPromptBlocksInfo = () => {
  const { Link, paths } = useLinkComponent();
  const { isCmsAvailable, isLoading } = useIsCmsAvailable();
  const canCreate = !isLoading && isCmsAvailable;

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="No Prompts yet"
        descriptionSlot={
          canCreate ? (
            <>
              Create a reusable prompt block and reference it <br />
              in your agent instructions.
            </>
          ) : (
            <>
              There are no prompt blocks yet. Prompt blocks are reusable <br />
              content that can be referenced in your agent instructions.
            </>
          )
        }
        actionSlot={
          <div className="flex flex-col items-center gap-2">
            {canCreate && (
              <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary">
                <Plus />
                Create Prompt
              </Button>
            )}
            <Button
              variant="ghost"
              as="a"
              href="https://mastra.ai/en/docs/editor/prompts"
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
