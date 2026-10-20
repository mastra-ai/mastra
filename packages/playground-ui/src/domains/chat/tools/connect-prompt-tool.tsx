import type { ConnectPromptPayload } from '@/domains/connect';
import { isConnectPromptPayload, usePendingConnect } from '@/domains/connect';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

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
    <section
      aria-label="Connect an account"
      className="border-border1 bg-surface3 my-2 space-y-3 rounded-lg border p-4"
    >
      <Txt as="h4" variant="body" className="text-icon6 font-medium">
        Connect an account
      </Txt>
      <ul className="space-y-2">
        {payload.providers.map(provider => {
          const isConnected = provider.connected || connectedProviders.has(provider.id);
          const isPending = pending?.provider === provider.id;
          return (
            <li key={provider.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {provider.logoUrl ? <img src={provider.logoUrl} alt="" className="size-5 rounded-sm" /> : null}
                <Txt as="span" variant="body" className="text-icon6">
                  {provider.displayName ?? provider.id}
                </Txt>
              </div>
              <div className="flex items-center gap-3">
                {isPending ? (
                  <Txt as="span" variant="body-sm" className="text-icon3" role="status">
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
                  <Txt as="span" variant="body-sm" className="text-accent1">
                    Connected
                  </Txt>
                ) : (
                  <Button size="sm" disabled={readOnly || isCreating || isPending} onClick={() => connect(provider)}>
                    Connect
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {errorMessage ? (
        <Txt as="p" variant="body-sm" className="text-accent2" role="alert">
          {errorMessage}
        </Txt>
      ) : null}
    </section>
  );
};
