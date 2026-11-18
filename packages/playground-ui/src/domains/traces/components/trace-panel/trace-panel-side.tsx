import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';

import { TraceMessagesPanel } from '../trace-messages-panel';
import type { TraceMessagesPanelProps } from '../trace-messages-panel';
import { useTracePanelColumns } from './trace-panel-columns-context';
import { useTracePanel } from './trace-panel-context';
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
import { PanelSeparator } from '@/lib/resize/separator';

export interface TracePanelSideProps {
  /** The view shown until the reader or the root picks another (e.g. `messages`). */
  defaultView?: string;
  /** Typically a `TracePanel.SideHeader` above one content part per tab. */
  children: ReactNode;
}

/**
 * The resizable column next to the span tree, holding one view at a time (Messages, Feedback, Scores,
 * or the host's own), switched by the tabs of its `TracePanel.SideHeader`. Render it first in `TracePanel.Body`.
 */
export function TracePanelSide({ defaultView, children }: TracePanelSideProps) {
  const { sideView, setSideView } = useTracePanel();
  const { sideWidth } = useTracePanelColumns();
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

  return (
    <TracePanelSideContext.Provider value={{ view: sideView ?? defaultView, setView: setSideView, compact }}>
      <Panel id="trace-side" minSize={280} defaultSize={sideWidth()} groupResizeBehavior="preserve-pixel-size">
        <div className="flex h-full min-h-0 flex-col border-r border-surface-rim">
          <div
            ref={setElement}
            data-trace-side-column
            className="@container flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          >
            {children}
          </div>
        </div>
      </Panel>
      <PanelSeparator variant="pill" />
    </TracePanelSideContext.Provider>
  );
}

export interface TracePanelSideHeaderProps {
  /** Typically `TracePanel.SideTabs`, then `TracePanel.SideActions`. */
  children: ReactNode;
}

/** The tab row of the side column. While the spans load it holds placeholders, so the tabs don't flicker in. */
export function TracePanelSideHeader({ children }: TracePanelSideHeaderProps) {
  const { isLoading } = useTracePanel();
  const { view, setView } = useTracePanelSide();
  if (isLoading) {
    return (
      <DataPanel.Header className="border-b border-surface-rim">
        <div aria-hidden className="flex h-control-sm items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </DataPanel.Header>
    );
  }
  return (
    <Tabs<string> defaultTab={view ?? ''} value={view ?? ''} onValueChange={setView}>
      {/* `flex-nowrap` + a shrinkable tab column: the tab list's scroll wrapper is full-width,
          so in a wrapping row it would push the actions onto a second line. */}
      <DataPanel.Header className="flex-nowrap border-b border-surface-rim">{children}</DataPanel.Header>
    </Tabs>
  );
}

/** The side column's tabs, one per view the host composed. */
export function TracePanelSideTabs({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <TabList variant="pill-ghost" size="sm">
        {children}
      </TabList>
    </div>
  );
}

export interface TracePanelSideTabProps {
  /** The view the tab opens; matches a `TracePanel.SideContent` of the same value. */
  value: string;
  label: string;
  icon: ReactNode;
  /** Shown after the label, e.g. `Feedback (3)`. */
  count?: ReactNode;
}

/** One tab of the side column; its label collapses to the icon (with a tooltip) when the column is narrow. */
export function TracePanelSideTab({ value, label, icon, count }: TracePanelSideTabProps) {
  const { compact } = useTracePanelSide();
  return (
    <Tab value={value} tooltip={compact ? label : undefined}>
      <Icon size="xs">{icon}</Icon>
      <span className="@max-[501px]:sr-only">
        {label}
        {count != null && <> ({count})</>}
      </span>
    </Tab>
  );
}

type PresetTabProps = Pick<TracePanelSideTabProps, 'count'>;

export function TracePanelMessagesTab() {
  return <TracePanelSideTab value="messages" label="Messages" icon={<IconChatBubble7 />} />;
}

export function TracePanelFeedbackTab({ count }: PresetTabProps) {
  return <TracePanelSideTab value="feedback" label="Feedback" icon={<IconChatBubble7Plus />} count={count} />;
}

export function TracePanelScoresTab({ count }: PresetTabProps) {
  return <TracePanelSideTab value="scores" label="Scores" icon={<ScorersIcon />} count={count} />;
}

/** Trailing controls of the side column's tab row (e.g. "Open full thread"). */
export function TracePanelSideActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center whitespace-nowrap">{children}</div>;
}

export interface TracePanelSideContentProps {
  value: string;
  /** Drops the content padding, for views that bring their own (e.g. the messages). */
  flush?: boolean;
  children: ReactNode;
}

/** What the side column shows while its tab is the open one. */
export function TracePanelSideContent({ value, flush, children }: TracePanelSideContentProps) {
  const { isLoading } = useTracePanel();
  const { view } = useTracePanelSide();
  if (isLoading || view !== value) return null;
  return <DataPanel.Content className={flush ? 'p-0' : undefined}>{children}</DataPanel.Content>;
}

export type TracePanelMessagesProps = Omit<TraceMessagesPanelProps, 'className'>;

/** The Messages view: the trace as the agent turn it recorded, rebuilt from the full spans it is given (`getTrace`). */
export function TracePanelMessages(props: TracePanelMessagesProps) {
  return (
    <TracePanelSideContent value="messages" flush>
      <TraceMessagesPanel {...props} />
    </TracePanelSideContent>
  );
}

/** The Feedback view: whatever feedback UI the host renders with its data (e.g. `FeedbackThread`). */
export function TracePanelFeedback({ children }: { children: ReactNode }) {
  return <TracePanelSideContent value="feedback">{children}</TracePanelSideContent>;
}

/** The Scores view: whatever scores UI the host renders with its data (e.g. `TraceScoresListView`). */
export function TracePanelScores({ children }: { children: ReactNode }) {
  return <TracePanelSideContent value="scores">{children}</TracePanelSideContent>;
}

export interface TracePanelOpenFullThreadButtonProps {
  /** Opens the trace's whole thread; the host renders it (e.g. in a stacked `TraceThreadPanelView`). */
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
