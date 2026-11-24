import type { ReactNode } from 'react';
import type { SpanRecord, SpanTab, TraceSpanRecord } from '../types';
import { SpanDataPanel } from './span-data-panel';
import type { RegisteredTools } from './span-payload/span-tools-section';
import type { TraceNavigation } from './trace-navigation';
import type { TraceToolCallsProps } from './trace-tool-calls';

export interface SpanDataPanelViewProps extends TraceToolCallsProps {
  traceId: string;
  spanId: string;
  /** Full span record (`getSpan`). The panel never fetches: the host hands it down (Studio: `useSpanDetail`). */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  /**
   * Every span of the trace with its payload (`getTrace`). The Output tab pairs each tool call the span
   * requested with the result its tool span recorded; without it, the calls show no result.
   */
  traceSpans?: TraceSpanRecord[];
  /** The tool registry (`listTools`), so the tools a span offered link to their pages. */
  registeredTools?: RegisteredTools;
  /** Previous/next buttons show only when one is provided; omit both where a span tree already navigates. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** When provided, an × button in the header closes the span column. */
  onClose?: () => void;
  /**
   * When provided, a "Go to trace" button in the header calls it with the span's ids.
   * The caller decides where the trace opens (e.g. its own traces route).
   */
  onShowTrace?: (span: { traceId: string; spanId: string }) => void;
  /** Controls the open tab; the panel keeps its own when omitted. Defaults to Details. */
  activeTab?: SpanTab;
  onTabChange?: (tab: SpanTab) => void;
  /**
   * When provided, a "Feedback" tab appears; the slot receives the loaded span and renders
   * whatever feedback UI the consumer wants.
   */
  feedbackTabSlot?: (args: { span: SpanRecord; traceId: string; spanId: string }) => ReactNode;
  /** Optional indicator rendered after the "Feedback" tab label (e.g. a needs-review dot). */
  feedbackTabBadge?: ReactNode;
  /** Where the span opens its tools, delegated agents and workflows; defaults to the navigation of the root around it. */
  navigation?: TraceNavigation;
  /**
   * Replaces the Input tab, e.g. with a part that loads the tool registry when the tab opens (Studio:
   * `LiveSpanInput`). `registeredTools` is then unused.
   */
  input?: ReactNode;
  /**
   * Replaces the Output tab, e.g. with a part that loads the trace's spans when the tab opens (Studio:
   * `LiveSpanOutput`). `traceSpans`, `mcpAppTools` and `renderToolCall` are then unused.
   */
  output?: ReactNode;
  /** Extra classes for the panel root (e.g. flattening the card when nested in the trace panel). */
  className?: string;
}

/**
 * The standard span detail: a ready-made composition of `SpanDataPanel` parts with every tab. Compose
 * `SpanDataPanel` directly to drop, reorder or replace parts.
 */
export function SpanDataPanelView({
  traceId,
  spanId,
  span,
  isLoading,
  traceSpans,
  registeredTools,
  onPrevious,
  onNext,
  onClose,
  onShowTrace,
  activeTab,
  onTabChange,
  feedbackTabSlot,
  feedbackTabBadge,
  mcpAppTools,
  renderToolCall,
  navigation,
  input,
  output,
  className,
}: SpanDataPanelViewProps) {
  return (
    <SpanDataPanel
      traceId={traceId}
      spanId={spanId}
      span={span}
      isLoading={isLoading}
      activeTab={activeTab}
      onTabChange={onTabChange}
      className={className}
      navigation={navigation}
      header={
        <SpanDataPanel.Header
          identity={<SpanDataPanel.Identity />}
          actions={
            <>
              {onShowTrace && <SpanDataPanel.ShowTraceButton onShowTrace={onShowTrace} />}
              <SpanDataPanel.Navigation onPrevious={onPrevious} onNext={onNext} />
              {onClose && <SpanDataPanel.CloseButton onClose={onClose} />}
            </>
          }
        />
      }
      details={<SpanDataPanel.Details />}
      input={input ?? <SpanDataPanel.Input registeredTools={registeredTools} />}
      output={
        output ?? (
          <SpanDataPanel.Output traceSpans={traceSpans} mcpAppTools={mcpAppTools} renderToolCall={renderToolCall} />
        )
      }
      feedback={span && feedbackTabSlot?.({ span, traceId, spanId })}
      feedbackCount={feedbackTabBadge}
    />
  );
}
