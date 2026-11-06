import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { KeyRound } from 'lucide-react';

import type { ServerStatusProblem } from '../../hooks/useServerStatus';
import { Button } from '@mastra/playground-ui/components/Button';

/** Renders a fix step, turning backticked env var names into copyable code. */
function FixStep({ fix }: { fix: string }) {
  return (
    <Txt variant="body" tone="ink">
      {fix.split('`').map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="inline-flex items-center gap-0.5 align-middle">
            <InlineCode>{part}</InlineCode>
            <CopyButton content={part} tooltip={`Copy ${part}`} />
          </span>
        ) : (
          part
        ),
      )}
    </Txt>
  );
}

/** Replaces every page while the server reports a problem that stops Factory from working. */
export function ServerProblemPage({ problem }: { problem: ServerStatusProblem }) {
  return (
    <div role="alert" className="flex min-h-64 flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-3">
        <KeyRound aria-hidden className="size-6 text-muted-foreground" />
        <Txt as="h1" variant="heading" tone="ink">
          {problem.title}
        </Txt>
        <Txt variant="body" tone="muted">
          {problem.message}
        </Txt>
        {problem.fix ? <FixStep fix={problem.fix} /> : null}
        {problem.docsUrl ? (
          <div className="pt-1">
            <Button variant="primary" render={<a href={problem.docsUrl} target="_blank" rel="noreferrer" />}>
              Read the fix guide
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
