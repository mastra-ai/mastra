import type { SpanRecord, TraceSpanRecord } from '../types';
import { getSpanChanges } from './span-outcome.utils';
import {
  SpanErrorRenderer,
  SpanInputRenderer,
  getSpanOutputPayload,
  hasSpanInputPreview,
  hasSpanOutputPreview,
  SpanOutputRenderer,
  SpanPayloadJsonSection,
  SpanPayloadSection,
  SpanProcessorAttributes,
  SpanProcessorMutations,
} from './span-payload';
import { SpanToolsSection } from './span-payload/span-tools-section';
import type { RegisteredTools } from './span-payload/span-tools-section';
import { SpanRunId, SpanSummaryDescription } from './span-summary-description';
import { TraceIdButton } from './trace-id-button';
import type { TraceNavigation } from './trace-navigation';
import { TraceNavigationScope } from './trace-navigation-scope';
import type { TraceToolCallsProps } from './trace-tool-calls';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';
import { IconArrowLeftRight } from '@/ds/icons/central/IconArrowLeftRight';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { IconFileArrowRightIn } from '@/ds/icons/central/IconFileArrowRightIn';
import { IconFileArrowRightOut } from '@/ds/icons/central/IconFileArrowRightOut';

const KV = DataDetailsPanel.KeyValueList;

export interface SpanDetailsViewProps extends TraceToolCallsProps {
  spanId: string;
  /** Full span record. Caller fetches via useSpanDetail. */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  onClose: () => void;
  /** Every span of the trace (`getTrace`), so tool calls show the result their tool span recorded. */
  traceSpans?: TraceSpanRecord[];
  /** The tool registry (`listTools`), so offered tools link to their pages. */
  registeredTools?: RegisteredTools;
  /** Where the span opens its tools, delegated agents and workflows; text without it. */
  navigation?: TraceNavigation;
}

/**
 * Compact span panel using `DataDetailsPanel` (popover-style). Shows basic span metadata +
 * input/output/metadata/attributes code sections. Use this for inline span inspection; for the
 * full-width span view with scoring tab + prev/next nav, use `SpanDataPanelView`.
 */
export function SpanDetailsView({
  spanId,
  span,
  isLoading,
  onClose,
  traceSpans,
  registeredTools,
  mcpAppTools,
  renderToolCall,
  navigation,
}: SpanDetailsViewProps) {
  return (
    <TraceNavigationScope navigation={navigation}>
      <DataDetailsPanel>
        <DataDetailsPanel.Header>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DataDetailsPanel.Heading className="items-center">
              Span
              <TraceIdButton id={spanId} />
            </DataDetailsPanel.Heading>
            {span && (
              <div className="flex min-w-0 items-center gap-1">
                {span.runId && <SpanRunId runId={span.runId} />}
                <SpanSummaryDescription span={span} />
              </div>
            )}
          </div>
          <DataDetailsPanel.CloseButton onClick={onClose} />
        </DataDetailsPanel.Header>

        {isLoading ? (
          <DataDetailsPanel.LoadingData>Loading span...</DataDetailsPanel.LoadingData>
        ) : !span ? (
          <DataDetailsPanel.NoData>Span not found.</DataDetailsPanel.NoData>
        ) : (
          <DataDetailsPanel.Content>
            {span.spanType && (
              <>
                <KV>
                  <KV.Key>Type</KV.Key>
                  <KV.Value>{span.spanType}</KV.Value>
                </KV>
                <br />
              </>
            )}
            <SpanProcessorAttributes span={span} className="mb-4" />

            <SpanPayloadSection title="Error" raw={span.error} layout="details" framed={false}>
              <SpanErrorRenderer span={span} />
            </SpanPayloadSection>
            {getSpanChanges(span).length > 0 && (
              <SpanPayloadSection
                title="Changes"
                icon={<IconArrowLeftRight />}
                raw={getSpanChanges(span)}
                layout="details"
                emphasis
              >
                <SpanProcessorMutations span={span} />
              </SpanPayloadSection>
            )}
            <SpanPayloadSection
              title="Input"
              icon={<IconFileArrowRightIn />}
              raw={span.input}
              hasPreview={hasSpanInputPreview(span)}
              layout="details"
            >
              <SpanInputRenderer span={span} />
            </SpanPayloadSection>
            <SpanPayloadSection
              title="Output"
              icon={<IconFileArrowRightOut />}
              raw={getSpanOutputPayload(span)}
              hasPreview={hasSpanOutputPreview(span)}
              layout="details"
            >
              <SpanOutputRenderer span={span} />
            </SpanPayloadSection>
            <SpanToolsSection
              span={span}
              layout="details"
              traceSpans={traceSpans}
              registeredTools={registeredTools}
              mcpAppTools={mcpAppTools}
              renderToolCall={renderToolCall}
            />
            <SpanPayloadJsonSection title="Metadata" icon={<IconCodeBrackets />} raw={span.metadata} layout="details" />
            <SpanPayloadJsonSection
              title="Attributes"
              icon={<IconCodeBrackets />}
              raw={span.attributes}
              layout="details"
            />
          </DataDetailsPanel.Content>
        )}
      </DataDetailsPanel>
    </TraceNavigationScope>
  );
}
