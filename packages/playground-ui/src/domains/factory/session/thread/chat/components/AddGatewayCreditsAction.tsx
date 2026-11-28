import { useMastraGatewayCreditsQuery } from '@mastra/react/hooks/factory';
import { ASK_ADMIN_FOR_CREDITS } from '../services/mastra-gateway-credits';

import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

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
