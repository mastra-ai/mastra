import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { Link } from 'react-router';

export function AgentUnavailable() {
  return (
    <ErrorState
      title="Agent not found"
      message="This agent may have been renamed or removed. Reload to check again, or choose another agent."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button render={<Link to="/agents" />}>Choose agent</Button>
        </div>
      }
    />
  );
}
