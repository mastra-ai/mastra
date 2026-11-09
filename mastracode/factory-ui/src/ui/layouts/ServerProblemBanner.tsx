import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';

import type { ServerStatusProblem } from '../../hooks/useServerStatus';

/** Renders a fix step, turning backticked env var names into copyable code. */
function FixStep({ fix }: { fix: string }) {
  return (
    <Txt as="span" variant="body-sm" tone="ink">
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

/**
 * Full-width banner above every page while the server reports a problem that stops Factory
 * from working. No dismiss: it stays until the server is fixed and redeployed.
 */
export function ServerProblemBanner({ problem }: { problem: ServerStatusProblem }) {
  return (
    <div
      role="alert"
      className="border-surface-rim bg-warning-subtle text-warning-subtle-foreground flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
        <TriangleAlertIcon className="size-icon-md shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <Txt as="h2" variant="label" tone="ink" className="shrink-0">
            {problem.title}
          </Txt>
          <Txt as="span" variant="body-sm" tone="ink">
            {problem.message}
          </Txt>
          {problem.fix ? <FixStep fix={problem.fix} /> : null}
        </div>
      </div>
      {problem.docsUrl ? (
        <div className="ml-auto flex shrink-0 items-center">
          <Button
            render={<a href={problem.docsUrl} target="_blank" rel="noopener noreferrer" />}
            variant="default"
            size="md"
            iconEnd={<ExternalLinkIcon aria-hidden />}
          >
            Read the docs
          </Button>
        </div>
      ) : null}
    </div>
  );
}
