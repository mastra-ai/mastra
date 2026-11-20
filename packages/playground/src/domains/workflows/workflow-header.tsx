import { Button } from '@mastra/playground-ui/components/Button';
import { ApiIcon } from '@mastra/playground-ui/icons/ApiIcon';

export function WorkflowHeader() {
  return (
    <Button
      render={<a target="_blank" rel="noopener noreferrer" href="/swagger-ui" />}
      variant="ghost"
      size="sm"
      icon={<ApiIcon />}
    >
      API endpoints
    </Button>
  );
}
