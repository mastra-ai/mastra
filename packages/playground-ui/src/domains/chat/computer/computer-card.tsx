import { useMastraClient } from '@mastra/react';
import { useEffect, useRef, useState } from 'react';

import { CONNECT_TIMEOUT_MS, requestComputerSession } from './computer-session';
import type { ComputerSessionResult, ComputerViewMode } from './computer-session';
import { computerPartKey } from './computer-state';
import { useComputerThread } from './computer-thread-context';
import { loadRfb } from './load-rfb';
import type { RfbClient } from './load-rfb';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Txt } from '@/ds/components/Txt';

export const NOT_RUNNING_POLL_MS = 5_000;

const SESSION_MESSAGES: Record<Exclude<ComputerSessionResult['state'], 'ready'>, string> = {
  'not-running': 'The computer is not running yet.',
  forbidden: 'This computer is not attached to this thread.',
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
 * A computer attached to the chat thread: live desktop, Watch / Take over, and Fullscreen.
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

/**
 * Renders the desktop with the bundled noVNC client over the server's
 * websockify proxy. No sandbox-served page or script ever loads in Studio.
 *
 * Each connection mints its own single-use ticket inside the effect, so a
 * remount (including React StrictMode's) never replays a consumed ticket.
 * Watch / Take over only flips `viewOnly` on the live connection: the server
 * requires write access for any viewer, so Watch is a display choice.
 */
function LiveComputer({ computerId, threadId, resourceId }: LiveComputerProps) {
  const client = useMastraClient();
  const { baseUrl, apiPrefix, headers } = client.options;
  const [mode, setMode] = useState<ComputerViewMode>('watch');
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>({ phase: 'connecting' });
  const screenRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RfbClient | undefined>(undefined);
  const viewOnlyRef = useRef(true);
  viewOnlyRef.current = mode === 'watch';
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
    if (rfbRef.current) rfbRef.current.viewOnly = mode === 'watch';
  }, [mode]);

  const sessionMessage = connection.phase === 'session' ? SESSION_MESSAGES[connection.state] : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<ComputerViewMode> value={mode} onValueChange={setMode} aria-label="Computer view mode">
          <SegmentedControlItem value="watch">Watch</SegmentedControlItem>
          <SegmentedControlItem value="control">Take over</SegmentedControlItem>
        </SegmentedControl>
        <Button size="sm" variant="ghost" onClick={() => void frameRef.current?.requestFullscreen?.()}>
          Fullscreen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAttempt(n => n + 1)}>
          Reconnect
        </Button>
        {mode === 'control' && <Badge variant="warning">You are controlling the desktop</Badge>}
      </div>
      {sessionMessage && (
        <Notice variant={connection.phase === 'session' && connection.state === 'not-running' ? 'info' : 'warning'} title="Live view">
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
