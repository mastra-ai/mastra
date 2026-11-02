import { Button } from '@mastra/playground-ui/components/Button';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';

/** Opens the Mastra platform page where the organization adds gateway credits. */
export function AddGatewayCreditsAction(_props: { entryId: string }) {
  const { data: credits } = useMastraGatewayCreditsQuery({ enabled: true });
  if (!credits) return null;
  return (
    <Button size="sm" variant="primary" render={<a href={credits.addCreditsUrl} target="_blank" rel="noreferrer" />}>
      Add credits
    </Button>
  );
}
