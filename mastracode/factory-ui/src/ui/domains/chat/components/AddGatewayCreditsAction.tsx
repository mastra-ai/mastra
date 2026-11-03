import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';
import { AddGatewayCreditsDialog } from '../../workspaces/components/AddGatewayCreditsDialog';

/** Adds gateway credits from the failed run, or names who can when the user is not a Mastra admin. */
export function AddGatewayCreditsAction() {
  const { data: credits } = useMastraGatewayCreditsQuery();
  if (!credits) return null;
  if (!credits.canAddCredits) {
    return (
      <Txt variant="body-sm" tone="muted">
        Ask a Mastra organization admin to add credits.
      </Txt>
    );
  }
  return (
    <AddGatewayCreditsDialog
      credits={credits}
      trigger={
        <Button size="sm" variant="primary">
          Add credits
        </Button>
      }
    />
  );
}
