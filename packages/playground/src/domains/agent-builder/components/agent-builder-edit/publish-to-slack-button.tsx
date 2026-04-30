import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';

export interface PublishToSlackButtonProps {
  disabled?: boolean;
}

export function PublishToSlackButton({ disabled = true }: PublishToSlackButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button size="sm" variant="default" disabled={disabled} data-testid="agent-builder-publish-slack">
            Publish to Slack
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Coming soon</TooltipContent>
    </Tooltip>
  );
}
