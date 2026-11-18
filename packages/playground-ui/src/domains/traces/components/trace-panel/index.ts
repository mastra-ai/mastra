import { TracePanelBody } from './trace-panel-body';
import { TracePanelFrame } from './trace-panel-frame';
import {
  TracePanelActions,
  TracePanelCloseButton,
  TracePanelDatasetButton,
  TracePanelDownloadButton,
  TracePanelHeader,
  TracePanelNavigation,
  TracePanelOpenPageButton,
  TracePanelPageHeading,
  TracePanelScoreButton,
  TracePanelScoreDialog,
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
import {
  TracePanelFeedback,
  TracePanelFeedbackTab,
  TracePanelMessages,
  TracePanelMessagesTab,
  TracePanelOpenFullThreadButton,
  TracePanelScores,
  TracePanelScoresTab,
  TracePanelSide,
  TracePanelSideActions,
  TracePanelSideContent,
  TracePanelSideHeader,
  TracePanelSideTab,
  TracePanelSideTabs,
} from './trace-panel-side';
import { TracePanelSpanDetail, TracePanelSpanPanel } from './trace-panel-span';

/**
 * A trace composed from parts: a frame (drawer or inline card) holding a header (navigation, trace id,
 * actions), the summary, then the body's columns: the side views (messages, feedback, scores, or the
 * host's own), the spans, and the open span. Every part draws the data it is given and reports actions
 * through callbacks; it never fetches. Leave a part out to drop its feature, or put any element of your
 * own among them.
 *
 * @example
 * <TracePanel traceId={id} spans={lightSpans} selectedSpanId={spanId} onSpanSelect={setSpanId} onClose={close}>
 *   <TracePanel.Frame>
 *     <TracePanel.Header>
 *       <TracePanel.Navigation onPrevious={previous} onNext={next} />
 *       <TracePanel.TraceId />
 *       <TracePanel.Actions>
 *         <TracePanel.ScoreButton />
 *         <TracePanel.DownloadButton onDownload={download} />
 *         <TracePanel.CloseButton />
 *       </TracePanel.Actions>
 *     </TracePanel.Header>
 *     <TracePanel.Summary usage={usage} />
 *     <TracePanel.Body>
 *       <TracePanel.Side defaultView="messages">
 *         <TracePanel.SideHeader>
 *           <TracePanel.SideTabs>
 *             <TracePanel.MessagesTab />
 *             <TracePanel.FeedbackTab count={feedback.pagination.total} />
 *           </TracePanel.SideTabs>
 *         </TracePanel.SideHeader>
 *         <TracePanel.Messages spans={fullSpans} />
 *         <TracePanel.Feedback>
 *           <FeedbackThread feedbackData={feedback} onSubmit={submit} />
 *         </TracePanel.Feedback>
 *       </TracePanel.Side>
 *       <TracePanel.Main>
 *         <TracePanel.SpansToolbar>
 *           <TracePanel.Search />
 *           <TracePanel.SpanViewSwitch />
 *         </TracePanel.SpansToolbar>
 *         <TracePanel.Spans traceSpans={fullSpans}>
 *           <TracePanel.RootError />
 *         </TracePanel.Spans>
 *       </TracePanel.Main>
 *       <TracePanel.SpanPanel>
 *         <TracePanel.SpanDetail span={selectedSpan} traceSpans={fullSpans} />
 *       </TracePanel.SpanPanel>
 *     </TracePanel.Body>
 *   </TracePanel.Frame>
 *   <TracePanel.ScoreDialog scorers={scorers} onTriggerScorer={runScorer} />
 * </TracePanel>
 */
export const TracePanel = Object.assign(TracePanelRoot, {
  Frame: TracePanelFrame,
  Header: TracePanelHeader,
  Navigation: TracePanelNavigation,
  TraceId: TracePanelTraceId,
  PageHeading: TracePanelPageHeading,
  Actions: TracePanelActions,
  ScoreButton: TracePanelScoreButton,
  ScoreDialog: TracePanelScoreDialog,
  DatasetButton: TracePanelDatasetButton,
  OpenPageButton: TracePanelOpenPageButton,
  DownloadButton: TracePanelDownloadButton,
  CloseButton: TracePanelCloseButton,
  Summary: TracePanelSummary,
  Body: TracePanelBody,
  Side: TracePanelSide,
  SideHeader: TracePanelSideHeader,
  SideTabs: TracePanelSideTabs,
  SideTab: TracePanelSideTab,
  MessagesTab: TracePanelMessagesTab,
  FeedbackTab: TracePanelFeedbackTab,
  ScoresTab: TracePanelScoresTab,
  SideActions: TracePanelSideActions,
  SideContent: TracePanelSideContent,
  Messages: TracePanelMessages,
  Feedback: TracePanelFeedback,
  Scores: TracePanelScores,
  OpenFullThreadButton: TracePanelOpenFullThreadButton,
  Main: TracePanelMain,
  SpansToolbar: TracePanelSpansToolbar,
  Search: TracePanelSearch,
  SpanViewSwitch: TracePanelSpanViewSwitch,
  Spans: TracePanelSpans,
  RootError: TracePanelRootError,
  UnavailableFeaturesNotice: TracePanelUnavailableFeaturesNotice,
  SpanPanel: TracePanelSpanPanel,
  SpanDetail: TracePanelSpanDetail,
});

export { pickSideView, useTracePanel } from './trace-panel-context';
export type { TracePanelContextValue, TracePanelSpan, TraceSideView, TraceSpanView } from './trace-panel-context';
export { useTracePanelSide } from './trace-panel-side-context';
export type { TracePanelRootProps } from './trace-panel-root';
export type { TracePanelBodyProps } from './trace-panel-body';
export type { TracePanelFrameProps } from './trace-panel-frame';
export type {
  TracePanelActionsProps,
  TracePanelDatasetButtonProps,
  TracePanelDownloadButtonProps,
  TracePanelHeaderProps,
  TracePanelNavigationProps,
  TracePanelOpenPageButtonProps,
  TracePanelPageHeadingProps,
  TracePanelScoreButtonProps,
  TracePanelScoreDialogProps,
  TracePanelSummaryProps,
} from './trace-panel-header';
export type { TracePanelSpansProps } from './trace-panel-main';
export type {
  TracePanelMessagesProps,
  TracePanelOpenFullThreadButtonProps,
  TracePanelSideContentProps,
  TracePanelSideProps,
  TracePanelSideTabProps,
} from './trace-panel-side';
export type { TracePanelSpanDetailProps, TracePanelSpanPanelProps } from './trace-panel-span';
export type { TracePanelSideContextValue } from './trace-panel-side-context';
