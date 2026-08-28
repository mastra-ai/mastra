import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { UseMutationResult } from '@tanstack/react-query';

import { useSetFactoryAutomationMutation } from '../../../../hooks/useFactoryAutomation';

function AutomationSwitch({
  label,
  tooltip,
  enabled,
  mutation,
}: {
  label: string;
  tooltip: string;
  enabled: boolean;
  mutation: UseMutationResult<unknown, Error, boolean>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="text-icon3 flex items-center gap-2">
            <Txt as="span" variant="ui-sm">
              {label}
            </Txt>
            <Switch
              aria-label={label}
              checked={enabled}
              disabled={mutation.isPending}
              onCheckedChange={next => mutation.mutate(next, { onError: error => toast.error(error.message) })}
            />
          </div>
        }
      />
      <TooltipContent side="bottom" className="max-w-80">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function BoardAutomationSettings({
  factoryProjectId,
  autoRunEnabled,
  planReviewEnabled,
}: {
  factoryProjectId: string;
  autoRunEnabled: boolean;
  planReviewEnabled: boolean;
}) {
  const autoRun = useSetFactoryAutomationMutation(factoryProjectId, 'autoRunEnabled');
  const planReview = useSetFactoryAutomationMutation(factoryProjectId, 'planReviewEnabled');

  return (
    <div className="flex items-center gap-4">
      <AutomationSwitch
        label="Auto-start runs"
        enabled={autoRunEnabled}
        mutation={autoRun}
        tooltip="On: the Factory starts the runs it picks up itself (new reviews, triage). Off: a run a rule wants to start waits on its card until you click it."
      />
      <AutomationSwitch
        label="Plan review"
        enabled={planReviewEnabled}
        mutation={planReview}
        tooltip="On: started work pauses at its plan until someone approves it. Off: plans are approved automatically and work carries through to Done."
      />
    </div>
  );
}
