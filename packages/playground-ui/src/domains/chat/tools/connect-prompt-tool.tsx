import { CheckIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { MessageMetadata } from '../messages/message-metadata';
import { toolInteraction } from './tool-card-kind';
import { useToolCall } from '@/domains/chat/context/tool-call-context';
import type { ConnectPromptPayload, ConnectPromptResume, SettledConnect } from '@/domains/connect';
import { isConnectPromptPayload, ProviderLogo, usePendingConnect } from '@/domains/connect';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';

export { CONNECT_PROMPT_TOOL_NAME } from './connect-prompt-tool-id';

export interface ConnectPromptToolProps {
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
  /** Historical rendering: show the card but suppress the connect action. */
  readOnly?: boolean;
}

/**
 * The prompt this card renders: the finished call's result, or the payload
 * the run paused with while it waits for the user to connect.
 */
function connectPromptFor({
  toolName,
  toolCallId,
  output,
  metadata,
}: Pick<ConnectPromptToolProps, 'toolName' | 'toolCallId' | 'output' | 'metadata'>):
  | { payload: ConnectPromptPayload; paused: boolean }
  | undefined {
  if (isConnectPromptPayload(output)) return { payload: output, paused: false };
  const suspendPayload = toolInteraction(metadata, toolName, toolCallId).suspended?.suspendPayload;
  if (isConnectPromptPayload(suspendPayload)) return { payload: suspendPayload, paused: true };
  return undefined;
}

/**
 * Chat card for the built-in `request_connection` tool: the agent surfaces it
 * when provider tools are unavailable because the caller has no connection.
 * Each provider row offers a Connect action that creates a connect session on
 * the mounted `/connect` routes, drives the OAuth flow in a popup through the
 * server's launch gate (which verifies this browser owns the pending session
 * before redirecting to the vendor), and polls until the connection settles.
 *
 * The tool pauses the agent run while the card is up. Once the connection
 * activates, the card resumes the paused call with the connected provider, so
 * the agent continues with the tool's result rather than a chat message.
 */
export const ConnectPromptTool = ({
  toolName,
  toolCallId,
  output,
  metadata,
  readOnly = false,
}: ConnectPromptToolProps) => {
  const prompt = connectPromptFor({ toolName, toolCallId, output, metadata });
  if (!prompt) return null;
  return (
    <ConnectPromptCard toolCallId={toolCallId} payload={prompt.payload} paused={prompt.paused} readOnly={readOnly} />
  );
};

interface ConnectPromptCardProps {
  toolCallId: string;
  payload: ConnectPromptPayload;
  /** The run is waiting on this call, so an activation resumes it. */
  paused: boolean;
  readOnly: boolean;
}

const ConnectPromptCard = ({ toolCallId, payload, paused, readOnly }: ConnectPromptCardProps) => {
  const { pending, connect, connectedProviders, isCreating, createError, settled } = usePendingConnect();
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const resumedRef = useRef<SettledConnect | null>(null);
  const alreadyResumed = toolCallApprovals[toolCallId] !== undefined;

  // Resume once per activation. A run that is still streaming can't be resumed
  // yet, so an activation that lands mid-run waits for it to stop.
  useEffect(() => {
    if (readOnly || !paused || alreadyResumed || isRunning) return;
    if (settled?.status !== 'active' || resumedRef.current === settled) return;
    resumedRef.current = settled;
    const resume: ConnectPromptResume = { provider: settled.provider, status: 'active' };
    approveToolcall(toolCallId, resume);
  }, [readOnly, paused, alreadyResumed, isRunning, settled, approveToolcall, toolCallId]);

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
