import { Field, FieldContent, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Settings2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

import { useSetFactoryAutomationMutation } from '../../../../hooks/useFactoryAutomation';

function AutomationSwitch({
  label,
  description,
  enabled,
  mutation,
}: {
  label: string;
  description: string;
  enabled: boolean;
  mutation: UseMutationResult<unknown, Error, boolean>;
}) {
  return (
    <Field orientation="horizontal" className="items-start gap-4">
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch
        aria-label={label}
        checked={enabled}
        disabled={mutation.isPending}
        onCheckedChange={next => mutation.mutate(next, { onError: error => toast.error(error.message) })}
      />
    </Field>
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
    <Popover>
      <PopoverTrigger variant="default" size="icon-sm" aria-label="Automation settings" tooltip="Automation settings">
        <Settings2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]" aria-label="Automation settings">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Txt as="h2" variant="subheading">
              Automation
            </Txt>
            <Txt variant="caption" tone="muted">
              All boards in this factory.
            </Txt>
          </div>
          <AutomationSwitch
            label="Auto-start runs"
            enabled={autoRunEnabled}
            mutation={autoRun}
            description="Start incoming work automatically."
          />
          <AutomationSwitch
            label="Auto-approve plans"
            enabled={autoApprovePlans}
            mutation={autoApprove}
            description="Continue without waiting for approval."
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
