import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { LinearIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';

export interface ProjectManagementFactoryStepProps {
  onConnect: () => void;
  onContinue: () => void;
}

export function ProjectManagementFactoryStep({ onConnect, onContinue }: ProjectManagementFactoryStepProps) {
  const linearStatus = useLinearStatusQuery();

  return (
    <section aria-label="Linear connection" className="border-border1 bg-surface2/80 max-w-xl rounded-2xl border p-5">
      {linearStatus.isPending ? (
        <SkeletonRows label="Loading Linear status" rows={2} rowClassName="h-12 w-full rounded-xl" />
      ) : linearStatus.data?.connected ? (
        <div className="flex flex-col gap-4">
          <Txt as="p" variant="ui-md" className="text-icon5 m-0">
            Connected to {linearStatus.data.workspace?.name ?? 'Linear'}.
          </Txt>
          <Button variant="primary" onClick={onContinue}>
            Continue
          </Button>
        </div>
      ) : (
        <EmptyState
          className="py-8"
          iconSlot={<LinearIcon className="text-icon3 size-10" />}
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
              <Button variant="ghost" onClick={onContinue}>
                Skip for now
              </Button>
            </div>
          }
        />
      )}
    </section>
  );
}
