import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Power } from 'lucide-react';

import { useStartSessionSandbox } from '../../workspaces/hooks/useStartSessionSandbox';

/** Shown when the session has no running sandbox: start one on request. */
export function WakeSandbox({ workspacePath }: { workspacePath: string }) {
  const start = useStartSessionSandbox(workspacePath);
  return (
    <div className="flex flex-col items-center gap-2">
      <Txt as="span" variant="caption" tone="muted">
        The sandbox isn&apos;t running.
      </Txt>
      <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
        {start.isPending ? <Spinner size="sm" /> : <Power />}
        {start.isPending ? 'Waking sandbox…' : 'Wake sandbox'}
      </Button>
      {start.error ? (
        <Txt as="span" variant="caption" className="text-destructive-foreground">
          {start.error.message}
        </Txt>
      ) : null}
    </div>
  );
}
