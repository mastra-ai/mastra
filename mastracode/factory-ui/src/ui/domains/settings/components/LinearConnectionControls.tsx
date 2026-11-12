import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import { IntegrationItem } from './IntegrationItem';

export function LinearConnectButton({
  action = 'Connect',
  label = `${action} Linear`,
}: {
  action?: 'Connect' | 'Reconnect';
  label?: string;
}) {
  const { baseUrl } = useApiConfig();
  return (
    <Button size="sm" icon={<Link2 />} aria-label={label} onClick={() => connectLinear(baseUrl)}>
      {action}
    </Button>
  );
}

export function AddLinearWorkspaceRow() {
  return (
    <IntegrationItem provider="linear" name="Linear" description="Another workspace">
      <LinearConnectButton label="Connect another Linear workspace" />
    </IntegrationItem>
  );
}
