import { FileText } from 'lucide-react';
import * as React from 'react';

import { MessageScrollerButton } from './message-scroller';
import { useOptionalMessageScrollerVisibility } from './message-scroller-context';
import type { ThreadRailTurn } from './thread-rail-turns';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

type ThreadRailPreviewState = {
  currentTurn: ThreadRailTurn | undefined;
  previousTurn: ThreadRailTurn | undefined;
  direction: -1 | 1;
  index: number | null;
  settled: boolean;
  top: number;
  transitionKey: number;
  visible: boolean;
};

const PREVIEW_EXIT_DURATION_MS = 200;

const DEFAULT_PREVIEW_STATE: ThreadRailPreviewState = {
  currentTurn: undefined,
  previousTurn: undefined,
  direction: 1,
  index: null,
  settled: true,
  top: 0,
  transitionKey: 0,
  visible: false,
};

export interface ThreadRailProps {
  turns: ThreadRailTurn[];
  currentAnchorId?: string;
  visibleMessageIds?: string[];
  label?: string;
  className?: string;
  maxHeight?: string;
  scrollAreaClassName?: string;
  onSelect?: (turn: ThreadRailTurn) => void;
}

export function ThreadRail({
  turns,
  currentAnchorId,
  visibleMessageIds,
  label = 'Conversation timeline',
  className,
  maxHeight = 'calc(100dvh - 12rem)',
  scrollAreaClassName,
  onSelect,
}: ThreadRailProps) {
  const railRef = React.useRef<HTMLElement>(null);
  const previewId = React.useId();
  const [previewState, setPreviewState] = React.useState<ThreadRailPreviewState>(DEFAULT_PREVIEW_STATE);
  const scrollerVisibility = useOptionalMessageScrollerVisibility();

  const fallbackMessageId = turns.at(-1)?.messageId;
  const activeMessageId = currentAnchorId ?? scrollerVisibility?.currentAnchorId ?? fallbackMessageId;
  const resolvedVisibleMessageIds =
    visibleMessageIds ?? scrollerVisibility?.visibleMessageIds ?? (activeMessageId ? [activeMessageId] : []);
  const visibleMessageIdSet = new Set(resolvedVisibleMessageIds);
  const hoveredIndex = previewState.visible ? previewState.index : null;

  const showPreview = (index: number, element: HTMLElement) => {
    const railTop = railRef.current?.getBoundingClientRect().top ?? 0;
    const itemRect = element.getBoundingClientRect();
    const nextTurn = turns[index];
    if (!nextTurn) return;

    setPreviewState(current => {
      const nextTop = itemRect.top + itemRect.height / 2 - railTop;
      if (current.index === index && current.visible) {
        return { ...current, top: nextTop };
      }

      return {
        currentTurn: nextTurn,
        previousTurn: current.visible ? current.currentTurn : undefined,
        direction: current.index === null || index >= current.index ? 1 : -1,
        index,
        settled: false,
        top: nextTop,
        transitionKey: current.transitionKey + 1,
        visible: true,
      };
    });
  };

  const hidePreview = () => {
    setPreviewState(current => ({
      ...current,
      index: null,
      previousTurn: undefined,
      settled: true,
      visible: false,
    }));
  };

  React.useEffect(() => {
    if (previewState.settled) return;

    const requestFrame = window.requestAnimationFrame ?? window.setTimeout;
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    let settleFrame: number | undefined;
    const startFrame = requestFrame(() => {
      settleFrame = requestFrame(() => {
        setPreviewState(current =>
          current.transitionKey === previewState.transitionKey ? { ...current, settled: true } : current,
        );
      });
    });

    return () => {
      cancelFrame(startFrame);
      if (settleFrame !== undefined) cancelFrame(settleFrame);
    };
  }, [previewState.settled, previewState.transitionKey]);

  React.useEffect(() => {
    if (!previewState.settled || !previewState.previousTurn) return;

    const timeout = window.setTimeout(() => {
      setPreviewState(current =>
        current.transitionKey === previewState.transitionKey ? { ...current, previousTurn: undefined } : current,
      );
    }, PREVIEW_EXIT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [previewState.previousTurn, previewState.settled, previewState.transitionKey]);

  if (turns.length === 0) return null;

  return (
    <nav
      ref={railRef}
      aria-label={label}
      data-testid="thread-rail"
      className={cn('relative w-8 py-2', className)}
      onMouseLeave={hidePreview}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hidePreview();
      }}
    >
      <ScrollArea
        data-testid="thread-rail-scroll-area"
        maxHeight={maxHeight}
        className={cn('w-8', scrollAreaClassName)}
        viewPortClassName="pr-3"
      >
        <div className="flex w-4 flex-col items-start gap-2 py-2">
          {turns.map((turn, index) => {
            const distance = hoveredIndex === null ? null : Math.abs(index - hoveredIndex);
            const active = turn.messageId === activeMessageId;
            const inView = visibleMessageIdSet.has(turn.messageId);
            const previewActive = hoveredIndex === index;

            return (
              <ThreadRailItem
                key={turn.key}
                turn={turn}
                index={index}
                distance={distance}
                active={active}
                inView={inView}
                previewId={previewActive ? previewId : undefined}
                onHoverChange={showPreview}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </ScrollArea>

      {previewState.currentTurn && (
        <ThreadRailPreview
          id={previewId}
          currentTurn={previewState.currentTurn}
          previousTurn={previewState.previousTurn}
          direction={previewState.direction}
          settled={previewState.settled}
          visible={previewState.visible}
          style={{ top: previewState.top }}
        />
      )}
    </nav>
  );
}

interface ThreadRailItemProps {
  turn: ThreadRailTurn;
  index: number;
  distance: number | null;
  active: boolean;
  inView: boolean;
  previewId?: string;
  onHoverChange: (index: number, element: HTMLElement) => void;
  onSelect?: (turn: ThreadRailTurn) => void;
}

function ThreadRailItem({
  turn,
  index,
  distance,
  active,
  inView,
  previewId,
  onHoverChange,
  onSelect,
}: ThreadRailItemProps) {
  const size = distance === 0 ? 'w-4' : distance === 1 ? 'w-3' : 'w-2';
  const tone =
    distance === 0
      ? 'bg-neutral6'
      : active
        ? 'bg-neutral6'
        : inView
          ? 'bg-neutral5'
          : distance === 1
            ? 'bg-neutral4'
            : 'bg-neutral3/60';

  return (
    <div
      data-in-view={inView ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      className="group/thread-rail-item relative flex items-center"
    >
      <MessageScrollerButton
        messageId={turn.messageId}
        aria-label={`Jump to ${turn.prompt}`}
        aria-current={active ? 'location' : undefined}
        aria-describedby={previewId}
        data-in-view={inView ? 'true' : undefined}
        data-active={active ? 'true' : undefined}
        onClick={event => {
          onSelect?.(turn);
          if (onSelect) event.preventDefault();
        }}
        onMouseEnter={event => onHoverChange(index, event.currentTarget)}
        onFocus={event => onHoverChange(index, event.currentTarget)}
        className={cn(
          'relative block h-px cursor-pointer rounded-full transition-[width,background-color] duration-normal ease-out',
          "before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent1/40',
          size,
          tone,
        )}
      />
    </div>
  );
}

function ThreadRailPreview({
  id,
  currentTurn,
  previousTurn,
  direction,
  settled,
  visible,
  style,
}: {
  id: string;
  currentTurn: ThreadRailTurn;
  previousTurn: ThreadRailTurn | undefined;
  direction: -1 | 1;
  settled: boolean;
  visible: boolean;
  style?: React.CSSProperties;
}) {
  const containerVisible = visible && (settled || Boolean(previousTurn));
  const incomingOffset = direction === 1 ? 'translate-y-8' : '-translate-y-8';
  const outgoingOffset = direction === 1 ? '-translate-y-8' : 'translate-y-8';
  const enteringLayerClassName = `${incomingOffset} opacity-0`;
  const exitingLayerClassName = `${outgoingOffset} opacity-0`;
  const visibleLayerClassName = 'translate-y-0 opacity-100';
  const layerClassName =
    'absolute inset-x-0 top-0 h-full transition-[opacity,translate] duration-normal ease-out will-change-[opacity,translate] motion-reduce:translate-y-0 motion-reduce:transition-none';

  return (
    <div
      id={id}
      data-testid="thread-rail-preview"
      data-visible={visible ? 'true' : undefined}
      className={cn(
        'pointer-events-none absolute left-full z-30 ml-3 w-72 -translate-y-1/2 overflow-hidden rounded-xl border border-border1 bg-surface3 text-left shadow-dialog transition-[top,opacity] duration-normal ease-out motion-reduce:transition-none',
        containerVisible ? 'opacity-100' : 'opacity-0',
      )}
      style={style}
    >
      <div data-testid="thread-rail-preview-viewport" className="relative">
        <div aria-hidden className="invisible grid">
          {previousTurn && <ThreadRailPreviewContent turn={previousTurn} className="col-start-1 row-start-1 p-3.5" />}
          <ThreadRailPreviewContent turn={currentTurn} className="col-start-1 row-start-1 p-3.5" />
        </div>
        {previousTurn && (
          <div
            data-testid="thread-rail-preview-previous"
            aria-hidden
            className={cn(layerClassName, settled || !visible ? exitingLayerClassName : visibleLayerClassName)}
          >
            <ThreadRailPreviewContent turn={previousTurn} className="p-3.5" />
          </div>
        )}
        <div
          data-testid="thread-rail-preview-current"
          className={cn(
            layerClassName,
            !visible ? exitingLayerClassName : settled ? visibleLayerClassName : enteringLayerClassName,
          )}
        >
          <ThreadRailPreviewContent turn={currentTurn} className="p-3.5" />
        </div>
      </div>
    </div>
  );
}

function ThreadRailPreviewContent({
  turn,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { turn: ThreadRailTurn }) {
  return (
    <div className={className} {...props}>
      <div className="truncate text-ui-md font-medium leading-ui-md text-neutral6">{turn.prompt}</div>
      {turn.reply && <p className="mt-1.5 line-clamp-3 text-ui-sm leading-ui-sm text-neutral4">{turn.reply}</p>}
      {(turn.files.length > 0 || turn.hiddenFileCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border1/60 pt-2.5">
          {turn.files.map(file => (
            <span key={file} className="inline-flex max-w-44 items-center gap-1.5 truncate text-ui-sm text-neutral4">
              <FileText className="size-3.5 shrink-0 opacity-70" aria-hidden />
              {file}
            </span>
          ))}
          {turn.hiddenFileCount > 0 && (
            <span className="text-ui-sm font-medium text-neutral4">+{turn.hiddenFileCount}</span>
          )}
        </div>
      )}
    </div>
  );
}
