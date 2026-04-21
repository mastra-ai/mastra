import type { ScoreRowData } from '@mastra/core/evals';
import {
  Button,
  ButtonWithTooltip,
  ButtonsGroup,
  ErrorState,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  cn,
  is401UnauthorizedError,
  is403ForbiddenError,
  parseError,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, BookIcon, CircleGaugeIcon, EyeIcon, SaveIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { TraceAsItemDialog } from '@/domains/observability/components/trace-as-item-dialog';
import { useScorers } from '@/domains/scores';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { formatHierarchicalSpans } from '@/domains/traces/components/format-hierarchical-spans';
import type { SpanTab } from '@/domains/traces/components/observability-traces-list';
import { ScoreDataPanel } from '@/domains/traces/components/score-data-panel';
import { SpanDataPanel } from '@/domains/traces/components/span-data-panel';
import { TraceDataPanel } from '@/domains/traces/components/trace-data-panel';
import { TraceKeysAndValues } from '@/domains/traces/components/trace-keys-and-values';
import { getAllSpanIds } from '@/domains/traces/hooks/get-all-span-ids';
import { useTraceLightSpans } from '@/domains/traces/hooks/use-trace-light-spans';
import { Link } from '@/lib/link';

export default function TraceDetailsPage() {
  const { traceId } = useParams()! as { traceId: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const spanIdParam = searchParams.get('spanId') || undefined;
  const tabParam = searchParams.get('tab');
  const initialSpanTab: SpanTab = tabParam === 'scoring' ? 'scoring' : tabParam === 'details' ? 'details' : 'details';
  const scoreIdParam = searchParams.get('scoreId') || undefined;

  const [featuredSpanId, setFeaturedSpanId] = useState<string | null>(spanIdParam ?? null);
  const [featuredScore, setFeaturedScore] = useState<ScoreRowData | undefined>();
  const [spanTab, setSpanTab] = useState<SpanTab>(initialSpanTab);
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [datasetDialogOpen, setDatasetDialogOpen] = useState(false);

  const {
    data: traceLight,
    isLoading: isTraceLoading,
    error: traceError,
    isError: isTraceError,
  } = useTraceLightSpans(traceId);
  const lightSpans = useMemo(() => traceLight?.spans ?? [], [traceLight?.spans]);
  const rootSpan = useMemo(() => lightSpans.find(s => s.parentSpanId == null), [lightSpans]);
  const timelineSpanIds = useMemo(() => getAllSpanIds(formatHierarchicalSpans(lightSpans)), [lightSpans]);

  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId,
    spanId: featuredSpanId ?? undefined,
    page: spanScoresPage,
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

  const featuredSpanIdx = featuredSpanId ? timelineSpanIds.indexOf(featuredSpanId) : -1;

  const goToSpan = useCallback(
    (id: string) => {
      setFeaturedSpanId(id);
      setFeaturedScore(undefined);
      setSpanTab('details');
      updateSearchParams({ spanId: id, tab: null, scoreId: null });
    },
    [updateSearchParams],
  );

  const handlePreviousSpan = featuredSpanIdx > 0 ? () => goToSpan(timelineSpanIds[featuredSpanIdx - 1]) : undefined;

  const handleNextSpan =
    featuredSpanIdx >= 0 && featuredSpanIdx < timelineSpanIds.length - 1
      ? () => goToSpan(timelineSpanIds[featuredSpanIdx + 1])
      : undefined;

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

  const error = useMemo(() => (isTraceError ? parseError(traceError) : undefined), [isTraceError, traceError]);

  const isUnauthorized = !!traceError && is401UnauthorizedError(traceError);
  const isForbidden = !!traceError && is403ForbiddenError(traceError);
  const hasOtherError = !!traceError && !isUnauthorized && !isForbidden;

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

  if (isUnauthorized || isForbidden || hasOtherError) {
    return (
      <PageLayout height="full">
        <PageLayout.TopArea>{traceTopAreaSharedContent}</PageLayout.TopArea>
        <PageLayout.MainArea isCentered>
          {isUnauthorized ? (
            <SessionExpired />
          ) : isForbidden ? (
            <PermissionDenied resource="traces" />
          ) : (
            <ErrorState title="Failed to load trace" message={error?.error ?? 'Unknown error'} />
          )}
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
        <TraceDataPanel
          traceId={traceId}
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
            <SpanDataPanel
              traceId={traceId}
              spanId={featuredSpanId}
              onClose={handleSpanClose}
              onPrevious={handlePreviousSpan}
              onNext={handleNextSpan}
              scorers={scorers}
              isLoadingScorers={isLoadingScorers}
              spanScoresData={spanScoresData}
              isLoadingSpanScoresData={isLoadingSpanScoresData}
              onSpanScoresPageChange={setSpanScoresPage}
              onScoreSelect={handleScoreSelect}
              activeTab={spanTab}
              onTabChange={handleSpanTabChange}
            />
            {featuredScore && <ScoreDataPanel score={featuredScore} onClose={handleScoreClose} />}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
