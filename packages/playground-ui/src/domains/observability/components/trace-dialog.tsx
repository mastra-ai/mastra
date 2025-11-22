import { cn } from '@/lib/utils';
import {
  SideDialog,
  KeyValueList,
  TextAndIcon,
  getShortId,
  Section,
  getToNextEntryFn,
  getToPreviousEntryFn,
} from '@/components/ui/elements';
import { ButtonsGroup, Sections } from '@/components/ui/containers';
import {
  PanelLeftIcon,
  HashIcon,
  EyeIcon,
  ChevronsLeftRightEllipsisIcon,
  GaugeIcon,
  CircleGaugeIcon,
  ListTreeIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TraceTimeline } from './trace-timeline';
import { TraceSpanUsage } from './trace-span-usage';
import { useLinkComponent } from '@/lib/framework';
import { SpanRecord } from '@mastra/core/storage';
import { getSpanInfo, useTraceInfo } from './helpers';
import { SpanDialog } from './span-dialog';
import { formatHierarchicalSpans } from '../utils/format-hierarchical-spans';
import { type UISpan, type UISpanState } from '../types';
import { TraceTimelineTools } from './trace-timeline-tools';
import { useTraceSpanScores } from '@/domains/scores/hooks/use-trace-span-scores';
import { Button } from '@/components/ui/elements/buttons';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SpanTabs } from './span-tabs';
import { set } from 'zod';

type TraceDialogProps = {
  traceSpans?: SpanRecord[];
  traceId?: string;
  traceDetails?: SpanRecord;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isLoadingSpans?: boolean;
  computeAgentsLink?: () => string;
  computeWorkflowsLink?: () => string;
  computeTraceLink: (traceId: string, spanId?: string, tab?: string) => string;
  initialSpanId?: string;
  initialSpanTab?: string;
  initialScoreId?: string;
};

export function TraceDialog({
  traceId,
  traceSpans = [],
  traceDetails,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  isLoadingSpans,
  computeAgentsLink,
  computeWorkflowsLink,
  computeTraceLink,
  initialSpanId,
  initialSpanTab,
  initialScoreId,
}: TraceDialogProps) {
  const { Link, navigate } = useLinkComponent();

  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(Boolean(initialSpanId));
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId);
  const [combinedView, setCombinedView] = useState<boolean>(false);
  const [spanDialogDefaultTab, setSpanDialogDefaultTab] = useState(initialSpanTab || 'details');
  const selectedSpan = traceSpans.find(span => span.spanId === selectedSpanId);
  const traceInfo = useTraceInfo(traceDetails);
  const [spanScoresPage, setSpanScoresPage] = useState(0);
  const [orderedSpans, setOrderedSpans] = useState<UISpanState[] | undefined>();
  const [searchPhrase, setSearchPhrase] = useState<string>('');
  const [fadedSpanTypes, setFadedSpanTypes] = useState<string[]>([]);
  const [featuredSpanIds, setFeaturedSpanIds] = useState<string[]>([]);
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  useEffect(() => {
    if (searchPhrase.trim() === '') {
      setFeaturedSpanIds([]);
      return;
    }

    const lowerCaseSearch = searchPhrase.toLowerCase();

    const newFeaturedSpanIds = traceSpans
      .filter(span => span.name.toLowerCase().includes(lowerCaseSearch))
      .map(span => span.spanId);

    setFeaturedSpanIds(newFeaturedSpanIds);
  }, [searchPhrase]);

  useEffect(() => {
    if (initialSpanId) {
      setSelectedSpanId(initialSpanId);
      setDialogIsOpen(true);
    }
  }, [initialSpanId]);

  useEffect(() => {
    // Reset span scores page when selected span changes
    if (spanScoresPage > 0) {
      setSpanScoresPage(0);
    }
  }, [selectedSpanId]);

  const hierarchicalSpans = useMemo(() => {
    return formatHierarchicalSpans(traceSpans);
  }, [traceSpans]);

  const flatSpans = useMemo(() => {
    const flattenSpans = (spans: UISpan[]): UISpan[] => {
      const result: UISpan[] = [];

      const traverse = (span: UISpan) => {
        result.push(span);
        if (span.spans && span.spans.length > 0) {
          span.spans.forEach(traverse);
        }
      };

      spans.forEach(traverse);
      return result;
    };

    return flattenSpans(hierarchicalSpans);
  }, [hierarchicalSpans]);

  useEffect(() => {
    if (orderedSpans === undefined) {
      const spansOrder = flatSpans?.map(span => ({
        spanId: span.id,
        expanded: false,
      }));

      setOrderedSpans(spansOrder);
    }
  }, [flatSpans]);

  const { data: spanScoresData, isLoading: isLoadingSpanScoresData } = useTraceSpanScores({
    traceId: traceId,
    spanId: selectedSpanId || flatSpans?.[0]?.id,
    page: spanScoresPage,
  });

  const handleSpanClick = (id: string) => {
    if (selectedSpanId === id) {
      setSelectedSpanId(undefined);
    } else {
      setSelectedSpanId(id);
      setSpanDialogDefaultTab('details');
      setDialogIsOpen(true);
    }
  };

  const handleToScoring = () => {
    setSelectedSpanId(hierarchicalSpans[0]?.id);
    setSpanDialogDefaultTab('scores');

    if (traceId) {
      navigate(`${computeTraceLink(traceId, hierarchicalSpans?.[0]?.id)}&tab=scores`);
    }
  };

  const handleToLastScore = () => {
    setSelectedSpanId(hierarchicalSpans[0]?.id);
    setSpanDialogDefaultTab('scores');

    if (traceId) {
      navigate(
        `${computeTraceLink(
          traceId,
          hierarchicalSpans?.[0]?.id,
        )}&tab=scores&scoreId=${spanScoresData?.scores?.[0]?.id}`,
      );
    }
  };

  const handleLegendClick = (type: string) => {
    setFadedSpanTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const selectedSpanInfo = getSpanInfo({ span: selectedSpan, withTraceId: !combinedView, withSpanId: combinedView });
  const toNextSpan = getToNextEntryFn({ entries: flatSpans, id: selectedSpanId, update: setSelectedSpanId });
  const toPreviousSpan = getToPreviousEntryFn({ entries: flatSpans, id: selectedSpanId, update: setSelectedSpanId });

  return (
    <>
      <SideDialog
        dialogTitle="Observability Trace"
        dialogDescription="View and analyze trace details"
        isOpen={isOpen}
        onClose={onClose}
        level={1}
      >
        <SideDialog.Top>
          <TextAndIcon>
            <EyeIcon /> {getShortId(traceId)}
          </TextAndIcon>
          |
          <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
        </SideDialog.Top>

        <div
          className={cn('overflow-y-auto', {
            'grid grid-rows-[2fr_3fr]': Boolean(selectedSpan && combinedView),
          })}
        >
          <SideDialog.Content>
            <SideDialog.Header>
              <SideDialog.Heading>
                <EyeIcon /> {traceDetails?.name}
              </SideDialog.Heading>

              <TextAndIcon>
                <HashIcon /> {traceId}
              </TextAndIcon>
            </SideDialog.Header>

            {traceDetails && (
              <Sections>
                <div className="grid xl:grid-cols-[3fr_2fr] gap-[1rem] items-start">
                  <KeyValueList data={traceInfo} LinkComponent={Link} />
                  <div className="bg-surface3 p-[1.5rem] rounded-lg grid gap-[1rem]">
                    <h4 className="text-[1rem]">
                      <TextAndIcon>
                        <GaugeIcon /> Evaluate trace
                      </TextAndIcon>
                    </h4>

                    <ButtonsGroup className="w-full">
                      <Button onClick={handleToScoring}>
                        Scoring <CircleGaugeIcon />{' '}
                      </Button>
                      {spanScoresData?.scores?.[0] && (
                        <Button onClick={handleToLastScore}>
                          Last score: <b>{spanScoresData?.scores?.[0]?.score}</b>
                        </Button>
                      )}
                    </ButtonsGroup>
                  </div>
                </div>

                <Section>
                  <Section.Header>
                    <Section.Heading>
                      <ListTreeIcon /> Timeline
                    </Section.Heading>
                  </Section.Header>

                  <TraceTimelineTools
                    spans={traceSpans}
                    fadedTypes={fadedSpanTypes}
                    onLegendClick={handleLegendClick}
                    searchPhrase={searchPhrase}
                    onSearchPhraseChange={setSearchPhrase}
                  />

                  <TraceTimeline
                    hierarchicalSpans={hierarchicalSpans}
                    onSpanClick={handleSpanClick}
                    selectedSpanId={selectedSpanId}
                    isLoading={isLoadingSpans}
                    fadedTypes={fadedSpanTypes}
                    expandedSpanIds={expandedSpanIds}
                    setExpandedSpanIds={setExpandedSpanIds}
                    featuredSpanIds={featuredSpanIds}
                  />
                </Section>
              </Sections>
            )}
          </SideDialog.Content>

          {selectedSpan && combinedView && (
            <div className="grid grid-rows-[auto_1fr] relative overflow-y-auto">
              <SideDialog.Top withTopSeparator={true}>
                <TextAndIcon>
                  <ChevronsLeftRightEllipsisIcon /> {getShortId(selectedSpanId)}
                </TextAndIcon>
                |
                <SideDialog.Nav onNext={toNextSpan} onPrevious={toPreviousSpan} />
                <button className="ml-auto mr-[2rem]" onClick={() => setCombinedView(false)}>
                  <PanelLeftIcon /> <VisuallyHidden>Switch to dialog view</VisuallyHidden>
                </button>
              </SideDialog.Top>

              <div className={cn('h-full overflow-y-auto grid gap-[2rem] grid-cols-[20rem_1fr]')}>
                <div className="overflow-y-auto grid content-start p-[2rem] gap-[2rem]">
                  <SideDialog.Heading as="h2">
                    <ChevronsLeftRightEllipsisIcon /> {selectedSpan?.name}
                  </SideDialog.Heading>

                  {selectedSpan?.attributes?.usage && (
                    <TraceSpanUsage
                      spanUsage={selectedSpan.attributes.usage}
                      className="xl:grid-cols-1 xl:gap-[1rem]"
                    />
                  )}
                  <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
                </div>
                <div className="overflow-y-auto pr-[2rem] pt-[2rem] h-full">
                  <SpanTabs
                    trace={traceDetails}
                    span={selectedSpan}
                    spanScoresData={spanScoresData}
                    onSpanScoresPageChange={setSpanScoresPage}
                    isLoadingSpanScoresData={isLoadingSpanScoresData}
                    spanInfo={selectedSpanInfo}
                    defaultActiveTab={spanDialogDefaultTab}
                    initialScoreId={initialScoreId}
                    computeTraceLink={computeTraceLink}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </SideDialog>

      {traceDetails && (
        <SpanDialog
          trace={traceDetails}
          span={selectedSpan}
          spanScoresData={spanScoresData}
          onSpanScoresPageChange={setSpanScoresPage}
          isLoadingSpanScoresData={isLoadingSpanScoresData}
          isOpen={Boolean(dialogIsOpen && selectedSpanId && !combinedView)}
          onClose={() => {
            navigate(computeTraceLink(traceId || ''));
            setDialogIsOpen(false);
            //   setSelectedSpanId(undefined);
          }}
          onNext={toNextSpan}
          onPrevious={toPreviousSpan}
          onViewToggle={() => setCombinedView(!combinedView)}
          spanInfo={selectedSpanInfo}
          defaultActiveTab={spanDialogDefaultTab}
          initialScoreId={initialScoreId}
          computeTraceLink={computeTraceLink}
        />
      )}
    </>
  );
}
