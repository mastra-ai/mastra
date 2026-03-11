import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { useIsCmsAvailable, useLinkComponent } from '@/index';
import { CircleSlashIcon, ExternalLinkIcon, Plus } from 'lucide-react';

export const NoScorersInfo = () => {
  const { isCmsAvailable } = useIsCmsAvailable();
  const { Link, paths } = useLinkComponent();

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<CircleSlashIcon />}
        titleSlot="No Scorers yet"
        descriptionSlot={
          isCmsAvailable ? (
            <>
              Create your first scorer or configure scorers in code. <br />
              More info in the documentation.
            </>
          ) : (
            'Configure scorers in code to get started. More info in the documentation.'
          )
        }
        actionSlot={
          <div className="grid gap-3 justify-items-center">
            {isCmsAvailable && (
              <Button as={Link} to={paths.cmsScorersCreateLink()}>
                <Plus />
                Create Scorer
              </Button>
            )}
            <Button
              variant="ghost"
              as="a"
              href="https://mastra.ai/docs/evals/overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              Scorers Documentation <ExternalLinkIcon />
            </Button>
          </div>
        }
      />
    </div>
  );
};
