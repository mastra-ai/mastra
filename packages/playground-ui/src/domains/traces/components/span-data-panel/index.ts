import {
  SpanDataPanelCloseButton,
  SpanDataPanelDetails,
  SpanDataPanelHeader,
  SpanDataPanelIdentity,
  SpanDataPanelInput,
  SpanDataPanelNavigation,
  SpanDataPanelOutput,
  SpanDataPanelShowTraceButton,
} from './span-data-panel-parts';
import { SpanDataPanelRoot } from './span-data-panel-root';

/**
 * One span, composed from parts: a header (identity and actions) and its tabs (Details, Input, Output,
 * Feedback). Each part draws the record the root was given; a tab slot left empty drops that tab.
 *
 * @example
 * <SpanDataPanel
 *   traceId={traceId}
 *   spanId={spanId}
 *   span={span}
 *   header={
 *     <SpanDataPanel.Header
 *       identity={<SpanDataPanel.Identity />}
 *       actions={<SpanDataPanel.CloseButton onClose={close} />}
 *     />
 *   }
 *   details={<SpanDataPanel.Details />}
 *   input={<SpanDataPanel.Input registeredTools={tools} />}
 *   output={<SpanDataPanel.Output traceSpans={trace.spans} />}
 *   feedback={<FeedbackThread feedbackData={feedback} onSubmit={submit} />}
 * />
 */
export const SpanDataPanel = Object.assign(SpanDataPanelRoot, {
  Header: SpanDataPanelHeader,
  Identity: SpanDataPanelIdentity,
  ShowTraceButton: SpanDataPanelShowTraceButton,
  Navigation: SpanDataPanelNavigation,
  CloseButton: SpanDataPanelCloseButton,
  Details: SpanDataPanelDetails,
  Input: SpanDataPanelInput,
  Output: SpanDataPanelOutput,
});

export { useSpanDataPanel } from './span-data-panel-context';
export type { PayloadView, SpanDataPanelContextValue } from './span-data-panel-context';
export type { SpanDataPanelProps } from './span-data-panel-root';
export type {
  SpanDataPanelHeaderProps,
  SpanDataPanelInputProps,
  SpanDataPanelNavigationProps,
  SpanDataPanelOutputProps,
  SpanDataPanelShowTraceButtonProps,
} from './span-data-panel-parts';
export { getSpanTitle } from './span-data-panel-title';
