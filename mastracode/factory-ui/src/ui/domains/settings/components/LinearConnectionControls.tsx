import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import { IntegrationLabel } from './IntegrationLabel';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

export function LinearConnectButton({
  action = 'Connect',
  label = `${action} Linear`,
}: {
  action?: 'Connect' | 'Reconnect';
  label?: string;
}) {
  const { baseUrl } = useApiConfig();
  return (
    <Button size="sm" icon={<IconChainLink1 />} aria-label={label} onClick={() => connectLinear(baseUrl)}>
      {action}
    </Button>
  );
}

export function AddLinearWorkspaceRow() {
  return (
    <SettingsRow label={<IntegrationLabel provider="linear" name="Linear" />} description="Another workspace">
      <LinearConnectButton label="Connect another Linear workspace" />
    </SettingsRow>
  );
}
