import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { PendingIndicator } from '@mastra/playground-ui/components/PendingIndicator';
import type { MessageFactoryPart } from '@mastra/react/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { MessageRow, MessagesSkeleton } from './messages';

/**
 * Returns true only after `flag` has stayed true for `delayMs` continuously.
 * If `flag` flips back to false before the delay elapses (e.g. data resolved
 * locally), nothing is shown — preventing a brief skeleton flash.
 */
const useDelayedFlag = (flag: boolean, delayMs: number) => {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const id = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(id);
  }, [flag, delayMs]);
  return delayed;
};

const SKELETON_DELAY_MS = 300;

/** Distance from the top (px) within which scrolling counts as "reached the start". */
const REACH_START_THRESHOLD = 48;

interface MessageListProps {
  messages: MastraDBMessage[];
  isLoading?: boolean;
  isRunning?: boolean;
  emptyState?: ReactNode;
  skeletonTestId?: string;
  /** Called once per trip to the top of the list when older history is available. */
  onLoadPrevious?: () => void;
  isLoadingPrevious?: boolean;
}

/**
 * Keeps the viewport pinned to the newest message as the tail grows or streams,
 * and holds the reader's position when older pages are prepended above.
 */
const useTailScroll = (messages: MastraDBMessage[], isLoadingPrevious: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const prependAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const firstIdRef = useRef<string | undefined>(undefined);
  const prependedThisCommitRef = useRef(false);
  const first = messages[0];
  const last = messages[messages.length - 1];
  const tailKey = last ? `${last.id}:${last.content.parts.length}:${messages.length}` : '';

  useLayoutEffect(() => {
    const el = ref.current;
    const previousFirstId = firstIdRef.current;
    firstIdRef.current = first?.id;
    const anchor = prependAnchorRef.current;
    if (!el || !anchor || first?.id === previousFirstId) return;
    prependAnchorRef.current = null;
    prependedThisCommitRef.current = true;
    el.scrollTop = anchor.scrollTop + (el.scrollHeight - anchor.scrollHeight);
  }, [first?.id]);

  useEffect(() => {
    // The older-page request settled without moving the first message (failed,
    // or only re-served rows the dedupe dropped): release the anchor so the
    // tail can be followed again.
    if (!isLoadingPrevious) prependAnchorRef.current = null;
  }, [isLoadingPrevious]);

  useEffect(() => {
    const el = ref.current;
    // A prepend also changes `messages.length`; the anchor above already placed us.
    // Likewise, don't jump to the tail while an older page is still in flight.
    const skip = prependedThisCommitRef.current || prependAnchorRef.current !== null;
    prependedThisCommitRef.current = false;
    if (!el || skip) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [tailKey]);

  const anchorForPrepend = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    prependAnchorRef.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
  }, []);

  return { ref, anchorForPrepend };
};

/**
 * Detects whether the last assistant message has a part that is *actively*
 * streaming output. Completed tool calls (`output-available` / `output-error`)
 * are excluded so the pending indicator stays visible during quiet moments —
 * e.g. while the server is internally retrying via
 * `StreamErrorRetryProcessor` after the previous step finished cleanly.
 */
const hasStreamingPart = (message: MastraDBMessage | undefined) => {
  if (!message) return false;
  // `MastraMessagePart[]` widens into `MessageFactoryPart[]`, surfacing the
  // runtime `dynamic-tool` / `tool-${string}` parts, so no cast is needed.
  const parts: MessageFactoryPart[] = message.content.parts;
  return parts.some(part => {
    if (part.type === 'reasoning' || part.type === 'text') {
      return 'state' in part && part.state === 'streaming';
    }
    if (part.type === 'tool-invocation') {
      return 'toolInvocation' in part && part.toolInvocation.state !== 'result';
    }
    if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
      const state = 'state' in part ? part.state : undefined;
      return state !== 'output-available' && state !== 'output-error';
    }
    return false;
  });
};

export const MessageList = ({
  messages,
  isLoading = false,
  isRunning = false,
  emptyState,
  skeletonTestId,
  onLoadPrevious,
  isLoadingPrevious = false,
}: MessageListProps) => {
  const { ref: scrollRef, anchorForPrepend } = useTailScroll(messages, isLoadingPrevious);
  // Armed only once the reader has been seen below the threshold, so the
  // scroll events emitted by the mount-time smooth scroll can't trigger a load.
  const reachStartArmedRef = useRef(false);
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      if (el.scrollTop > REACH_START_THRESHOLD) {
        reachStartArmedRef.current = true;
        return;
      }
      if (!reachStartArmedRef.current || !onLoadPrevious) return;
      reachStartArmedRef.current = false;
      anchorForPrepend();
      onLoadPrevious();
    },
    [anchorForPrepend, onLoadPrevious],
  );
  const isLoadingEmpty = isLoading && messages.length === 0;
  // Defer the skeleton by 300ms so it doesn't flash on fast (local) responses.
  // If `isLoadingEmpty` flips false before the timer elapses, nothing renders.
  const showSkeleton = useDelayedFlag(isLoadingEmpty, SKELETON_DELAY_MS);
  const showEmpty = !isLoading && messages.length === 0 && emptyState !== undefined;
  const lastMessage = messages[messages.length - 1];
  const showPending =
    isRunning && !isLoadingEmpty && (lastMessage?.role !== 'assistant' || !hasStreamingPart(lastMessage));

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      style={{ viewTransitionName: 'agent-builder-messages' }}
      data-testid="agent-builder-message-list"
    >
      {showSkeleton ? (
        <MessagesSkeleton testId={skeletonTestId} />
      ) : showEmpty ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-4">
          {isLoadingPrevious && <PendingIndicator testId="agent-builder-chat-loading-previous" />}
          {messages.map(message => (
            <div key={message.id} data-message-id={message.id} className="contents">
              <MessageRow message={message} />
            </div>
          ))}
          {showPending && <PendingIndicator testId="agent-builder-chat-pending" />}
        </div>
      )}
    </div>
  );
};
