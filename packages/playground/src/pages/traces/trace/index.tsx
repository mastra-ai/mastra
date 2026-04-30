import type { ScoreRowData } from '@mastra/core/evals';
import { EntityType } from '@mastra/core/observability';
import {
  Button,
  ButtonWithTooltip,
  ButtonsGroup,
  PageHeader,
  PageLayout,
  SpanDataPanelView,
  TraceDataPanelView,
  TraceKeysAndValues,
  TracesErrorContent,
  cn,
  useSpanDetail,
  useTraceLightSpans,
  useTraceSpanNavigation,
} from '@mastra/playground-ui';
import type { SpanTab } from '@mastra/playground-ui';
import { ArrowLeftIcon, BookIcon, CircleGaugeIcon, EyeIcon, SaveIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanFeedbackList } from '@/domains/traces/components/span-feedback-list';
import { SpanScoresList } from '@/domains/traces/components/span-scores-list';
import { SpanScoring } from '@/domains/traces/components/span-scoring';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { Link } from '@/lib/link';

export default function TracePage() {
  const { traceId } = useParams()! as { traceId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const spanIdParam = searchParams.get('spanId') || undefined;
  const tabParam = searchParams.get('tab');
  const initialSpanTab: SpanTab = tabParam === 'scoring' ? 'scoring' : tabParam === 'feedback' ? 'feedback' : 'details';
  const scoreIdParam = searchParams.get('scoreId') || undefined;

  const [featuredSpanId, setFeaturedSpanId] = useState<string | null>(spanIdParam ?? null);
  const [featuredScore, setFeaturedScore] = useState<ScoreRowData | undefined>();
  const [spanTab, setSpanTab] = useState<SpanTab>(initialSpanTab);
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);

  const { data: traceLight, isLoading: isTraceLoading, error: traceError } = useTraceLightSpans(traceId);
  const lightSpans = useMemo(() => traceLight?.spans ?? [], [traceLight?.spans]);
  const rootSpan = useMemo(() => lightSpans.find(s => s.parentSpanId == null), [lightSpans]);

  const { data: spanDetailData, isLoading: isLoadingSpanDetail } = useSpanDetail(traceId, featuredSpanId ?? '');

  // Reset pagination whenever the active span changes — otherwise a page index from a previous
  // span could be reused against a span that has fewer (or no) scores.
  useEffect(() => setSpanScoresPage(0), [traceId, featuredSpanId]);

  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId,
    spanId: featuredSpanId ?? undefined,
    page: spanScoresPage,
  });

  const [feedbackPage, setFeedbackPage] = useState(0);
  useEffect(() => setFeedbackPage(0), [traceId, featuredSpanId]);
  const { data: feedbackData, isLoading: isLoadingFeedback } = useTraceFeedback({
    traceId,
    page: feedbackPage,
  });

  useEffect(() => {
    if (scoreIdParam && spanScoresData?.scores && !featuredScore) {
      const match = spanScoresData.scores.find(s => s.id === scoreIdParam);
      if (match) setFeaturedScore(match);
    }
  }, [scoreIdParam, spanScoresData?.scores, featuredScore]);

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSpanSelect = useCallback(
    (spanId: string | undefined) => {
      const id = spanId ?? null;
      const isSameSpan = id === featuredSpanId;
      setFeaturedSpanId(id);
      if (!isSameSpan) {
        setFeaturedScore(undefined);
        setSpanTab('details');
        updateSearchParams({ spanId: id, tab: null, scoreId: null });
      }
    },
    [featuredSpanId, updateSearchParams],
  );

  const handleSpanClose = useCallback(() => {
    setFeaturedSpanId(null);
    setFeaturedScore(undefined);
    setSpanTab('details');
    updateSearchParams({ spanId: null, tab: null, scoreId: null });
  }, [updateSearchParams]);

  const goToSpan = useCallback(
    (id: string) => {
      setFeaturedSpanId(id);
      setFeaturedScore(undefined);
      setSpanTab('details');
      updateSearchParams({ spanId: id, tab: null, scoreId: null });
    },
    [updateSearchParams],
  );

  const { handlePreviousSpan, handleNextSpan } = useTraceSpanNavigation(lightSpans, featuredSpanId, goToSpan);

  const handleSpanTabChange = useCallback(
    (tab: string) => {
      const next = tab as SpanTab;
      setSpanTab(next);
      setFeaturedScore(undefined);
      updateSearchParams({ tab: next === 'details' ? null : next, scoreId: null });
    },
    [updateSearchParams],
  );

  const handleScoreSelect = useCallback(
    (score: ScoreRowData) => {
      setFeaturedScore(score);
      updateSearchParams({ scoreId: score.id });
    },
    [updateSearchParams],
  );

  const handleScoreClose = useCallback(() => {
    setFeaturedScore(undefined);
    updateSearchParams({ scoreId: null });
  }, [updateSearchParams]);

  const handleTraceClose = useCallback(() => {
    void navigate('/observability');
  }, [navigate]);

  const handleEvaluateTrace = useCallback(() => {
    setSpanTab('scoring');
    if (rootSpan && featuredSpanId !== rootSpan.spanId) {
      setFeaturedSpanId(rootSpan.spanId);
      setFeaturedScore(undefined);
      updateSearchParams({ spanId: rootSpan.spanId, tab: 'scoring', scoreId: null });
    } else {
      updateSearchParams({ tab: 'scoring' });
    }
  }, [rootSpan, featuredSpanId, updateSearchParams]);

  const traceTopAreaSharedContent = (
    <>
      <Button as={Link} href="/observability" variant="link" size="md" className="text-neutral2">
        <ArrowLeftIcon />
        Back to Traces
      </Button>
      <PageLayout.Row>
        <PageLayout.Column>
          <PageHeader>
            <PageHeader.Title isLoading={isTraceLoading}>
              <EyeIcon /> Trace <span className="text-neutral3">{traceId}</span>
            </PageHeader.Title>
          </PageHeader>
        </PageLayout.Column>
        <PageLayout.Column>
          <ButtonsGroup>
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Traces documentation"
              tooltipContent="Go to Traces documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
            {rootSpan && (
              <>
                <ButtonWithTooltip
                  tooltipContent="Evaluate Trace"
                  aria-label="Evaluate Trace"
                  onClick={handleEvaluateTrace}
                >
                  <CircleGaugeIcon />
                  Evaluate
                </ButtonWithTooltip>
                <ButtonWithTooltip
                  tooltipContent="Save as Dataset Item"
                  aria-label="Save as Dataset Item"
                  onClick={() => setDatasetDialogOpen(true)}
                >
                  <SaveIcon />
                  Save
                </ButtonWithTooltip>
              </>
            )}
          </ButtonsGroup>
        </PageLayout.Column>
      </PageLayout.Row>

      {rootSpan && (
        <PageLayout.Row>
          <PageLayout.Column>
            <TraceKeysAndValues rootSpan={rootSpan} numOfCol={3} />
          </PageLayout.Column>
        </PageLayout.Row>
      )}
    </>
  );

  if (traceError) {
    return (
      <PageLayout height="full">
        <PageLayout.TopArea>{traceTopAreaSharedContent}</PageLayout.TopArea>
        <PageLayout.MainArea isCentered>
          <TracesErrorContent error={traceError} resource="traces" errorTitle="Failed to load trace" />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>{traceTopAreaSharedContent}</PageLayout.TopArea>

      <TraceAsItemDialog
        rootSpanId={rootSpan?.spanId}
        traceId={traceId}
        isOpen={datasetDialogOpen}
        onClose={() => setDatasetDialogOpen(false)}
      />

      <div
        className={cn(
          'grid h-full min-h-0 gap-4 overflow-hidden items-start mt-4',
          featuredSpanId ? 'grid-cols-[2fr_3fr]' : 'grid-cols-[1fr]',
        )}
      >
        <TraceDataPanelView
          traceId={traceId}
          spans={lightSpans}
          isLoading={isTraceLoading}
          onClose={handleTraceClose}
          onSpanSelect={handleSpanSelect}
          onEvaluateTrace={handleEvaluateTrace}
          initialSpanId={featuredSpanId}
          placement="trace-page"
          timelineChartWidth={featuredSpanId ? 'default' : 'wide'}
        />
        {featuredSpanId && !isTraceLoading && (
          <div
            className={cn(
              'grid gap-4 max-h-full min-h-0 overflow-auto',
              featuredScore ? 'grid-rows-[1fr_1fr]' : 'grid-rows-[1fr]',
            )}
          >
            <SpanDataPanelView
              traceId={traceId}
              spanId={featuredSpanId}
              span={spanDetailData?.span}
              isLoading={isLoadingSpanDetail}
              onClose={handleSpanClose}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
              activeTab={spanTab}
              onTabChange={handleSpanTabChange}
              feedbackTabBadge={feedbackData?.pagination?.total ?? undefined}
              feedbackTabSlot={() => (
                <SpanFeedbackList
                  feedbackData={feedbackData}
                  onPageChange={setFeedbackPage}
                  isLoadingFeedbackData={isLoadingFeedback}
                />
              )}
              scoringTabBadge={spanScoresData?.pagination?.total ?? undefined}
              scoringTabSlot={({ span, traceId: tid, spanId: sid }) => (
                <div className="grid gap-6">
                  <SpanScoring
                    traceId={tid}
                    isTopLevelSpan={!Boolean(span.parentSpanId)}
                    spanId={sid}
                    entityType={
                      span.attributes?.agentId || span.entityType === EntityType.AGENT
                        ? 'Agent'
                        : span.attributes?.workflowId || span.entityType === EntityType.WORKFLOW_RUN
                          ? 'Workflow'
                          : undefined
                    }
                    scorers={scorers}
                    isLoadingScorers={isLoadingScorers}
                  />
                  <SpanScoresList
                    scoresData={spanScoresData}
                    onPageChange={setSpanScoresPage}
                    isLoadingScoresData={isLoadingSpanScoresData}
                    onScoreSelect={handleScoreSelect}
                  />
                </div>
              )}
            />
            {featuredScore && <ScoreDataPanel score={featuredScore} onClose={handleScoreClose} />}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
