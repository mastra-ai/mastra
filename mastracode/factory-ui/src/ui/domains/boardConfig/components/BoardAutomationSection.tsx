import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseMutationResult } from '@tanstack/react-query';

import { useSetFactoryAutomationMutation } from '../../../../hooks/useFactoryAutomation';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';

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
    <SettingsRow label={label} description={description}>
      <Switch
        aria-label={label}
        checked={enabled}
        disabled={mutation.isPending}
        onCheckedChange={next => mutation.mutate(next, { onError: error => toast.error(error.message) })}
      />
    </SettingsRow>
  );
}

/** Factory-wide automation switches. They save as they flip, apart from the board's draft. */
export function BoardAutomationSection({
  factoryProjectId,
  autoRunEnabled,
  reviewTestChecksEnabled,
  selfReviewEnabled,
}: {
  factoryProjectId: string;
  autoRunEnabled: boolean;
  reviewTestChecksEnabled: boolean;
  selfReviewEnabled: boolean;
}) {
  const autoRun = useSetFactoryAutomationMutation(factoryProjectId, 'autoRunEnabled');
  const testChecks = useSetFactoryAutomationMutation(factoryProjectId, 'reviewTestChecksEnabled');
  const selfReview = useSetFactoryAutomationMutation(factoryProjectId, 'selfReviewEnabled');

  return (
    <SettingsSubsection title="Automation" scope="factory">
      <SettingsContainer>
        <AutomationSwitch
          label="Auto-start runs"
          enabled={autoRunEnabled}
          mutation={autoRun}
          description="Start incoming work automatically."
        />
        <AutomationSwitch
          label="Self-review before pull requests"
          enabled={selfReviewEnabled}
          mutation={selfReview}
          description="An independent agent reviews and tests the branch before the pull request opens."
        />
        <AutomationSwitch
          label="Publish review test checks"
          enabled={reviewTestChecksEnabled}
          mutation={testChecks}
          description="Report review test results as a check on the pull request."
        />
      </SettingsContainer>
    </SettingsSubsection>
  );
}
