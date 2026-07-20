import { FileText } from 'lucide-react';
import * as React from 'react';

import type { ThreadRailTurn } from './thread-rail-turns';

import { useOptionalMessageScroller, useOptionalMessageScrollerVisibility } from '@/ds/components/MessageScroller';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { cn } from '@/lib/utils';

type ThreadRailPreviewPhase = 'hidden' | 'entering' | 'visible' | 'exiting';

type ThreadRailPreviewState = {
  currentTurn: ThreadRailTurn | undefined;
  previousTurn: ThreadRailTurn | undefined;
  index: number | null;
  phase: ThreadRailPreviewPhase;
  top: number;
  transitionKey: number;
};

const PREVIEW_TRANSITION_DURATION_MS = 360;
const PREVIEW_CLEANUP_DELAY_MS = PREVIEW_TRANSITION_DURATION_MS + 80;

const DEFAULT_PREVIEW_STATE: ThreadRailPreviewState = {
  currentTurn: undefined,
  previousTurn: undefined,
  index: null,
  phase: 'hidden',
  top: 0,
  transitionKey: 0,
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
  const messageScroller = useOptionalMessageScroller();
  const scrollerVisibility = useOptionalMessageScrollerVisibility();

  const fallbackMessageId = turns.at(-1)?.messageId;
  const activeMessageId = currentAnchorId ?? scrollerVisibility?.currentAnchorId ?? fallbackMessageId;
  const resolvedVisibleMessageIds =
    visibleMessageIds ?? scrollerVisibility?.visibleMessageIds ?? (activeMessageId ? [activeMessageId] : []);
  const visibleMessageIdSet = new Set(resolvedVisibleMessageIds);
  const previewHoverActive = previewState.phase === 'entering' || previewState.phase === 'visible';
  const hoveredIndex = previewHoverActive ? previewState.index : null;
  const selectTurn = React.useCallback(
    (turn: ThreadRailTurn) => {
      if (onSelect) {
        onSelect(turn);
        return;
      }

      messageScroller?.scrollToMessage(turn.messageId, { behavior: 'smooth', align: 'start' });
    },
    [messageScroller, onSelect],
  );

  const showPreview = (index: number, element: HTMLElement) => {
    const railTop = railRef.current?.getBoundingClientRect().top ?? 0;
    const itemRect = element.getBoundingClientRect();
    const nextTurn = turns[index];
    if (!nextTurn) return;

    setPreviewState(current => {
      const nextTop = itemRect.top + itemRect.height / 2 - railTop;
      if (current.index === index && current.phase !== 'hidden' && current.phase !== 'exiting') {
        return { ...current, top: nextTop };
      }

      const previousTurn =
        current.currentTurn && current.currentTurn.key !== nextTurn.key && current.phase !== 'hidden'
          ? current.currentTurn
          : undefined;

      return {
        currentTurn: nextTurn,
        previousTurn,
        index,
        phase: 'entering',
        top: nextTop,
        transitionKey: current.transitionKey + 1,
      };
    });
  };

  const hidePreview = () => {
    setPreviewState(current => {
      if (!current.currentTurn || current.phase === 'hidden' || current.phase === 'exiting') {
        return { ...current, index: null };
      }

      return {
        ...current,
        index: null,
        previousTurn: undefined,
        phase: 'exiting',
        transitionKey: current.transitionKey + 1,
      };
    });
  };

  React.useEffect(() => {
    if (previewState.phase !== 'entering') return;

    const requestFrame = window.requestAnimationFrame ?? window.setTimeout;
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    let settleFrame: number | undefined;
    const startFrame = requestFrame(() => {
      settleFrame = requestFrame(() => {
        setPreviewState(current =>
          current.transitionKey === previewState.transitionKey && current.phase === 'entering'
            ? { ...current, phase: 'visible' }
            : current,
        );
      });
    });

    return () => {
      cancelFrame(startFrame);
      if (settleFrame !== undefined) cancelFrame(settleFrame);
    };
  }, [previewState.phase, previewState.transitionKey]);

  React.useEffect(() => {
    if (previewState.phase !== 'visible' || !previewState.previousTurn) return;

    const timeout = window.setTimeout(() => {
      setPreviewState(current =>
        current.transitionKey === previewState.transitionKey ? { ...current, previousTurn: undefined } : current,
      );
    }, PREVIEW_CLEANUP_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [previewState.phase, previewState.previousTurn, previewState.transitionKey]);

  React.useEffect(() => {
    if (previewState.phase !== 'exiting') return;

    const timeout = window.setTimeout(() => {
      setPreviewState(current =>
        current.transitionKey === previewState.transitionKey ? DEFAULT_PREVIEW_STATE : current,
      );
    }, PREVIEW_CLEANUP_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [previewState.phase, previewState.transitionKey]);

  if (turns.length === 0) return null;

  return (
    <nav
      ref={railRef}
      aria-label={label}
      data-testid="thread-rail"
      className={cn('relative w-8 py-2', className)}
      onMouseLeave={hidePreview}
      onBlur={event => {
        const nextFocus = event.relatedTarget;
        if (!(nextFocus instanceof Node) || !event.currentTarget.contains(nextFocus)) hidePreview();
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
                onSelect={selectTurn}
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
          phase={previewState.phase}
          top={previewState.top}
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
  onSelect: (turn: ThreadRailTurn) => void;
}

/** Width of a rail tick: widest at the hovered item, tapering to neighbours. */
const getRailItemWidth = (distance: number | null): string => {
  if (distance === 0) return 'w-4';
  if (distance === 1) return 'w-3';
  return 'w-2';
};

/** Background tone of a rail tick, prioritising hovered/active, then in-view, then proximity. */
const getRailItemTone = ({
  distance,
  active,
  inView,
}: Pick<ThreadRailItemProps, 'distance' | 'active' | 'inView'>): string => {
  if (distance === 0 || active) return 'bg-neutral6';
  if (inView) return 'bg-neutral5';
  if (distance === 1) return 'bg-neutral4';
  return 'bg-neutral3/60';
};

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
  const size = getRailItemWidth(distance);
  const tone = getRailItemTone({ distance, active, inView });

  return (
    <div
      data-in-view={inView ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      className="group/thread-rail-item relative flex items-center"
    >
      <button
        type="button"
        aria-label={`Jump to ${turn.prompt}`}
        aria-current={active ? 'location' : undefined}
        aria-describedby={previewId}
        data-in-view={inView ? 'true' : undefined}
        data-active={active ? 'true' : undefined}
        onClick={() => onSelect(turn)}
        onMouseEnter={event => onHoverChange(index, event.currentTarget)}
        onFocus={event => onHoverChange(index, event.currentTarget)}
        className={cn(
          'duration-normal relative block h-px cursor-pointer rounded-full transition-[width,background-color] ease-out',
          "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
          'focus-visible:ring-2 focus-visible:ring-accent1/40 focus-visible:outline-hidden',
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
  phase,
  top,
}: {
  id: string;
  currentTurn: ThreadRailTurn;
  previousTurn: ThreadRailTurn | undefined;
  phase: ThreadRailPreviewPhase;
  top: number;
}) {
  const {
    ref: previewSizerRef,
    heightStyle: previewHeightStyle,
    measure: measurePreviewHeight,
  } = useMeasuredAutoHeight<HTMLDivElement>();
  const containerVisible = phase === 'visible' || (phase === 'entering' && Boolean(previousTurn));
  // Entering and exiting share the same off-screen resting style.
  const hiddenLayerClassName = 'scale-95 opacity-0 blur-xs';
  const visibleLayerClassName = 'scale-100 opacity-100 blur-none';
  const layerClassName =
    'absolute inset-x-0 top-0 h-full origin-left transition-[opacity,filter,scale] duration-150 ease-in-out will-change-[opacity,filter,scale] motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-none';

  React.useLayoutEffect(() => {
    measurePreviewHeight();
  }, [currentTurn.key, phase, measurePreviewHeight]);

  return (
    <div
      id={id}
      data-testid="thread-rail-preview"
      data-visible={containerVisible ? 'true' : undefined}
      className={cn(
        'pointer-events-none absolute top-0 left-full z-30 ml-3 w-72 overflow-hidden rounded-xl border border-border1 bg-surface3 text-left shadow-dialog transition-[height,translate,opacity] duration-360 ease-out-custom will-change-[height,translate,opacity] motion-reduce:transition-none',
        containerVisible ? 'opacity-100' : 'opacity-0',
      )}
      style={{ ...previewHeightStyle, translate: `0 calc(${top}px - 50%)` }}
    >
      <div ref={previewSizerRef} data-testid="thread-rail-preview-sizer" aria-hidden className="invisible grid">
        <ThreadRailPreviewContent turn={currentTurn} className="col-start-1 row-start-1 p-3.5" />
      </div>
      <div data-testid="thread-rail-preview-viewport" className="absolute inset-0">
        <div className="relative h-full">
          {previousTurn && (
            <div
              key={previousTurn.key}
              data-testid="thread-rail-preview-previous"
              aria-hidden
              className={cn(layerClassName, phase === 'entering' ? visibleLayerClassName : hiddenLayerClassName)}
            >
              <ThreadRailPreviewContent turn={previousTurn} className="p-3.5" />
            </div>
          )}
          <div
            key={currentTurn.key}
            data-testid="thread-rail-preview-current"
            className={cn(layerClassName, phase === 'visible' ? visibleLayerClassName : hiddenLayerClassName)}
          >
            <ThreadRailPreviewContent turn={currentTurn} className="p-3.5" />
          </div>
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
      <div className="truncate text-ui-md leading-ui-md font-medium text-neutral6">{turn.prompt}</div>
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
