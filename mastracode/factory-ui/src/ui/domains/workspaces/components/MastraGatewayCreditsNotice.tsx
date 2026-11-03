import { Notice } from '@mastra/playground-ui/components/Notice';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';

/** Warns when the organization has no Mastra Gateway credits left, with a link to add some. */
export function MastraGatewayCreditsNotice() {
  const { data: credits } = useMastraGatewayCreditsQuery();
  if (!credits || credits.unlimited || credits.remaining !== 0) return null;
  return (
    <Notice
      variant="warning"
      title="No gateway credits left"
      action={
        <Notice.Button render={<a href={credits.addCreditsUrl} target="_blank" rel="noreferrer" />}>
          Add credits
        </Notice.Button>
      }
    >
      Mastra Gateway models run on your organization’s credits. Add credits before you start a session.
    </Notice>
  );
}
