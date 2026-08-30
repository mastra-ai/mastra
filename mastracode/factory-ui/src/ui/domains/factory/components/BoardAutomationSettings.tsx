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
  autoApprovePlans,
}: {
  factoryProjectId: string;
  autoRunEnabled: boolean;
  autoApprovePlans: boolean;
}) {
  const autoRun = useSetFactoryAutomationMutation(factoryProjectId, 'autoRunEnabled');
  const autoApprove = useSetFactoryAutomationMutation(factoryProjectId, 'autoApprovePlans');

  return (
    <div className="flex items-center gap-4">
      <AutomationSwitch
        label="Auto-start runs"
        enabled={autoRunEnabled}
        mutation={autoRun}
        tooltip="On: the Factory starts the runs it picks up itself (new reviews, triage). Off: a run a rule wants to start waits on its card until you click it."
      />
      <AutomationSwitch
        label="Auto-approve plans"
        enabled={autoApprovePlans}
        mutation={autoApprove}
        tooltip="On: the Factory answers a run's plan itself and work carries through to Done. Off: the plan waits for you, and an unwatched one lands in Needs attention."
      />
    </div>
  );
}
