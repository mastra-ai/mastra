import { CheckIcon } from 'lucide-react';
import type { ConnectPromptPayload } from '@/domains/connect';
import { isConnectPromptPayload, ProviderLogo, usePendingConnect } from '@/domains/connect';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';

export { CONNECT_PROMPT_TOOL_NAME } from './connect-prompt-tool-id';

export interface ConnectPromptToolProps {
  output: unknown;
  /** Historical rendering: show the card but suppress the connect action. */
  readOnly?: boolean;
}

/**
 * Chat card for the built-in `request_connection` tool: the agent surfaces it
 * when provider tools are unavailable because the caller has no connection.
 * Each provider row offers a Connect action that creates a connect session on
 * the mounted `/connect` routes, drives the OAuth flow in a popup through the
 * server's launch gate (which verifies this browser owns the pending session
 * before redirecting to the vendor), and polls until the connection settles.
 */
export const ConnectPromptTool = ({ output, readOnly = false }: ConnectPromptToolProps) => {
  if (!isConnectPromptPayload(output)) return null;
  return <ConnectPromptCard payload={output} readOnly={readOnly} />;
};

const ConnectPromptCard = ({ payload, readOnly }: { payload: ConnectPromptPayload; readOnly: boolean }) => {
  const { pending, connect, connectedProviders, isCreating, createError, settled } = usePendingConnect();

  const errorMessage =
    createError?.message ??
    (settled?.status === 'failed'
      ? (settled.message ?? 'The connection was not completed. Try connecting again.')
      : null);

  return (
    <section aria-label="Connect an account" className="my-2 space-y-3">
      <DataList columns="minmax(0, 1fr)" fit="container" scrollable={false}>
        <DataList.Subheader>
          <Txt as="h4" variant="subheading" tone="ink">
            Connect an account
          </Txt>
        </DataList.Subheader>
        {payload.providers.map(provider => {
          const isConnected = provider.connected || connectedProviders.has(provider.id);
          const isPending = pending?.provider === provider.id;
          return (
            <DataList.RowStatic key={provider.id}>
              <DataList.Cell className="col-span-full py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <ProviderLogo logoUrl={provider.logoUrl} />
                    <Txt as="span" variant="body-sm" tone="ink" className="truncate">
                      {provider.displayName ?? provider.id}
                    </Txt>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {isPending ? (
                      <Txt as="span" variant="body-sm" tone="muted" role="status">
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
                    {isConnected ? (
                      <Txt
                        as="span"
                        variant="body-sm"
                        tone="muted"
                        className="flex min-w-24 items-center justify-center gap-1"
                      >
                        <Icon size="sm">
                          <CheckIcon aria-hidden />
                        </Icon>
                        Connected
                      </Txt>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="min-w-24"
                        disabled={readOnly || isCreating || isPending}
                        onClick={() => connect(provider)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </DataList.Cell>
            </DataList.RowStatic>
          );
        })}
      </DataList>
      {errorMessage ? (
        <div role="alert">
          <Notice variant="destructive" title="Couldn't connect">
            <Notice.Message>{errorMessage}</Notice.Message>
          </Notice>
        </div>
      ) : null}
    </section>
  );
};
