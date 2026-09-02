import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlayCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { RouteItemOverlay } from '@/components/route-item-overlay';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { ExperimentResultPanel } from '@/domains/experiments/components/experiment-result-panel';
import { ExperimentScorePanel } from '@/domains/experiments/components/experiment-score-panel';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { useExperimentTrace } from '@/domains/experiments/hooks/use-experiment-trace';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { SpanFeedbackTab } from '@/domains/traces/components/span-feedback-tab';
import { TraceFeedbackTab } from '@/domains/traces/components/trace-feedback-tab';
import { TraceScoresTab } from '@/domains/traces/components/trace-scores-tab';
import { TraceSpanPanel } from '@/domains/traces/components/trace-span-panel';
import { useSpanFeedback } from '@/domains/traces/hooks/use-span-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';

function ExperimentItemPage() {
  const { itemId } = useParams<{ itemId: string }>();

  if (!itemId) return null;

  // The route element stays mounted across `:itemId` changes; keying the
  // content remounts it so panel state never leaks between items.
  return <ExperimentItemPageContent key={itemId} itemId={itemId} />;
}

function ExperimentItemPageContent({ itemId }: { itemId: string }) {
  const {
    experimentId,
    datasetId,
    experimentStatus,
    results,
    isLoadingResults,
    hasNextPage,
    close,
    openInReview,
    goToPreviousItem,
    goToNextItem,
  } = useExperimentItemPanel();

  const result = useMemo(() => results.find(r => r.itemId === itemId) ?? null, [results, itemId]);

  const { data: scoresByItemId } = useScoresByExperimentId(experimentId, experimentStatus);
  const { updateExperimentResult } = useDatasetMutations();

  const flagForReview = useCallback(
    async (resultId: string) => {
      try {
        await updateExperimentResult.mutateAsync({ datasetId, experimentId, resultId, status: 'needs-review' });
        toast('Result flagged for review');
      } catch {
        toast.error('Failed to flag result for review');
      }
    },
    [datasetId, experimentId, updateExperimentResult],
  );
  const resultScores = result ? scoresByItemId?.[result.itemId] : undefined;

  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);
  const [featuredScoreId, setFeaturedScoreId] = useState<string | null>(null);
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [traceCollapsed, setTraceCollapsed] = useState(false);

  const featuredScore = resultScores?.find(s => s.id === featuredScoreId) ?? null;

  const handleScoreClick = useCallback((scoreId: string) => {
    setFeaturedScoreId(prev => (scoreId === prev ? null : scoreId));
    setFeaturedTraceId(null);
    setFeaturedSpanId(undefined);
  }, []);

  const toNextScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !resultScores) return undefined;
    const currentIndex = resultScores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex >= 0 && currentIndex < resultScores.length - 1) {
      return () => setFeaturedScoreId(resultScores[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousScore = (): (() => void) | undefined => {
    if (!featuredScoreId || !resultScores) return undefined;
    const currentIndex = resultScores.findIndex(s => s.id === featuredScoreId);
    if (currentIndex > 0) {
      return () => setFeaturedScoreId(resultScores[currentIndex - 1].id);
    }
    return undefined;
  };

  const { data: traceData, isLoading: isTraceLoading } = useExperimentTrace(featuredTraceId);
  const traceSpans = traceData?.spans;
  const anchorSpan = traceSpans?.find(span => !span.parentSpanId);
  const anchorSpanEntityType =
    anchorSpan?.entityType === 'agent' ? 'Agent' : anchorSpan?.entityType === 'workflow_run' ? 'Workflow' : undefined;
  const { data: traceFeedback } = useTraceFeedback({ traceId: featuredTraceId ?? undefined });
  const { data: spanFeedback } = useSpanFeedback({
    traceId: featuredTraceId ?? undefined,
    spanId: featuredSpanId,
  });
  const { data: anchorSpanScores } = useTraceSpanScores({
    traceId: featuredTraceId ?? undefined,
    spanId: anchorSpan?.spanId,
    page: 0,
  });

  // Row stack: Result (with score split inside) → shared Trace/Span panel.
  const gridRows = (() => {
    const rows: string[] = [];
    const showTrace = !!featuredTraceId;
    rows.push(resultCollapsed ? 'auto' : showTrace ? '2fr' : '1fr');
    if (showTrace) rows.push(traceCollapsed ? 'auto' : '3fr');
    return rows.join(' ');
  })();

  return (
    <RouteItemOverlay
      label={`Experiment item ${itemId}`}
      wide={!!featuredSpanId || (!!featuredScore && !resultCollapsed)}
    >
      {result ? (
        <div
          className="[&>section]:bg-surface3 grid h-full min-h-0 content-start gap-4 p-3 [&>section]:rounded-lg [&>section]:shadow-lg"
          style={{ gridTemplateRows: gridRows }}
        >
          <ExperimentResultPanel
            result={result}
            scores={resultScores}
            onPrevious={goToPreviousItem}
            onNext={goToNextItem}
            onClose={close}
            onScoreClick={handleScoreClick}
            featuredScoreId={featuredScoreId}
            onShowTrace={() => {
              if (!result.traceId) return;
              setFeaturedTraceId(result.traceId);
              setFeaturedSpanId(undefined);
              setFeaturedScoreId(null);
              // One-shot: collapse Result so the freshly opened trace has room.
              setResultCollapsed(true);
              setTraceCollapsed(false);
            }}
            onOpenInReview={() => openInReview(result.id)}
            onFlagForReview={() => void flagForReview(result.id)}
            collapsed={resultCollapsed}
            scorePanelSlot={
              featuredScore ? (
                <ExperimentScorePanel
                  score={featuredScore}
                  onNext={toNextScore()}
                  onPrevious={toPreviousScore()}
                  onClose={() => setFeaturedScoreId(null)}
                  onShowTrace={() => {
                    if (!featuredScore.traceId) return;
                    setFeaturedTraceId(featuredScore.traceId);
                    setFeaturedSpanId(undefined);
                    setResultCollapsed(true);
                    setTraceCollapsed(false);
                  }}
                  className="rounded-none border-0 bg-transparent"
                />
              ) : null
            }
          />

          {featuredTraceId && (
            <TraceSpanPanel
              traceId={featuredTraceId}
              spans={traceSpans}
              isLoadingSpans={isTraceLoading}
              selectedSpanId={featuredSpanId ?? null}
              onClose={() => {
                setFeaturedTraceId(null);
                setFeaturedSpanId(undefined);
                setResultCollapsed(false);
              }}
              onSpanSelect={setFeaturedSpanId}
              showUnavailableFeaturesMsg={false}
              collapsed={traceCollapsed}
              onCollapsedChange={setTraceCollapsed}
              traceHref={`/traces?traceId=${encodeURIComponent(featuredTraceId)}`}
              anchorSpanId={anchorSpan?.spanId}
              feedbackTabBadge={traceFeedback?.pagination?.total ?? undefined}
              feedbackTabSlot={({ traceId }) => <TraceFeedbackTab traceId={traceId} />}
              scoresTabBadge={anchorSpanScores?.pagination?.total ?? undefined}
              scoresTabSlot={({ traceId, rootSpanId }) =>
                rootSpanId ? (
                  <TraceScoresTab
                    traceId={traceId}
                    spanId={rootSpanId}
                    isTopLevelSpan={!anchorSpan?.parentSpanId}
                    entityType={anchorSpanEntityType}
                    onScoreSelect={scoreId => {
                      if (resultScores?.some(score => score.id === scoreId)) {
                        setFeaturedScoreId(scoreId);
                        setResultCollapsed(false);
                      }
                    }}
                  />
                ) : null
              }
              spanFeedbackTabBadge={spanFeedback?.pagination?.total ?? undefined}
              spanFeedbackTabSlot={({ traceId, spanId }) =>
                traceId && spanId ? (
                  <SpanFeedbackTab key={`${traceId}:${spanId}`} traceId={traceId} spanId={spanId} />
                ) : null
              }
              spanPanelClassName="rounded-none border-0 bg-transparent"
            />
          )}
        </div>
      ) : isLoadingResults || hasNextPage ? (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <Spinner />
          </div>
        </div>
      ) : (
        <div className="h-full p-3">
          <div className="border-border1 bg-surface3 flex h-full items-center justify-center rounded-lg border shadow-lg">
            <EmptyState
              iconSlot={<PlayCircle />}
              titleSlot="Item not found"
              descriptionSlot={`No loaded result for item "${itemId}".`}
              actionSlot={<Button onClick={close}>Close</Button>}
            />
          </div>
        </div>
      )}
    </RouteItemOverlay>
  );
}

export { ExperimentItemPage };
export default ExperimentItemPage;
