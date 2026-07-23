import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { LinearIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

interface ProjectManagementFactoryStepBaseProps {
  onConnect: () => void;
}

export type ProjectManagementFactoryStepProps = ProjectManagementFactoryStepBaseProps &
  ({ onContinue: () => void } | { completionError: string | null; finishing: boolean; onFinish: () => void });

export function ProjectManagementFactoryStep(props: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();
  const continuesOnboarding = 'onContinue' in props;
  const continuing = continuesOnboarding ? false : props.finishing;
  const continueLabel = continuesOnboarding ? 'Continue' : 'Finish setup';
  const continueSetup = continuesOnboarding ? props.onContinue : props.onFinish;

  return (
    <section aria-label="Linear connection" className="max-w-xl rounded-2xl border border-border1 bg-surface2/80 p-5">
      {linearStatus.isPending ? (
        <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />
      ) : linearStatus.data?.connected ? (
        <div className="flex flex-col gap-4">
          <Txt as="p" variant="ui-md" className="m-0 text-icon5">
            Connected to {linearStatus.data.workspace?.name ?? 'Linear'}.
          </Txt>
          <Button variant="primary" disabled={continuing} onClick={continueSetup}>
            {continuing && <Spinner size="sm" aria-label="Finishing setup" />}
            {continueLabel}
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
                  <Button variant="primary" onClick={props.onConnect}>
                    <LinearIcon />
                    {linearStatus.data?.reason === 'not_connected' ? 'Connect Linear' : 'Reconnect Linear'}
                  </Button>
                )}
              <Button variant="ghost" disabled={continuing} onClick={continueSetup}>
                {continuing && <Spinner size="sm" aria-label="Finishing setup" />}
                {continuesOnboarding ? 'Skip for now' : continueLabel}
              </Button>
            </div>
          }
        />
      )}
      {!continuesOnboarding && props.completionError && (
        <p role="alert" className="mt-4 text-ui-sm text-notice-destructive-fg">
          {props.completionError}
        </p>
      )}
    </section>
  );
}
