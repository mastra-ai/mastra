import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { SpanDataPanelView } from '@mastra/playground-ui/domains/traces/components/span-data-panel-view';
import { TraceDataPanelView } from '@mastra/playground-ui/domains/traces/components/trace-data-panel-view';
import { useSpanDetail } from '@mastra/playground-ui/domains/traces/hooks/use-span-detail';
import { useTraceSpanNavigation } from '@mastra/playground-ui/domains/traces/hooks/use-trace-span-navigation';
import { PlayCircle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { RouteItemOverlay } from '@/components/route-item-overlay';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';
import { ExperimentResultPanel } from '@/domains/experiments/components/experiment-result-panel';
import { ExperimentScorePanel } from '@/domains/experiments/components/experiment-score-panel';
import { useExperimentItemPanel } from '@/domains/experiments/context/experiment-item-panel-context';
import { useExperimentTrace } from '@/domains/experiments/hooks/use-experiment-trace';
import { Link } from '@/lib/link';

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
  const resultScores = result ? scoresByItemId?.[result.itemId] : undefined;

  const [featuredTraceId, setFeaturedTraceId] = useState<string | null>(null);
  const [featuredSpanId, setFeaturedSpanId] = useState<string | undefined>(undefined);
  const [featuredScoreId, setFeaturedScoreId] = useState<string | null>(null);
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [traceCollapsed, setTraceCollapsed] = useState(false);
  const [scoreCollapsed, setScoreCollapsed] = useState(false);

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

  const { data: spanDetailData, isLoading: isSpanLoading } = useSpanDetail(featuredTraceId, featuredSpanId);
  const featuredSpan = spanDetailData?.span;

  const { handlePreviousSpan: toPreviousSpan, handleNextSpan: toNextSpan } = useTraceSpanNavigation(
    traceSpans,
    featuredSpanId ?? null,
    setFeaturedSpanId,
  );

  // Stack order mirrors the previous inline column: Result → Score → Trace → Span.
  const gridRows = (() => {
    const rows: string[] = [];
    const showScore = !!featuredScore;
    const showTrace = !!featuredTraceId;
    rows.push(resultCollapsed ? 'auto' : showScore || showTrace ? '2fr' : '1fr');
    if (showScore) rows.push(scoreCollapsed ? 'auto' : '3fr');
    if (showTrace) rows.push(traceCollapsed ? 'auto' : '3fr');
    if (showTrace && featuredSpanId) rows.push('3fr');
    return rows.join(' ');
  })();

  return (
    <RouteItemOverlay label={`Experiment item ${itemId}`}>
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
            collapsed={resultCollapsed}
            onCollapsedChange={setResultCollapsed}
          />

          {featuredScore && (
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
                setScoreCollapsed(true);
                setTraceCollapsed(false);
              }}
              collapsed={scoreCollapsed}
              onCollapsedChange={setScoreCollapsed}
            />
          )}

          {featuredTraceId && (
            <>
              <TraceDataPanelView
                traceId={featuredTraceId}
                spans={traceSpans}
                isLoading={isTraceLoading}
                onClose={() => {
                  setFeaturedTraceId(null);
                  setFeaturedSpanId(undefined);
                  setResultCollapsed(false);
                  setScoreCollapsed(false);
                }}
                onSpanSelect={setFeaturedSpanId}
                initialSpanId={featuredSpanId ?? null}
                placement="traces-list"
                showUnavailableFeaturesMsg={false}
                collapsed={traceCollapsed}
                onCollapsedChange={setTraceCollapsed}
                LinkComponent={Link}
                traceHref={`/traces?traceId=${encodeURIComponent(featuredTraceId)}`}
              />

              {featuredSpanId && (
                <SpanDataPanelView
                  traceId={featuredTraceId}
                  spanId={featuredSpanId}
                  span={featuredSpan}
                  isLoading={isSpanLoading}
                  onPrevious={toPreviousSpan}
                  onNext={toNextSpan}
                  onClose={() => setFeaturedSpanId(undefined)}
                />
              )}
            </>
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
