import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';
import { ASK_ADMIN_FOR_CREDITS } from '../../workspaces/components/mastra-gateway-credits';

export function AddGatewayCreditsAction() {
  const { data: credits } = useMastraGatewayCreditsQuery();
  if (!credits) return null;
  if (!credits.canAddCredits) {
    return (
      <Txt variant="body-sm" tone="muted">
        {ASK_ADMIN_FOR_CREDITS}
      </Txt>
    );
  }
  return (
    <Button size="sm" variant="primary" render={<a href={credits.addCreditsUrl} target="_blank" rel="noreferrer" />}>
      Add credits
    </Button>
  );
}
