import { Notice } from '@mastra/playground-ui/components/Notice';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';
import { ASK_ADMIN_FOR_CREDITS } from './mastra-gateway-credits';

/** Credits are bought on Mastra in a new tab; the balance is read again when the user comes back. */
export function MastraGatewayCreditsNotice() {
  const { data: credits } = useMastraGatewayCreditsQuery();
  if (!credits || credits.unlimited || credits.remaining !== 0) return null;
  return (
    <Notice
      variant="warning"
      title="No gateway credits left"
      actionPlacement={credits.canAddCredits ? 'end' : 'below'}
      action={
        credits.canAddCredits && (
          <Notice.Button render={<a href={credits.addCreditsUrl} target="_blank" rel="noreferrer" />}>
            Add credits
          </Notice.Button>
        )
      }
    >
      {!credits.canAddCredits && ASK_ADMIN_FOR_CREDITS}
    </Notice>
  );
}
