import type { AgentControllerTaskSnapshot } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { TaskList } from '@/ds/components/ai/task-list';
import { ChatShell } from '@/ds/components/ChatShell';
import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { Spinner } from '@/ds/components/Spinner';
import { Sizes } from '@/ds/tokens/sizes';
import { cn } from '@/utils/cn';

import './session-surface.css';

const CHAT_HEADER_TOP_PX = 8;
/** Room the floating session header takes above the transcript. */
const chatHeaderRoomPx = Number.parseFloat(Sizes['header-default']) + CHAT_HEADER_TOP_PX;
const PREVIOUS_TURN_PEEK_PX = 64;

export interface SessionSurfaceLoadMore {
  hasMore: boolean;
  isLoading: boolean;
  load?: () => void;
}

export interface SessionSurfaceProps {
  busy: boolean;
  /** The thread's first message window is still loading; the transcript stays veiled. */
  preparing: boolean;
  tasks: AgentControllerTaskSnapshot[];
  loadMore: SessionSurfaceLoadMore;
  /** The conversation: the history loader, the empty state and `TranscriptEntries`, inside the host's error boundary. */
  children: ReactNode;
  composer: ReactNode;
  composerLabel: string;
  secondaryBar?: ReactNode;
  contentOverlay?: ReactNode;
  /** Host layout hooks, e.g. Factory's column width and the room its files panel reserves. */
  className?: string;
  viewportClassName?: string;
  composerColumnClassName?: string;
}

/** A session's page body, shared by every host: transcript, tasks and the composer dock. */
export function SessionSurface({
  busy,
  preparing,
  tasks,
  loadMore,
  children,
  composer,
  composerLabel,
  secondaryBar,
  contentOverlay,
  className,
  viewportClassName,
  composerColumnClassName,
}: SessionSurfaceProps) {
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;

  return (
    <ChatShell
      className={cn('chat-surface-enter flex-1 [--chat-gutter:0.25rem]', className)}
      scroller={{
        autoScroll: true,
        defaultScrollPosition: busy ? 'end' : 'last-anchor',
        preserveScrollOnPrepend: true,
        onReachStart: canLoadMore ? loadMore.load : undefined,
        scrollPreviousItemPeek: chatHeaderRoomPx + PREVIOUS_TURN_PEEK_PX,
      }}
    >
      {secondaryBar && <ChatShell.Bar className="not-empty:mt-(--chat-header-room)">{secondaryBar}</ChatShell.Bar>}
      <ChatShell.Stage>
        <ChatShell.Viewport className={viewportClassName}>
          <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
            {/* A fixed slot: mounting the rail straight into this box would restyle the whole transcript beside it. */}
            <div className="contents">{contentOverlay}</div>
            <ChatShell.Content
              role="region"
              aria-label="Conversation"
              aria-busy={preparing}
              // A sibling selector, not `:has()`: under `:has()` every new message would restyle the whole transcript.
              className="relative gap-0 pt-[calc(var(--chat-header-room,0px)+1.5rem)] [[data-slot=chat-shell-bar]:not(:empty)~[data-slot=message-scroller]_&]:pt-6"
            >
              <SessionPreparationOverlay preparing={preparing} />
              <ChatShell.Transcript className="flex-1">{children}</ChatShell.Transcript>
            </ChatShell.Content>
            <ChatShell.Dock className="pb-[calc(var(--chat-gutter)+env(safe-area-inset-bottom))]">
              <ChatShell.ScrollButton aria-label="Jump to latest message" busy={busy} />
              <ChatShell.Column className={cn('gap-2', composerColumnClassName)}>
                <TaskPanel tasks={tasks} />
                <div role="region" aria-label={composerLabel}>
                  <div className="composer-enter flex w-full max-w-full min-w-0 shrink-0 flex-col gap-1.5">
                    {composer}
                  </div>
                </div>
              </ChatShell.Column>
            </ChatShell.Dock>
          </div>
        </ChatShell.Viewport>
      </ChatShell.Stage>
    </ChatShell>
  );
}

export function TaskPanel({ tasks }: { tasks: AgentControllerTaskSnapshot[] }) {
  if (!tasks.some(task => task.status !== 'completed')) return null;

  return (
    <div role="region" aria-label="Current tasks" data-testid="task-panel">
      <TaskList tasks={tasks} />
    </div>
  );
}

export function TranscriptHistoryLoader({ loading }: { loading: boolean }) {
  if (!loading) return null;

  return (
    <div className="flex w-full justify-center py-2">
      <Spinner size="sm" className="text-muted-foreground" aria-label="Loading older messages" />
    </div>
  );
}

/** Placeholder turns while a thread's first message window loads. */
export function TranscriptLoading() {
  return (
    <div role="status" aria-label="Loading messages" className="flex w-full flex-col gap-6">
      {[0, 1, 2].map(turn => (
        <div key={turn} aria-hidden className="flex flex-col">
          {['w-1/2', 'w-1/3'].map(width => (
            <div key={width} className="flex h-6 items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-sm motion-reduce:before:animate-none" />
              <Skeleton className={cn('h-3', width, 'motion-reduce:before:animate-none')} />
            </div>
          ))}
          <SkeletonText line="text-body" className="w-full motion-reduce:before:animate-none" />
          <SkeletonText line="text-body" className="w-2/3 motion-reduce:before:animate-none" />
        </div>
      ))}
    </div>
  );
}

export function SessionPreparationOverlay({ preparing }: { preparing: boolean }) {
  return (
    <div
      aria-hidden={!preparing}
      // `overflow-clip`, not `overflow-hidden`: a hidden overflow would hold the pinned box below instead of the scroller.
      className="session-preparation-overlay pointer-events-none absolute inset-0 z-5 overflow-clip bg-(--chat-surface) data-[preparing=false]:bg-transparent"
      data-preparing={preparing}
    >
      {/* Pinned to what the scroller shows: loaded history is usually taller than the screen and opens at its
          end, so a mask laid over the whole transcript would sweep its top, off screen. */}
      <div className="sticky top-0 h-[100cqh]">
        <div aria-hidden="true" className="session-preparation-veil absolute inset-x-0 opacity-0" />
        <div className="session-preparation-loader invisible absolute inset-0 z-1 -translate-y-1 bg-(--chat-surface) opacity-0">
          {/* Stays mounted through the exit fade; `aria-hidden` above drops it from the accessibility tree. */}
          <ChatShell.Column className="pt-[calc(var(--chat-header-room,0px)+1.5rem)]">
            <TranscriptLoading />
          </ChatShell.Column>
        </div>
      </div>
    </div>
  );
}
