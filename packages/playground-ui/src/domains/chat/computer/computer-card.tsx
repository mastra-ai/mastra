import { useMastraClient } from '@mastra/react';
import { useEffect, useRef, useState } from 'react';

import {
  CONNECT_TIMEOUT_MS,
  getComputerControl,
  postComputerControl,
  requestComputerSession,
} from './computer-session';
import type { ComputerSessionResult } from './computer-session';
import { computerPartKey, effectiveHolder } from './computer-state';
import { useComputerThread } from './computer-thread-context';
import { loadRfb } from './load-rfb';
import type { RfbClient } from './load-rfb';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

export const NOT_RUNNING_POLL_MS = 5_000;
export const CONTROL_POLL_MS = 2_000;
const NOTE_MAX = 500;

const SESSION_MESSAGES: Record<Exclude<ComputerSessionResult['state'], 'ready'>, string> = {
  'not-running': 'The computer is not running yet.',
  forbidden: 'You need write access to this thread to view its computer, or the computer is not attached here.',
  unavailable: 'Live view is not available on this server.',
  error: 'Could not open the live view.',
};

export interface ComputerCardProps {
  messageId: string;
  partIndex: number;
  computerId: string;
  /**
   * Rendered at an attach tool call. Stands in for the `data-computer` part when
   * stored history has none, so it shows only while it owns the live viewer.
   */
  standIn?: boolean;
}

/**
 * A computer attached to the chat thread: live desktop, Take control / Hand back, and Fullscreen.
 * Only the occurrence that owns the current attachment connects; others are references.
 *
 * @experimental
 */
export function ComputerCard({ messageId, partIndex, computerId, standIn = false }: ComputerCardProps) {
  const { computers, scope } = useComputerThread();
  const entry = computers.get(computerId);
  const name = entry?.name ?? computerId;
  const isOwner = entry?.status === 'attached' && entry.ownerKey === computerPartKey(messageId, partIndex);
  if (standIn && !isOwner) return null;

  return (
    <section aria-label={`Computer ${name}`} className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2">
        <Txt as="span" variant="card-title">
          {name}
        </Txt>
        {entry?.persistent && <Badge>Persistent</Badge>}
      </div>
      {entry?.status === 'released' ? (
        <Txt variant="body-sm">Computer released</Txt>
      ) : !isOwner ? (
        <Txt variant="body-sm">Shown in a later message</Txt>
      ) : scope ? (
        <LiveComputer computerId={computerId} threadId={scope.threadId} resourceId={scope.resourceId} />
      ) : null}
    </section>
  );
}

interface LiveComputerProps {
  computerId: string;
  threadId: string;
  resourceId: string;
}

type ConnectionState =
  | { phase: 'connecting' }
  | { phase: 'connected' }
  | { phase: 'session'; state: Exclude<ComputerSessionResult['state'], 'ready'> }
  | { phase: 'disconnected'; message: string };

/** Studio's request options for one computer's control route. */
function useControlRequest(computerId: string, threadId: string, resourceId: string) {
  const client = useMastraClient();
  const { baseUrl, apiPrefix, headers } = client.options;
  return { computerId, threadId, resourceId, baseUrl, apiPrefix, headers };
}

/**
 * Take control / Hand back for one computer. Changes post to the control route
 * and report into the thread's shared control state, so every card and request
 * prompt for the computer agrees.
 */
function useControlActions(computerId: string, threadId: string, resourceId: string) {
  const { reportControl, scopeKey } = useComputerThread();
  const request = useControlRequest(computerId, threadId, resourceId);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const change = async (action: 'take' | 'release', note?: string) => {
    const started = { scopeKey };
    setPending(true);
    setFailed(false);
    const result = await postComputerControl({ ...request, action, ...(note && { note }) });
    setPending(false);
    // A no-change answer (a double submit, or the lease already moved) says nothing about notifying.
    if (result.state === 'ok')
      reportControl(
        computerId,
        {
          holder: result.holder,
          ...(result.reason !== 'no-change' && { notified: result.notified }),
        },
        started,
      );
    else setFailed(true);
  };
  return { change, pending, failed };
}

function HandBack({ computerId, threadId, resourceId }: LiveComputerProps) {
  const { change, pending, failed } = useControlActions(computerId, threadId, resourceId);
  const [note, setNote] = useState('');
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={event => {
        event.preventDefault();
        void change('release', note.trim() || undefined);
      }}
    >
      <input
        aria-label="Note for the agent"
        placeholder="Note for the agent (optional)"
        maxLength={NOTE_MAX}
        value={note}
        onChange={event => setNote(event.target.value)}
        className="min-w-0 flex-1 rounded border border-border1 bg-transparent px-2 py-1 text-ui-sm"
      />
      <Button size="sm" type="submit" disabled={pending}>
        Hand back
      </Button>
      {failed && <Txt variant="body-sm">Could not hand back control.</Txt>}
    </form>
  );
}

/**
 * Renders the desktop with the bundled noVNC client over the server's
 * websockify proxy. No sandbox-served page or script ever loads in Studio.
 *
 * Each connection mints its own single-use ticket inside the effect, so a
 * remount (including React StrictMode's) never replays a consumed ticket. Any
 * viewer needs write access to the thread (the relay doesn't filter input), so
 * the card always asks for a `control` ticket. Input reaches the desktop only
 * while the user holds the computer's control lease; holder changes flip
 * `viewOnly` on the live connection without reconnecting.
 */
function LiveComputer({ computerId, threadId, resourceId }: LiveComputerProps) {
  const client = useMastraClient();
  const { baseUrl, apiPrefix, headers } = client.options;
  const { computers, live, reportControl, readEpoch, scopeKey } = useComputerThread();
  const entry = computers.get(computerId);
  const control = effectiveHolder(entry, live.get(computerId));
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>({ phase: 'connecting' });
  const { change, pending, failed } = useControlActions(computerId, threadId, resourceId);
  const screenRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RfbClient | undefined>(undefined);
  const viewOnly = control.holder !== 'human';
  const viewOnlyRef = useRef(true);
  viewOnlyRef.current = viewOnly;
  const headersKey = JSON.stringify(headers ?? {});

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let rfb: RfbClient | undefined;
    setConnection({ phase: 'connecting' });

    const connect = async () => {
      const result = await requestComputerSession({
        computerId,
        threadId,
        resourceId,
        mode: 'control',
        baseUrl,
        apiPrefix,
        headers: JSON.parse(headersKey) as Record<string, string>,
        signal,
      }).catch(() => undefined);
      if (signal.aborted || !result) return;
      if (result.state !== 'ready') {
        setConnection({ phase: 'session', state: result.state });
        if (result.state === 'not-running') pollTimer = setTimeout(() => void connect(), NOT_RUNNING_POLL_MS);
        return;
      }
      const RFB = await loadRfb();
      const screen = screenRef.current;
      if (signal.aborted || !screen) return;
      rfb = new RFB(screen, result.socketUrl, { wsProtocols: [] });
      rfb.viewOnly = viewOnlyRef.current;
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfbRef.current = rfb;
      connectTimer = setTimeout(() => {
        rfbRef.current = undefined;
        controller.abort();
        rfb?.disconnect();
        setConnection({ phase: 'disconnected', message: 'The desktop did not connect in time.' });
      }, CONNECT_TIMEOUT_MS);
      rfb.addEventListener('connect', () => {
        if (signal.aborted) return;
        clearTimeout(connectTimer);
        setConnection({ phase: 'connected' });
      });
      rfb.addEventListener('disconnect', () => {
        clearTimeout(connectTimer);
        if (signal.aborted) return;
        setConnection({
          phase: 'disconnected',
          message: 'The live view disconnected. The computer may have been released or stopped.',
        });
      });
    };
    void connect();

    return () => {
      controller.abort();
      clearTimeout(pollTimer);
      clearTimeout(connectTimer);
      rfbRef.current = undefined;
      rfb?.disconnect();
    };
  }, [computerId, threadId, resourceId, attempt, baseUrl, apiPrefix, headersKey]);

  useEffect(() => {
    if (rfbRef.current) rfbRef.current.viewOnly = viewOnly;
  }, [viewOnly]);

  // The lease can change outside this card (the agent asks, another tab hands back): poll it.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const started = { scopeKey, epoch: readEpoch(computerId) };
      const result = await getComputerControl({
        computerId,
        threadId,
        resourceId,
        baseUrl,
        apiPrefix,
        headers: JSON.parse(headersKey) as Record<string, string>,
        signal: controller.signal,
      }).catch(() => undefined);
      if (controller.signal.aborted) return;
      if (result?.state === 'ok') reportControl(computerId, { holder: result.holder }, started);
      timer = setTimeout(() => void poll(), CONTROL_POLL_MS);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [computerId, threadId, resourceId, baseUrl, apiPrefix, headersKey, reportControl, readEpoch, scopeKey]);

  const sessionMessage = connection.phase === 'session' ? SESSION_MESSAGES[connection.state] : undefined;
  const human = control.holder === 'human';
  // Take control needs a live desktop. Hand back stays available whenever the user
  // holds the lease (even if the view dropped), unless the server refused this thread.
  const canTake = connection.phase === 'connected';
  const canHandBack = !(connection.phase === 'session' && connection.state === 'forbidden');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {human ? <Badge variant="warning">You have control</Badge> : <Badge>Agent has control</Badge>}
        {canTake && !human && (
          <Button size="sm" disabled={pending} onClick={() => void change('take')}>
            Take control
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void frameRef.current?.requestFullscreen?.()}>
          Fullscreen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAttempt(n => n + 1)}>
          Reconnect
        </Button>
      </div>
      {canHandBack && human && <HandBack computerId={computerId} threadId={threadId} resourceId={resourceId} />}
      {human && entry?.holder === 'human' && entry.reason && (
        <Txt variant="body-sm">The agent asked: {entry.reason}</Txt>
      )}
      {control.notified === false && (
        <Notice variant="warning" title="Agent not notified">
          <Notice.Message>The agent was not notified. Send it a message to continue.</Notice.Message>
        </Notice>
      )}
      {failed && (
        <Notice variant="warning" title="Control">
          <Notice.Message>Could not change control of the computer.</Notice.Message>
        </Notice>
      )}
      {sessionMessage && (
        <Notice
          variant={connection.phase === 'session' && connection.state === 'not-running' ? 'info' : 'warning'}
          title="Live view"
        >
          <Notice.Message>{sessionMessage}</Notice.Message>
        </Notice>
      )}
      {connection.phase === 'disconnected' && (
        <Notice variant="warning" title="Live view">
          <Notice.Message>{connection.message}</Notice.Message>
        </Notice>
      )}
      <div ref={frameRef} className="relative aspect-video w-full overflow-hidden bg-black">
        {connection.phase === 'connecting' && (
          <Txt variant="body-sm" className="absolute inset-0 flex items-center justify-center">
            Starting desktop…
          </Txt>
        )}
        <div ref={screenRef} role="application" aria-label="Computer desktop" className="size-full" />
      </div>
    </div>
  );
}

/**
 * The agent's request for the user (`computer_request_human`), rendered where it
 * happened in the chat: the reason and, while the user still holds control, a
 * Hand back button.
 *
 * @experimental
 */
export function ComputerControlRequest({ computerId, reason }: { computerId: string; reason?: string }) {
  const { computers, live, scope } = useComputerThread();
  const control = effectiveHolder(computers.get(computerId), live.get(computerId));
  return (
    <section aria-label="Computer control request" className="flex flex-col gap-2 py-2">
      <Txt variant="body-sm">The agent asked you to take over the computer{reason ? `: ${reason}` : '.'}</Txt>
      {scope && control.holder === 'human' && (
        <HandBack computerId={computerId} threadId={scope.threadId} resourceId={scope.resourceId} />
      )}
    </section>
  );
}
