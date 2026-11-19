import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { TraceThreadItemView } from '../trace-thread-item-view';
import type { TraceThreadItemViewProps } from '../trace-thread-item-view';
import { useTracePanel } from './trace-panel-context';
import type { TraceSideView } from './trace-panel-context';
import { TracePanelSideContext, useTracePanelSide } from './trace-panel-side-context';
import { Button } from '@/ds/components/Button';
import { DataPanel } from '@/ds/components/DataPanel';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconChatBubble7Plus } from '@/ds/icons/central/IconChatBubble7Plus';
import { IconChatBubbles } from '@/ds/icons/central/IconChatBubbles';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { cn } from '@/utils/cn';

export interface TracePanelSideProps {
  /** The Messages view, typically a `TracePanel.Messages`. */
  messages?: ReactNode;
  /** The Feedback view: whatever feedback UI the host renders with its data (e.g. `FeedbackThread`). */
  feedback?: ReactNode;
  /** Shown after the Feedback label, e.g. `Feedback (3)`. */
  feedbackCount?: ReactNode;
  /** The Scores view: whatever scores UI the host renders with its data (e.g. `TraceScoresListView`). */
  scores?: ReactNode;
  /** Shown after the Scores label. */
  scoresCount?: ReactNode;
  /** At the end of the tab row, e.g. `TracePanel.OpenFullThreadButton`. */
  actions?: ReactNode;
  /** The view shown until the reader or the root picks another; defaults to the first one offered. */
  defaultView?: TraceSideView;
}

interface SideViewSlot {
  value: TraceSideView;
  label: string;
  icon: ReactNode;
  count?: ReactNode;
  content: ReactNode;
  /** The view brings its own padding. */
  flush?: boolean;
}

/**
 * The column next to the spans, one view at a time: one tab per view slot the host filled, in the order
 * Messages, Feedback, Scores. A view picked for another trace, or by the root (Scores once a scorer
 * started), falls back to the first one offered when this trace has no such view.
 */
export function TracePanelSide({
  messages,
  feedback,
  feedbackCount,
  scores,
  scoresCount,
  actions,
  defaultView,
}: TracePanelSideProps) {
  const { sideView, setSideView, isLoading } = useTracePanel();
  // Mirrors the column's `@max-[501px]` container query: the layout collapses in CSS, but tooltips
  // render in a portal outside the container, so they need the width in JS.
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!element || !('ResizeObserver' in globalThis)) return;
    const observer = new ResizeObserver(() => setCompact(element.clientWidth <= 500));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  const views: SideViewSlot[] = [];
  if (messages)
    views.push({ value: 'messages', label: 'Messages', icon: <IconChatBubble7 />, content: messages, flush: true });
  if (feedback)
    views.push({
      value: 'feedback',
      label: 'Feedback',
      icon: <IconChatBubble7Plus />,
      count: feedbackCount,
      content: feedback,
    });
  if (scores)
    views.push({ value: 'scores', label: 'Scores', icon: <ScorersIcon />, count: scoresCount, content: scores });
  const chosen = sideView ?? defaultView;
  const active = views.find(view => view.value === chosen) ?? views[0];

  return (
    <TracePanelSideContext.Provider value={{ compact }}>
      <div
        ref={setElement}
        data-trace-side-column
        className="@container flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      >
        {/* Whether a tab exists can depend on the spans, so the tabs wait for them; otherwise the
            column flickers as the first tab changes. */}
        {isLoading ? (
          <DataPanel.Header className="border-b border-surface-rim">
            <div aria-hidden className="flex h-control-sm items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </DataPanel.Header>
        ) : (
          <Tabs<string> defaultTab={active?.value ?? ''} value={active?.value ?? ''} onValueChange={setSideView}>
            {/* `flex-nowrap` + a shrinkable tab column: the tab list's scroll wrapper is full-width,
                so in a wrapping row it would push the actions onto a second line. */}
            <DataPanel.Header className="flex-nowrap border-b border-surface-rim">
              <div className="min-w-0 flex-1">
                <TabList variant="pill-ghost" size="sm">
                  {views.map(view => (
                    <Tab key={view.value} value={view.value} tooltip={compact ? view.label : undefined}>
                      <Icon size="xs">{view.icon}</Icon>
                      <span className="@max-[501px]:sr-only">
                        {view.label}
                        {view.count != null && <> ({view.count})</>}
                      </span>
                    </Tab>
                  ))}
                </TabList>
              </div>
              {actions && <div className="flex shrink-0 items-center whitespace-nowrap">{actions}</div>}
            </DataPanel.Header>
          </Tabs>
        )}
        {!isLoading && active && (
          <DataPanel.Content className={active.flush ? 'p-0' : undefined}>{active.content}</DataPanel.Content>
        )}
      </div>
    </TracePanelSideContext.Provider>
  );
}

export type TracePanelMessagesProps = TraceThreadItemViewProps;

/** The Messages view: the trace as the agent turn it recorded, rebuilt from the full spans it is given (`getTrace`). */
export function TracePanelMessages({ className, ...props }: TracePanelMessagesProps) {
  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      <TraceThreadItemView {...props} />
    </div>
  );
}

export interface TracePanelOpenFullThreadButtonProps {
  /** Opens the trace's whole thread; the host renders it (e.g. in a stacked `TraceThreadPanel`). */
  onClick: () => void;
}

/** "Open full thread", collapsing to a round icon button when the side column is narrow. */
export function TracePanelOpenFullThreadButton({ onClick }: TracePanelOpenFullThreadButtonProps) {
  const { compact } = useTracePanelSide();
  return (
    <Button
      tooltip={compact ? 'Open full thread' : undefined}
      icon={<IconChatBubbles />}
      variant="ghost"
      size="sm"
      // At a side column of 500px or less, collapse to a round icon button; the label stays for screen readers.
      className="@max-[501px]:w-control-sm @max-[501px]:rounded-full @max-[501px]:px-0 @max-[501px]:[&>[data-slot=button-icon]]:ml-0"
      onClick={onClick}
    >
      <span className="@max-[501px]:sr-only">Open full thread</span>
    </Button>
  );
}
