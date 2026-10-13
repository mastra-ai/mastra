import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { usePendingConnect } from '@mastra/playground-ui/domains/connect';
import type { UserConnectProvider } from '@mastra/playground-ui/domains/connect';

export interface AddConnectionSectionProps {
  providers: UserConnectProvider[];
}

/**
 * Lists the allowed providers with a Connect action: creates a connect
 * session, drives the platform-hosted auth flow in a popup (opened inside the
 * click gesture so popup blockers allow it), and polls the connection status
 * until it settles. Abandoned flows (closed popup, poll failure or timeout)
 * hand the Connect action back for a retry.
 */
export function AddConnectionSection({ providers }: AddConnectionSectionProps) {
  const { pending, connect, isCreating, createError } = usePendingConnect();

  if (providers.length === 0) {
    return (
      <Txt as="p" variant="body" tone="muted">
        No providers are enabled. Add provider ids to the `providers` allowlist of `userConnectRoutes()`.
      </Txt>
    );
  }

  return (
    <ul className="space-y-2">
      {providers.map(provider => {
        const isPending = pending?.provider === provider.id;
        return (
          <li key={provider.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="flex items-center gap-3">
              {provider.logoUrl ? <img src={provider.logoUrl} alt="" className="size-5 rounded-sm" /> : null}
              <Txt as="span" variant="body">
                {provider.displayName ?? provider.id}
              </Txt>
            </div>
            <div className="flex items-center gap-3">
              {isPending ? (
                <Txt as="span" variant="body" tone="muted" role="status">
                  Waiting for authorization…
                </Txt>
              ) : null}
              {isPending && pending?.fallbackUrl ? (
                <a
                  href={pending.fallbackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ui-md underline underline-offset-2"
                >
                  Open the connect window
                </a>
              ) : null}
              <Button
                variant="default"
                size="sm"
                disabled={isCreating || isPending}
                onClick={() => connect(provider.id)}
              >
                Connect
              </Button>
            </div>
          </li>
        );
      })}
      {createError ? (
        <li>
          <Txt as="p" variant="body" className="text-destructive-foreground" role="alert">
            {createError.message}
          </Txt>
        </li>
      ) : null}
    </ul>
  );
}
