import type { McpServerEventOccurrence } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useEffect, useReducer, useRef } from 'react';
import { eventRequestErrorMessage } from './use-mcp-server-events';

/** Occurrences kept on screen; older ones drop off the end. */
export const MAX_FEED_ITEMS = 200;

export type EventFeedStatus = 'idle' | 'connecting' | 'live' | 'polling' | 'stopped' | 'error';

/** An occurrence, or a marker that events before it may have been skipped. Newest first. */
export type EventFeedItem =
  | { kind: 'occurrence'; key: string; occurrence: McpServerEventOccurrence }
  | { kind: 'gap'; key: string };

interface FeedState {
  status: EventFeedStatus;
  cursor?: string;
  items: EventFeedItem[];
  error?: string;
  /** A recoverable problem the stream reported, e.g. a failing filter; the stream stays open. */
  warning?: string;
}

type FeedAction =
  | { type: 'status'; status: EventFeedStatus }
  | { type: 'cursor'; cursor?: string | null }
  | { type: 'gap' }
  | { type: 'occurrences'; occurrences: McpServerEventOccurrence[] }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

let nextKey = 0;
const key = () => `feed-${nextKey++}`;

function prepend(items: EventFeedItem[], added: EventFeedItem[]): EventFeedItem[] {
  return [...added, ...items].slice(0, MAX_FEED_ITEMS);
}

function reduce(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status, error: undefined, warning: undefined };
    case 'cursor':
      return action.cursor ? { ...state, cursor: action.cursor } : state;
    case 'gap':
      return { ...state, items: prepend(state.items, [{ kind: 'gap', key: key() }]) };
    case 'occurrences': {
      // Occurrences arrive oldest first; the feed shows the newest on top.
      const added = [...action.occurrences]
        .reverse()
        .map(occurrence => ({ kind: 'occurrence' as const, key: key(), occurrence }));
      return { ...state, items: prepend(state.items, added) };
    }
    case 'warning':
      return { ...state, warning: action.message };
    case 'error':
      return { ...state, status: 'error', error: action.message };
  }
}

const initialState: FeedState = { status: 'idle', items: [] };

/**
 * Live occurrences of one event type: `start`/`stop` an SSE stream (push types) or `pollOnce`
 * (any type). Both resume from the last cursor. The stream is aborted on stop and on unmount,
 * so closing the drawer or leaving the page ends it.
 */
export function useMcpEventFeed(serverId: string, eventName: string) {
  const client = useMastraClient();
  const [state, dispatch] = useReducer(reduce, initialState);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const cursorRef = useRef<string | undefined>(undefined);

  const setCursor = (cursor?: string | null) => {
    if (cursor) cursorRef.current = cursor;
    dispatch({ type: 'cursor', cursor });
  };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const stop = () => {
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    dispatch({ type: 'status', status: 'stopped' });
  };

  const start = async (args: Record<string, unknown>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'status', status: 'connecting' });

    try {
      const frames = client.streamMcpServerEvent(
        serverId,
        eventName,
        { arguments: args, cursor: cursorRef.current },
        { signal: controller.signal },
      );
      for await (const frame of frames) {
        if (controller.signal.aborted) return;
        if (frame.type === 'active') {
          dispatch({ type: 'status', status: 'live' });
          setCursor(frame.cursor);
          if (frame.truncated) dispatch({ type: 'gap' });
        } else if (frame.type === 'event') {
          dispatch({ type: 'occurrences', occurrences: [frame.occurrence] });
          setCursor(frame.occurrence.cursor);
        } else if (frame.type === 'heartbeat') {
          setCursor(frame.cursor);
        } else if (frame.type === 'error') {
          dispatch({ type: 'warning', message: frame.message });
        } else {
          break;
        }
      }
      if (!controller.signal.aborted) dispatch({ type: 'status', status: 'stopped' });
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({ type: 'error', message: eventRequestErrorMessage(error) });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = undefined;
    }
  };

  const pollOnce = async (args: Record<string, unknown>) => {
    dispatch({ type: 'status', status: 'polling' });
    try {
      const result = await client.pollMcpServerEvent(serverId, eventName, {
        arguments: args,
        cursor: cursorRef.current,
      });
      if (result.truncated) dispatch({ type: 'gap' });
      dispatch({ type: 'occurrences', occurrences: result.events });
      setCursor(result.cursor);
      dispatch({ type: 'status', status: 'idle' });
    } catch (error) {
      dispatch({ type: 'error', message: eventRequestErrorMessage(error) });
    }
  };

  return { ...state, start, stop, pollOnce };
}
