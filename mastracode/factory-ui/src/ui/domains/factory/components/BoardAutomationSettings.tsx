import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useSetFactoryAutoRunMutation, useSetFactoryPlanReviewMutation } from '../../../../hooks/useFactoryAutoRun';

function AutomationToggle({
  label,
  ariaLabel,
  enabled,
  tooltip,
  pending,
  onToggle,
}: {
  label: string;
  ariaLabel: string;
  enabled: boolean;
  tooltip: string;
  pending: boolean;
  onToggle: (next: boolean) => void;
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
              aria-label={ariaLabel}
              checked={enabled}
              disabled={pending}
              onCheckedChange={onToggle}
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
  const autoRun = useSetFactoryAutoRunMutation(factoryProjectId);
  const planReview = useSetFactoryPlanReviewMutation(factoryProjectId);

  const onError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback);

  return (
    <div className="flex items-center gap-4">
      <AutomationToggle
        label="Auto-start runs"
        ariaLabel="Auto-start runs"
        enabled={autoRunEnabled}
        pending={autoRun.isPending}
        tooltip={
          'On: the Factory starts runs it picks up on its own (new reviews, triage). Off: a run a rule wants to start waits on its card until you click it.'
        }
        onToggle={next =>
          autoRun.mutate(next, { onError: error => onError(error, 'Failed to update automatic runs') })
        }
      />
      <AutomationToggle
        label="Plan review"
        ariaLabel="Plan review"
        enabled={planReviewEnabled}
        pending={planReview.isPending}
        tooltip={
          'On: started work pauses at its plan until someone approves it. Off: plans are approved automatically and work carries through to Done.'
        }
        onToggle={next =>
          planReview.mutate(next, { onError: error => onError(error, 'Failed to update plan review') })
        }
      />
    </div>
  );
}
