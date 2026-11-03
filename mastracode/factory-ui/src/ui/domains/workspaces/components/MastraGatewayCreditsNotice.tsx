import { Notice } from '@mastra/playground-ui/components/Notice';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';
import { AddGatewayCreditsDialog } from './AddGatewayCreditsDialog';

/** Warns when the organization has no Mastra Gateway credits left, and lets an admin add some in place. */
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
          <AddGatewayCreditsDialog credits={credits} trigger={<Notice.Button>Add credits</Notice.Button>} />
        )
      }
    >
      {!credits.canAddCredits && 'Ask an admin of your Mastra organization to add some.'}
    </Notice>
  );
}
