import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { IFRAME_LOAD_TIMEOUT_MS, requestComputerSession } from './computer-session';
import type { ComputerSessionResult, ComputerViewMode } from './computer-session';
import { computerPartKey } from './computer-state';
import { useComputerThread } from './computer-thread-context';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Txt } from '@/ds/components/Txt';

const NOT_RUNNING_POLL_MS = 5_000;
const STATUS_CODES = new Set([401, 429, 502]);

const STATUS_MESSAGES: Record<number, string> = {
  401: 'This viewer is no longer authorized. The computer may have been released.',
  429: 'Too many viewers are open for this computer. Close one and reconnect.',
  502: 'The desktop could not be reached.',
};

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
}

/**
 * A computer attached to the chat thread: live desktop, Watch / Take over, and Open in tab.
 * Only the occurrence that owns the current attachment connects; others are references.
 *
 * @experimental
 */
export function ComputerCard({ messageId, partIndex, computerId }: ComputerCardProps) {
  const { computers, scope } = useComputerThread();
  const entry = computers.get(computerId);
  const name = entry?.name ?? computerId;
  const isOwner = entry?.status === 'attached' && entry.ownerKey === computerPartKey(messageId, partIndex);

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

function LiveComputer({ computerId, threadId, resourceId }: LiveComputerProps) {
  const client = useMastraClient();
  const { baseUrl, apiPrefix, headers } = client.options;
  const [mode, setMode] = useState<ComputerViewMode>('watch');
  const [attempt, setAttempt] = useState(0);
  const [frameError, setFrameError] = useState<string>();
  const [tabError, setTabError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const session = useQuery({
    queryKey: ['computer-session', baseUrl, computerId, threadId, resourceId, mode, attempt],
    queryFn: ({ signal }) =>
      requestComputerSession({
        computerId,
        threadId,
        resourceId,
        mode,
        baseUrl,
        apiPrefix,
        headers: headers,
        signal,
      }),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: query => (query.state.data?.state === 'not-running' ? NOT_RUNNING_POLL_MS : false),
  });

  const connectUrl = session.data?.state === 'ready' ? session.data.connectUrl : undefined;

  useEffect(() => {
    setLoaded(false);
    setFrameError(undefined);
    if (!connectUrl) return;
    const expectedOrigin = new URL(connectUrl).origin;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== expectedOrigin) return;
      const data = event.data as { type?: unknown; code?: unknown } | null;
      if (data?.type !== 'mastra-computer-status' || typeof data.code !== 'number' || !STATUS_CODES.has(data.code)) {
        return;
      }
      setFrameError(STATUS_MESSAGES[data.code]);
    };
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => setFrameError('The desktop did not load in time.'), IFRAME_LOAD_TIMEOUT_MS);
    const clear = () => clearTimeout(timer);
    const frame = iframeRef.current;
    frame?.addEventListener('load', clear);
    return () => {
      clear();
      frame?.removeEventListener('load', clear);
      window.removeEventListener('message', onMessage);
    };
  }, [connectUrl]);

  const openInTab = async () => {
    setTabError(undefined);
    // Open synchronously inside the click so the popup keeps user activation.
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      setTabError('Your browser blocked the new tab.');
      return;
    }
    tab.opener = null;
    const result = await requestComputerSession({
      computerId,
      threadId,
      resourceId,
      mode,
      baseUrl,
      apiPrefix,
      headers: headers,
    });
    if (result.state !== 'ready') {
      tab.close();
      setTabError(SESSION_MESSAGES[result.state]);
      return;
    }
    tab.location.replace(result.connectUrl);
  };

  const sessionMessage =
    session.data && session.data.state !== 'ready'
      ? SESSION_MESSAGES[session.data.state]
      : session.isError
        ? SESSION_MESSAGES.error
        : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<ComputerViewMode> value={mode} onValueChange={setMode} aria-label="Computer view mode">
          <SegmentedControlItem value="watch">Watch</SegmentedControlItem>
          <SegmentedControlItem value="control">Take over</SegmentedControlItem>
        </SegmentedControl>
        <Button size="sm" variant="ghost" onClick={openInTab}>
          Open in tab
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAttempt(n => n + 1)}>
          Reconnect
        </Button>
        {mode === 'control' && <Badge variant="warning">You are controlling the desktop</Badge>}
      </div>
      {tabError && (
        <Notice variant="warning" title="Could not open the tab">
          <Notice.Message>{tabError}</Notice.Message>
        </Notice>
      )}
      {sessionMessage && (
        <Notice variant={session.data?.state === 'not-running' ? 'info' : 'warning'} title="Live view">
          <Notice.Message>{sessionMessage}</Notice.Message>
        </Notice>
      )}
      {frameError && (
        <Notice variant="warning" title="Live view">
          <Notice.Message>{frameError}</Notice.Message>
        </Notice>
      )}
      {connectUrl && (
        <div className="relative aspect-video w-full overflow-hidden">
          {!loaded && (
            <Txt variant="body-sm" className="absolute inset-0 flex items-center justify-center">
              Starting desktop…
            </Txt>
          )}
          <iframe
            key={connectUrl}
            ref={iframeRef}
            title="Computer desktop"
            src={connectUrl}
            onLoad={() => setLoaded(true)}
            className="size-full border-0"
          />
        </div>
      )}
    </div>
  );
}
