import { useContext, useEffect, useState } from 'react';
import { useChatMessages, useChatSend } from '../context/chat-context';
import { ConnectRequestActionsContext } from '../context/connect-request-context';
import { deriveConnectRequestState } from './connect-request';
import type { ConnectRequestData, LocalConnectRequestState } from './connect-request';
import { ConnectionRequestCard } from '@/ds/components/ai/connection-request/connection-request-card';

const MAX_TIMER_MS = 2_147_483_647;

export function ConnectRequestPart({ request }: { request: ConnectRequestData }) {
  const messages = useChatMessages();
  const send = useChatSend();
  const actions = useContext(ConnectRequestActionsContext);
  const [local, setLocal] = useState<LocalConnectRequestState>();
  const [now, setNow] = useState(Date.now);
  const { status, accountLabel } = deriveConnectRequestState(request, messages, local, now);
  const pending = status === 'request' || status === 'waiting';

  useEffect(() => {
    if (!pending) return;
    const delay = Date.parse(request.expiresAt) - Date.now();
    if (delay > MAX_TIMER_MS) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(delay, 0));
    return () => clearTimeout(timer);
  }, [pending, request.expiresAt]);

  return (
    <ConnectionRequestCard
      displayName={request.displayName}
      logoUrl={request.logoUrl}
      status={status}
      accountLabel={accountLabel}
      onConnect={
        actions &&
        (() => {
          actions.onConnect(request);
          setLocal('waiting');
        })
      }
      onDecline={
        actions &&
        (() => {
          actions.onDecline(request);
          setLocal('declined');
        })
      }
      onRetry={actions && (() => send({ message: `Try connecting ${request.displayName} again.` }))}
    >
      {request.reason}
    </ConnectionRequestCard>
  );
}
