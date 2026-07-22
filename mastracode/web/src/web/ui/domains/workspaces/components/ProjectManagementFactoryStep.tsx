import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { LinearIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface ProjectManagementFactoryStepProps {
  completionError: string | null;
  finishing: boolean;
  onConnect: () => void;
  onFinish: () => void;
}

export function ProjectManagementFactoryStep({
  completionError,
  finishing,
  onConnect,
  onFinish,
}: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();

  return (
    <>
      <h1 className="mx-auto max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
        Connect the work behind the code.
      </h1>
      <section
        aria-label="Linear connection"
        className="mx-auto mt-8 max-w-xl rounded-2xl border border-border1 bg-surface2/80 p-5"
      >
        {linearStatus.isPending ? (
          <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />
        ) : linearStatus.data?.connected ? (
          <div className="flex flex-col gap-4">
            <Txt as="p" variant="ui-md" className="m-0 text-icon5">
              Connected to {linearStatus.data.workspace?.name ?? 'Linear'}.
            </Txt>
            <Button variant="primary" disabled={finishing} onClick={onFinish}>
              {finishing && <Spinner size="sm" aria-label="Finishing setup" />}
              Finish setup
            </Button>
          </div>
        ) : (
          <EmptyState
            className="py-8"
            iconSlot={<LinearIcon className="size-10 text-icon3" />}
            titleSlot="Connect Linear"
            descriptionSlot="Give your Factory the issue context and priorities behind your code."
            actionSlot={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {linearStatus.data?.reason !== 'missing_config' &&
                  linearStatus.data?.reason !== 'organization_required' && (
                    <Button variant="primary" onClick={onConnect}>
                      <LinearIcon />
                      {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
                    </Button>
                  )}
                <Button variant="ghost" disabled={finishing} onClick={onFinish}>
                  {finishing && <Spinner size="sm" aria-label="Finishing setup" />}
                  Skip for now
                </Button>
              </div>
            }
          />
        )}
        {completionError && (
          <p role="alert" className="mt-4 text-ui-sm text-notice-destructive-fg">
            {completionError}
          </p>
        )}
      </section>
    </>
  );
}
