import { Button } from '@mastra/playground-ui';

export function PublishToSlackButton() {
  return (
    <Button size="sm" variant="default" data-testid="agent-builder-publish-slack">
      Publish to Slack
    </Button>
  );
}
