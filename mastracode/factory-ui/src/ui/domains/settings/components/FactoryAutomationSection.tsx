import { Notice } from '@mastra/playground-ui/components/Notice';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useSetFactoryAutoRunMutation } from '../../../../hooks/useFactoryAutoRun';
import { SettingsCard, SettingsRow } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

export function FactoryAutomationSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const factory = factoryQuery.data;
  const autoRunMutation = useSetFactoryAutoRunMutation(factoryId);

  if (!factory) return <Notice variant="info">Select a factory to manage its settings.</Notice>;

  return (
    <SettingsSubsection title="Automation">
      <SettingsCard>
        <SettingsRow
          label="Start runs automatically"
          hint="Off: a review or triage a rule wants to start waits on its card until you press Run. Cards still move on their own when a pull request merges or an issue closes."
        >
          <Switch
            aria-label="Start runs automatically"
            checked={factory.autoRunEnabled ?? false}
            disabled={factoryQuery.isPending || autoRunMutation.isPending}
            onCheckedChange={enabled =>
              autoRunMutation.mutate(enabled, {
                onSuccess: () => toast.success(enabled ? 'Automatic runs on' : 'Automatic runs off'),
                onError: error =>
                  toast.error(error instanceof Error ? error.message : 'Failed to update automatic runs'),
              })
            }
          />
        </SettingsRow>
      </SettingsCard>
    </SettingsSubsection>
  );
}
