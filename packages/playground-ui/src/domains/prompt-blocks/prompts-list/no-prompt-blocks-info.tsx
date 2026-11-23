import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { useLinkComponent } from '@/lib/framework';

export const NoPromptBlocksInfo = ({ canCreate }: { canCreate: boolean }) => {
  const { Link, paths } = useLinkComponent();

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
            <Button
              render={<Link href={paths.cmsPromptBlockCreateLink()} />}
              variant="primary"
              icon={<IconPlusMedium />}
            >
              Create prompt
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

            icon={<IconSquareArrowTopRight />}
          >
            Prompts documentation
          </Button>
        </div>
      }
      variant="fill"
    />
  );
};
