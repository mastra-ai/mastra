import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';

export function ExperimentIdLink({ experimentId }: { experimentId: string }) {
  const { Link, paths } = useLinkComponent();
  return (
    <Button
      render={<Link href={paths.experimentLink(experimentId)} />}

      size="sm"
      aria-label={`Open experiment ${experimentId}`}
    >
      {experimentId.slice(0, 8)}
    </Button>
  );
}
