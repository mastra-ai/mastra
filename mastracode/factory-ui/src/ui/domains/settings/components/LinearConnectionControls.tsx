import { Button } from '@mastra/playground-ui/components/Button';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import { IconChainLink3 } from '@mastra/playground-ui/icons/central/IconChainLink3';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

export function LinearConnectButton({
  action = 'Connect',
  label = `${action} Linear`,
}: {
  action?: 'Connect' | 'Reconnect';
  label?: string;
}) {
  const { baseUrl } = useApiConfig();
  return (
    <Button size="sm" icon={<IconChainLink3 />} aria-label={label} onClick={() => connectLinear(baseUrl)}>
      {action}
    </Button>
  );
}

export function AddLinearWorkspaceButton() {
  const { baseUrl } = useApiConfig();
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<IconPlusMedium />}
      aria-label="Add workspace to Linear"
      onClick={() => connectLinear(baseUrl)}
    >
      Add workspace
    </Button>
  );
}
