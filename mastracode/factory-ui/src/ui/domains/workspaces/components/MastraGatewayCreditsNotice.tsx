import { Notice } from '@mastra/playground-ui/components/Notice';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';
import { AddGatewayCreditsDialog } from './AddGatewayCreditsDialog';
import { ASK_ADMIN_FOR_CREDITS } from './mastra-gateway-credits';

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
          <AddGatewayCreditsDialog
            addCreditsUrl={credits.addCreditsUrl}
            trigger={<Notice.Button>Add credits</Notice.Button>}
          />
        )
      }
    >
      {!credits.canAddCredits && ASK_ADMIN_FOR_CREDITS}
    </Notice>
  );
}
