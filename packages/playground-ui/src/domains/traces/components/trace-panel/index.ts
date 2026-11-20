import { TracePanelBody } from './trace-panel-body';
import { TracePanelFrame } from './trace-panel-frame';
import {
  TracePanelCloseButton,
  TracePanelDatasetButton,
  TracePanelDownloadButton,
  TracePanelEntity,
  TracePanelHeader,
  TracePanelNavigation,
  TracePanelOpenPageButton,
  TracePanelPageHeading,
  TracePanelScoreButton,
  TracePanelScoreDialog,
  TracePanelStats,
  TracePanelStatus,
  TracePanelSummary,
  TracePanelTraceId,
} from './trace-panel-header';
import {
  TracePanelMain,
  TracePanelRootError,
  TracePanelSearch,
  TracePanelSpans,
  TracePanelSpansToolbar,
  TracePanelSpanViewSwitch,
  TracePanelUnavailableFeaturesNotice,
} from './trace-panel-main';
import { TracePanelRoot } from './trace-panel-root';
import { TracePanelMessages, TracePanelOpenFullThreadButton, TracePanelSide } from './trace-panel-side';
import { TracePanelSpanDetail } from './trace-panel-span-detail';

/**
 * A trace composed from parts. Layout parts place named slots (`Frame`, `Header`, `Summary`, `Body`,
 * `Side`, `Main`, `SpansToolbar`); leaf parts draw the data they are given and report actions through
 * callbacks. Nothing fetches. Leave a slot empty to drop its feature, or put any element of your own in it.
 *
 * @example
 * <TracePanel traceId={id} spans={lightSpans} selectedSpanId={spanId} onSpanSelect={setSpanId} onClose={close}>
 *   <TracePanel.Frame
 *     header={
 *       <TracePanel.Header
 *         navigation={<TracePanel.Navigation onPrevious={previous} onNext={next} />}
 *         title={<TracePanel.TraceId />}
 *         actions={
 *           <>
 *             <TracePanel.ScoreButton />
 *             <TracePanel.DownloadButton onDownload={download} />
 *             <TracePanel.CloseButton />
 *           </>
 *         }
 *       />
 *     }
 *     summary={<TracePanel.Summary entity={<TracePanel.Entity />} status={<TracePanel.Status />} stats={<TracePanel.Stats usage={usage} />} />}
 *     body={
 *       <TracePanel.Body
 *         side={
 *           <TracePanel.Side
 *             messages={<TracePanel.Messages spans={fullSpans} />}
 *             feedback={<FeedbackThread feedbackData={feedback} onSubmit={submit} />}
 *             feedbackCount={feedback.pagination.total}
 *           />
 *         }
 *         main={
 *           <TracePanel.Main
 *             toolbar={<TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />}
 *             notices={<TracePanel.RootError />}
 *             spans={<TracePanel.Spans traceSpans={fullSpans} />}
 *           />
 *         }
 *         span={<TracePanel.SpanDetail span={selectedSpan} traceSpans={fullSpans} />}
 *       />
 *     }
 *     dialogs={<TracePanel.ScoreDialog scorers={scorers} onTriggerScorer={runScorer} />}
 *   />
 * </TracePanel>
 */
export const TracePanel = Object.assign(TracePanelRoot, {
  Frame: TracePanelFrame,
  Header: TracePanelHeader,
  Navigation: TracePanelNavigation,
  TraceId: TracePanelTraceId,
  PageHeading: TracePanelPageHeading,
  ScoreButton: TracePanelScoreButton,
  ScoreDialog: TracePanelScoreDialog,
  DatasetButton: TracePanelDatasetButton,
  OpenPageButton: TracePanelOpenPageButton,
  DownloadButton: TracePanelDownloadButton,
  CloseButton: TracePanelCloseButton,
  Summary: TracePanelSummary,
  Entity: TracePanelEntity,
  Status: TracePanelStatus,
  Stats: TracePanelStats,
  Body: TracePanelBody,
  Side: TracePanelSide,
  Messages: TracePanelMessages,
  OpenFullThreadButton: TracePanelOpenFullThreadButton,
  Main: TracePanelMain,
  SpansToolbar: TracePanelSpansToolbar,
  Search: TracePanelSearch,
  SpanViewSwitch: TracePanelSpanViewSwitch,
  Spans: TracePanelSpans,
  RootError: TracePanelRootError,
  UnavailableFeaturesNotice: TracePanelUnavailableFeaturesNotice,
  SpanDetail: TracePanelSpanDetail,
});

export { useTracePanel } from './trace-panel-context';
export type { TracePanelContextValue, TracePanelSpan, TraceSideView, TraceSpanView } from './trace-panel-context';
export { useTracePanelSide } from './trace-panel-side-context';
export type { TracePanelSideContextValue } from './trace-panel-side-context';
export type { TracePanelRootProps } from './trace-panel-root';
export type { TracePanelFrameProps } from './trace-panel-frame';
export type { TracePanelBodyProps } from './trace-panel-body';
export type {
  TracePanelDatasetButtonProps,
  TracePanelDownloadButtonProps,
  TracePanelHeaderProps,
  TracePanelNavigationProps,
  TracePanelPageHeadingProps,
  TracePanelScoreButtonProps,
  TracePanelScoreDialogProps,
  TracePanelStatsProps,
  TracePanelSummaryProps,
} from './trace-panel-header';
export type { TracePanelMainProps, TracePanelSpansProps, TracePanelSpansToolbarProps } from './trace-panel-main';
export type {
  TracePanelMessagesProps,
  TracePanelOpenFullThreadButtonProps,
  TracePanelSideProps,
} from './trace-panel-side';
export type { TracePanelSpanDetailProps } from './trace-panel-span-detail';
