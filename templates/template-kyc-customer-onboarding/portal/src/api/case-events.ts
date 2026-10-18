import { useEffect, useRef, useState } from 'react';

import { publicApiRoutes, type CaseEventView } from '../../../src/contracts/http/public-api.js';
import type { KycApiClient } from './client.js';

export type EventFeedState = Readonly<{
  events: readonly CaseEventView[];
  mode: 'connecting' | 'live' | 'polling' | 'closed';
  error: string | null;
}>;

const appendUnique = (current: readonly CaseEventView[], additions: readonly CaseEventView[]) => {
  const byId = new Map(current.map(event => [event.eventId, event]));
  for (const event of additions) byId.set(event.eventId, event);
  return [...byId.values()].sort((left, right) => left.caseVersion - right.caseVersion);
};

export const useCaseEvents = (client: KycApiClient, caseId: string | undefined): EventFeedState => {
  const [state, setState] = useState<EventFeedState>({
    events: [],
    mode: caseId === undefined ? 'closed' : 'connecting',
    error: null,
  });
  const cursor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (caseId === undefined) {
      setState({ events: [], mode: 'closed', error: null });
      return;
    }
    let stopped = false;
    let source: EventSource | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;
    let firstFailureAt: number | undefined;

    const poll = async () => {
      try {
        const page = await client.getEvents(caseId, cursor.current);
        if (stopped) return;
        const last = page.events.at(-1);
        if (last !== undefined) cursor.current = last.eventId;
        setState(current => ({
          events: appendUnique(current.events, page.events),
          mode: page.terminal ? 'closed' : 'polling',
          error: null,
        }));
        if (page.terminal && pollTimer !== undefined) clearInterval(pollTimer);
      } catch {
        if (!stopped) setState(current => ({ ...current, error: 'Live updates are retrying' }));
      }
    };

    const startPolling = () => {
      source?.close();
      setState(current => ({ ...current, mode: 'polling', error: null }));
      void poll();
      pollTimer = setInterval(() => void poll(), 2_000);
      retryTimer = setTimeout(() => {
        if (pollTimer !== undefined) clearInterval(pollTimer);
        connect();
      }, 30_000);
    };

    const connect = () => {
      if (stopped || typeof EventSource === 'undefined') {
        startPolling();
        return;
      }
      const query = cursor.current === undefined ? '' : `?cursor=${encodeURIComponent(cursor.current)}`;
      source = new EventSource(`${client.baseUrl}${publicApiRoutes.caseEvents(caseId)}${query}`, {
        withCredentials: true,
      });
      setState(current => ({ ...current, mode: 'connecting' }));
      source.addEventListener('open', () => {
        failureCount = 0;
        firstFailureAt = undefined;
        setState(current => ({ ...current, mode: 'live', error: null }));
      });
      source.addEventListener('case-event', event => {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as CaseEventView;
        cursor.current = parsed.eventId;
        setState(current => ({
          events: appendUnique(current.events, [parsed]),
          mode: 'live',
          error: null,
        }));
      });
      source.addEventListener('terminal', () => {
        source?.close();
        setState(current => ({ ...current, mode: 'closed', error: null }));
      });
      source.addEventListener('error', () => {
        failureCount += 1;
        firstFailureAt ??= Date.now();
        if (failureCount >= 3 || Date.now() - firstFailureAt >= 15_000) startPolling();
      });
    };

    cursor.current = undefined;
    setState({ events: [], mode: 'connecting', error: null });
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (pollTimer !== undefined) clearInterval(pollTimer);
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, [caseId, client]);

  return state;
};
