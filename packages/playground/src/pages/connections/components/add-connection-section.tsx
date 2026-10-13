import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import {
  useConnectLaunchHref,
  useConnectionStatus,
  useCreateConnectSession,
} from '@mastra/playground-ui/domains/connect';
import type { UserConnectProvider } from '@mastra/playground-ui/domains/connect';
import { useEffect, useState } from 'react';

interface PendingConnect {
  provider: string;
  connectionId: string;
  /** Shown when the popup was blocked so the user can finish the flow manually. */
  fallbackUrl: string | null;
}

export interface AddConnectionSectionProps {
  providers: UserConnectProvider[];
}

/**
 * Lists the allowed providers with a Connect action: creates a connect
 * session, drives the platform-hosted auth flow in a popup (opened inside the
 * click gesture so popup blockers allow it), and polls the connection status
 * until it settles.
 */
export function AddConnectionSection({ providers }: AddConnectionSectionProps) {
  const session = useCreateConnectSession();
  const resolveLaunchHref = useConnectLaunchHref();
  const [pending, setPending] = useState<PendingConnect | null>(null);
  const status = useConnectionStatus({ connectionId: pending?.connectionId ?? null });

  const settled = status.data !== undefined && status.data.status !== 'pending';
  useEffect(() => {
    if (settled) setPending(null);
  }, [settled]);

  const handleConnect = (providerId: string) => {
    // Opened synchronously in the click handler so popup blockers allow it.
    const popup = window.open('', 'mastra-connect', 'popup,width=600,height=720');
    session.mutate(
      { provider: providerId },
      {
        onSuccess: created => {
          // The popup enters OAuth through the server's launch gate, which
          // verifies this browser owns the pending session before redirecting
          // to the vendor flow — the raw vendor URL never reaches the page.
          const launchHref = resolveLaunchHref(created.launchUrl);
          if (popup) {
            popup.location.href = launchHref;
          }
          setPending({
            provider: providerId,
            connectionId: created.connectionId,
            fallbackUrl: popup ? null : launchHref,
          });
        },
        onError: () => popup?.close(),
      },
    );
  };

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
                disabled={session.isPending || isPending}
                onClick={() => handleConnect(provider.id)}
              >
                Connect
              </Button>
            </div>
          </li>
        );
      })}
      {session.isError ? (
        <li>
          <Txt as="p" variant="body" className="text-destructive-foreground" role="alert">
            {session.error.message}
          </Txt>
        </li>
      ) : null}
    </ul>
  );
}
