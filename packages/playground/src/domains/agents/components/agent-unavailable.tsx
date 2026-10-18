import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Link } from 'react-router';

export function AgentUnavailable() {
  return (
    <EmptyState
      tone="error"
      titleSlot="Agent not found"
      descriptionSlot="This agent may have been renamed or removed. Reload to check again, or choose another agent."
      actionSlot={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button render={<Link to="/agents" />}>Choose agent</Button>
        </div>
      }
    />
  );
}
