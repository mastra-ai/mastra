import { Button } from '@mastra/playground-ui/components/Button';
import { Link2 } from 'lucide-react';

import { useLinearConnect } from '../../../../hooks/useLinearConnect';
import { IntegrationItem } from './IntegrationItem';

export function LinearConnectButton({
  action = 'Connect',
  label = `${action} Linear`,
}: {
  action?: 'Connect' | 'Reconnect';
  label?: string;
}) {
  const linear = useLinearConnect();
  return (
    <Button
      size="sm"
      icon={<Link2 />}
      aria-label={linear.pending ? undefined : label}
      disabled={linear.pending}
      onClick={() => void linear.connect()}
    >
      {linear.pending ? 'Connecting…' : action}
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
