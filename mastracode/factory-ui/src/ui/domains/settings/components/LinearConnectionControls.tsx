import { Button } from '@mastra/playground-ui/components/Button';

import { useLinearConnect } from '../../../../hooks/useLinearConnect';
import { IconChainLink3 } from '@mastra/playground-ui/icons/central/IconChainLink3';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

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
      icon={<IconChainLink3 />}
      aria-label={linear.pending ? undefined : label}
      disabled={linear.pending}
      onClick={() => void linear.connect()}
    >
      {linear.pending ? 'Connecting…' : action}
    </Button>
  );
}

export function AddLinearWorkspaceButton() {
  const linear = useLinearConnect();
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<IconPlusMedium />}
      aria-label={linear.pending ? undefined : 'Add workspace to Linear'}
      disabled={linear.pending}
      onClick={() => void linear.connect()}
    >
      {linear.pending ? 'Connecting…' : 'Add workspace'}
    </Button>
  );
}
