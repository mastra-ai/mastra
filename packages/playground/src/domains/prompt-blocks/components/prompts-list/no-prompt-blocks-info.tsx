import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ExternalLinkIcon, Plus } from 'lucide-react';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';

export const NoPromptBlocksInfo = () => {
  const { Link, paths } = useLinkComponent();
  const { isCmsAvailable, isLoading } = useIsCmsAvailable();
  const canCreate = !isLoading && isCmsAvailable;

  return (
    <EmptyState
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
            <Button render={<Link href={paths.cmsPromptBlockCreateLink()} />} variant="primary" icon={<Plus />}>
              Create Prompt
            </Button>
          )}
          <Button
            variant="ghost"
            render={
              <a
                href="https://mastra.ai/docs/editor/overview#prompt-blocks"
                target="_blank"
                rel="noopener noreferrer"
              />
            }

            icon={<ExternalLinkIcon />}
          >
            Prompts Documentation
          </Button>
        </div>
      }
      variant="fill"
    />
  );
};
