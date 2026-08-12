import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useSetFactoryAutoRunMutation } from '../../../../hooks/useFactoryAutoRun';

/**
 * Whether rules may start agent runs on their own. Off, a proposed run waits
 * on its card until someone clicks it — the board keeps filing cards either
 * way, so this gates work, not bookkeeping.
 */
export function BoardAutoRunToggle({ factoryProjectId, enabled }: { factoryProjectId: string; enabled: boolean }) {
  const autoRun = useSetFactoryAutoRunMutation(factoryProjectId);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="text-icon3 flex items-center gap-2">
            <Txt as="span" variant="ui-sm">
              Auto-start runs
            </Txt>
            <Switch
              aria-label="Auto-start runs"
              checked={enabled}
              disabled={autoRun.isPending}
              onCheckedChange={next =>
                autoRun.mutate(next, {
                  onError: error =>
                    toast.error(error instanceof Error ? error.message : 'Failed to update automatic runs'),
                })
              }
            />
          </div>
        }
      />
      <TooltipContent side="bottom" className="max-w-80">
        Off: a review or triage a rule wants to start waits on its card until you click it. Cards still move on their
        own when a pull request merges or an issue closes.
      </TooltipContent>
    </Tooltip>
  );
}
