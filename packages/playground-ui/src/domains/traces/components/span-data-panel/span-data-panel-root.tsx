import { useState } from 'react';
import type { ReactNode } from 'react';

import type { SpanRecord, SpanTab } from '../../types';
import type { TraceNavigation } from '../trace-navigation';
import { TraceNavigationScope } from '../trace-navigation-scope';
import { SpanDataPanelContext } from './span-data-panel-context';
import type { PayloadView } from './span-data-panel-context';
import { getSpanTitle } from './span-data-panel-title';
import { DataPanel } from '@/ds/components/DataPanel';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { IconChatBubble7Plus } from '@/ds/icons/central/IconChatBubble7Plus';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { IconFileArrowRightIn } from '@/ds/icons/central/IconFileArrowRightIn';
import { IconFileArrowRightOut } from '@/ds/icons/central/IconFileArrowRightOut';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

// Mirrors `DataPanel.Content` without requiring the Drawer root (this panel also renders standalone).
// Sections bleed their hairlines through this padding, so the two must match.
const BODY_CLASS = 'min-h-0 flex-1 overflow-y-auto p-3';

export interface SpanDataPanelProps {
  traceId: string;
  spanId: string;
  /** Full span record (`getSpan`); the panel never fetches it. */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  /** Controls the open tab; the panel keeps its own when omitted. An asked tab that is not offered opens the first one. */
  activeTab?: SpanTab;
  onTabChange?: (tab: SpanTab) => void;
  /** Extra classes for the panel root (e.g. flattening the card when nested in another panel). */
  className?: string;
  /** Typically a `SpanDataPanel.Header`; it stays while the record loads or when it is missing. */
  header?: ReactNode;
  /** The Details tab, typically `SpanDataPanel.Details`. */
  details?: ReactNode;
  /** The Input tab, typically `SpanDataPanel.Input`. */
  input?: ReactNode;
  /** The Output tab, typically `SpanDataPanel.Output`. */
  output?: ReactNode;
  /** The Feedback tab: whatever feedback UI the host renders for the span (e.g. `FeedbackThread`). */
  feedback?: ReactNode;
  /** Shown after the Feedback label, e.g. `Feedback (3)`. */
  feedbackCount?: ReactNode;
  /**
   * Where the span opens things (its tools, the agents and workflows it delegated to, workspaces, Knowledge
   * pages): the host's callbacks; text without them. Defaults to the navigation of the root around it.
   */
  navigation?: TraceNavigation;
}

interface TabSlot {
  value: SpanTab;
  name: string;
  icon: ReactNode;
  content: ReactNode;
  attention?: boolean;
  count?: ReactNode;
}

/**
 * One span: its header, then one tab per tab slot the host filled, in the order Details, Input, Output,
 * Feedback. The body is flat: the tab says what it holds, so the payload isn't wrapped in a titled card
 * again. The open tab and the Preview/JSON choice are kept when another span is selected, so stepping
 * through spans compares like for like.
 */
export function SpanDataPanelRoot({
  traceId,
  spanId,
  span,
  isLoading,
  activeTab,
  onTabChange,
  className,
  header,
  details,
  input,
  output,
  feedback,
  feedbackCount,
  navigation,
}: SpanDataPanelProps) {
  const [ownTab, setOwnTab] = useState<SpanTab>('details');
  const [view, setView] = useState<PayloadView>('rich');

  const tabs: TabSlot[] = [];
  if (details) tabs.push({ value: 'details', name: 'Details', icon: <IconCircleInfo />, content: details });
  if (input) tabs.push({ value: 'input', name: 'Input', icon: <IconFileArrowRightIn />, content: input });
  if (output) {
    tabs.push({
      value: 'output',
      name: 'Output',
      icon: <IconFileArrowRightOut />,
      content: output,
      attention: span?.error != null,
    });
  }
  if (feedback) {
    tabs.push({
      value: 'feedback',
      name: 'Feedback',
      icon: <IconChatBubble7Plus />,
      content: feedback,
      count: feedbackCount,
    });
  }
  const requested = activeTab ?? ownTab;
  const tab = tabs.find(item => item.value === requested) ?? tabs[0];
  const changeTab = (next: SpanTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };

  return (
    <SpanDataPanelContext.Provider value={{ traceId, spanId, span, view, setView }}>
      <TraceNavigationScope navigation={navigation}>
        <section
          aria-label={span ? getSpanTitle(span) : 'Span'}
          data-slot="span-data-panel"
          className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
        >
          {header}
          {isLoading ? (
            <DataPanel.LoadingData>Loading span details...</DataPanel.LoadingData>
          ) : !span ? (
            <DataPanel.NoData>Span not found.</DataPanel.NoData>
          ) : (
            tab && (
              <>
                <Tabs<SpanTab> defaultTab={tab.value} value={tab.value} onValueChange={changeTab}>
                  <DataPanel.Header className="flex-nowrap border-b border-surface-rim">
                    <div className="min-w-0 flex-1">
                      <TabList variant="pill-ghost" size="sm">
                        {tabs.map(item => (
                          <Tab key={item.value} value={item.value} attention={item.attention}>
                            <Icon size="xs">{item.icon}</Icon>
                            <span>{item.name}</span>
                            {item.count != null && <> ({item.count})</>}
                          </Tab>
                        ))}
                      </TabList>
                    </div>
                  </DataPanel.Header>
                </Tabs>
                <div role="tabpanel" aria-label={tab.name} className={BODY_CLASS}>
                  {tab.content}
                </div>
              </>
            )
          )}
        </section>
      </TraceNavigationScope>
    </SpanDataPanelContext.Provider>
  );
}
