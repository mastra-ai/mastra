import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';

import type { ServerStatusProblem } from '../../hooks/useServerStatus';

/** Replaces every page while the server reports a problem that stops Factory from working. */
export function ServerProblemPage({ problem }: { problem: ServerStatusProblem }) {
  return (
    <div role="alert" className="flex min-h-64 flex-1 items-center justify-center p-6">
      <EmptyState
        as="h1"
        tone="error"
        titleSlot={problem.title}
        descriptionSlot={<span className="block max-w-xl">{problem.message}</span>}
        actionSlot={
          problem.docsUrl ? (
            <Button variant="primary" render={<a href={problem.docsUrl} target="_blank" rel="noreferrer" />}>
              How to fix this
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
