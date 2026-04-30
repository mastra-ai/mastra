import { Button } from '@mastra/playground-ui';
import { SlackIcon } from './slack-icon';

export function PublishToSlackButton() {
  return (
    <Button size="sm" variant="ghost" data-testid="agent-builder-publish-slack">
      <SlackIcon className="h-4 w-4" />
      Publish to Slack
    </Button>
  );
}
