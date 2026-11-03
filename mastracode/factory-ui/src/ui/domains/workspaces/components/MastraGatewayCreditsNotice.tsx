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
      action={
        credits.canAddCredits && (
          <AddGatewayCreditsDialog credits={credits} trigger={<Notice.Button>Add credits</Notice.Button>} />
        )
      }
    >
      {credits.canAddCredits
        ? 'Mastra Gateway models run on your organization’s credits. Add credits before you start a session.'
        : 'Mastra Gateway models run on your organization’s credits. Only Mastra organization admins can add them, so ask one before you start a session.'}
    </Notice>
  );
}
