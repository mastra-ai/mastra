import { cn } from '@/lib/utils';
import { SideDialog, KeyValueList, TextAndIcon, getShortId, Section } from '@/components/ui/elements';
import { Buttons, Sections } from '@/components/ui/containers';
import {
  PanelLeftIcon,
  HashIcon,
  EyeIcon,
  ChevronsLeftRightEllipsisIcon,
  GaugeIcon,
  Settings,
  SettingsIcon,
  CirclePlayIcon,
  CircleGaugeIcon,
  ListTreeIcon,
  ArrowRight,
  ArrowRightIcon,
  Badge,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TraceTimeline } from './trace-timeline';
import { TraceSpanUsage } from './trace-span-usage';
import { useLinkComponent } from '@/lib/framework';
import { AISpanRecord } from '@mastra/core';
import { getSpanInfo, useTraceInfo } from './helpers';
import { SpanDialog } from './span-dialog';
import { SpanDetails } from './span-details';
import { formatHierarchicalSpans } from '../utils/format-hierarchical-spans';
import { UISpan } from '../types';
import { ScorersDropdown } from '@/domains/scores/components/scorers-dropdown';
import { ScoreTable } from '@/domains/scores/components/score-table';
import { TraceScoreList } from './trace-score-list';
import { Tabs } from '@/components/ui/elements/tabs/tabs';
import { ScoreDialog, Tab, TraceTimelineLegend } from '@/index';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/elements/buttons';
import { set } from 'zod';

type TraceDialogProps = {
  traceSpans?: AISpanRecord[];
  traceId?: string;
  traceDetails?: AISpanRecord;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isLoadingSpans?: boolean;
  computeAgentsLink?: () => string;
  computeWorkflowsLink?: () => string;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
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
  onScorerTriggered,
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

  console.log({ traceDetails });

  useEffect(() => {
    if (initialSpanId) {
      setSelectedSpanId(initialSpanId);
      setDialogIsOpen(true);
    }
  }, [initialSpanId]);

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

  const handleSpanClick = (id: string) => {
    setSelectedSpanId(id);
    setSpanDialogDefaultTab('details');
    setDialogIsOpen(true);
  };

  const handleToScoring = () => {
    setSelectedSpanId(hierarchicalSpans[0]?.id);
    setSpanDialogDefaultTab('scores');

    navigate(`/observability?traceId=${traceId}&spanId=${hierarchicalSpans?.[0]?.id}&tab=scores`);
  };

  const handleToLastScore = () => {
    setSelectedSpanId(hierarchicalSpans[0]?.id);
    setSpanDialogDefaultTab('scores');

    navigate(
      `/observability?traceId=${traceId}&spanId=${hierarchicalSpans?.[0]?.id}&tab=scores&scoreId=${hierarchicalSpans?.[0]?.recentScore?.id}`,
    );
  };

  const toNextSpan = () => {
    const currentIndex = flatSpans.findIndex(span => span.id === selectedSpanId);
    const nextItem = flatSpans[currentIndex + 1];

    if (nextItem) {
      setSelectedSpanId(nextItem.id);
    }
  };

  const toPreviousSpan = () => {
    const currentIndex = flatSpans.findIndex(span => span.id === selectedSpanId);
    const previousItem = flatSpans[currentIndex - 1];

    if (previousItem) {
      setSelectedSpanId(previousItem.id);
    }
  };

  const thereIsNextSpan = () => {
    const currentIndex = flatSpans.findIndex(span => span.id === selectedSpanId);
    return currentIndex < flatSpans.length - 1;
  };

  const thereIsPreviousSpan = () => {
    const currentIndex = flatSpans.findIndex(span => span.id === selectedSpanId);
    return currentIndex > 0;
  };

  const selectedSpanInfo = getSpanInfo({ span: selectedSpan, withTraceId: !combinedView, withSpanId: combinedView });

  return (
    <>
      <SideDialog
        dialogTitle="Observability Trace"
        dialogDescription="View and analyze trace details"
        isOpen={isOpen}
        onClose={onClose}
        level={1}
      >
        <SideDialog.Top onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <TextAndIcon>
            <EyeIcon /> {getShortId(traceId)}
          </TextAndIcon>
        </SideDialog.Top>

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

                  <Buttons className="w-full">
                    <Button onClick={handleToScoring}>
                      Scoring <CircleGaugeIcon />{' '}
                    </Button>
                    {traceDetails?.links?.[0]?.score && (
                      <Button onClick={handleToLastScore}>
                        Last score: <b>{traceDetails?.links?.[0]?.score}</b>
                      </Button>
                    )}
                  </Buttons>
                </div>
              </div>

              <Section>
                <Section.Header>
                  <Section.Heading>
                    <ListTreeIcon /> Timeline
                  </Section.Heading>
                  <TraceTimelineLegend spans={traceSpans} />
                </Section.Header>

                <TraceTimeline
                  hierarchicalSpans={hierarchicalSpans}
                  onSpanClick={handleSpanClick}
                  selectedSpanId={selectedSpanId}
                  isLoading={isLoadingSpans}
                />
              </Section>
            </Sections>
          )}
          {/* <div className={cn('overflow-y-auto pb-[2.5rem]')}>
            {traceDetails && (
              <div>
                <ScorersDropdown
                  trace={traceDetails}
                  spanId={selectedSpanId}
                  onScorerTriggered={onScorerTriggered}
                  entityType={entityType}
                />
              </div>
            )}

            {traceDetails?.metadata?.usage && (
              <TraceSpanUsage
                traceUsage={traceDetails?.metadata?.usage}
                traceSpans={traceSpans}
                className="mt-[2rem] pr-[1.5rem]"
              />
            )}
            <KeyValueList data={traceInfo} LinkComponent={Link} className="mt-[2rem]" />

            <TraceTimeline
              hierarchicalSpans={hierarchicalSpans}
              spans={traceSpans}
              onSpanClick={handleSpanClick}
              selectedSpanId={selectedSpanId}
              isLoading={isLoadingSpans}
              className="pr-[2.5rem] pt-[2.5rem]"
            />

            {traceDetails?.links?.length > 0 && (
              <div className="pt-[2.5rem] pr-[2.5rem]">
                <SideDialog.Heading as="h2" className="pb-[1rem]">
                  <GaugeIcon /> Scores
                </SideDialog.Heading>

                <div className="bg-surface2 rounded-lg overflow-hidden border-sm border-border1">
                  <ScoreTable
                    scores={traceDetails?.links}
                    onItemClick={scorerName => onScorerTriggered(scorerName, traceDetails!.traceId, selectedSpanId)}
                  />
                </div>
              </div>
            )}
          </div> */}

          {/* {selectedSpan && combinedView && (
            <div className="overflow-y-auto grid grid-rows-[auto_1fr] relative">
              <div className="absolute left-0 right-[2.5rem] h-[.5rem] bg-surface1 rounded-full top-0"></div>
              <div className="flex items-center justify-between pb-[.5rem] pt-[1rem] border-b border-border1 pr-[2.5rem]">
                <SideDialog.Top
                  onNext={thereIsNextSpan() ? toNextSpan : undefined}
                  onPrevious={thereIsPreviousSpan() ? toPreviousSpan : undefined}
                  showInnerNav={true}
                  className="pl-0"
                >
                  <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
                    <TextAndIcon>
                      <EyeIcon /> {getShortId(traceId)}
                    </TextAndIcon>
                    ›
                    <TextAndIcon>
                      <ChevronsLeftRightEllipsisIcon /> {getShortId(selectedSpanId)}
                    </TextAndIcon>
                  </div>
                </SideDialog.Top>
                <div className="flex items-center gap-[1rem]">
                  <button className="flex items-center gap-1" onClick={() => setCombinedView(false)}>
                    <PanelLeftIcon />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[20rem_1fr] gap-[1rem] overflow-y-auto">
                <div className="overflow-y-auto grid content-start p-[1.5rem] pl-0 gap-[2rem]">
                  <div>
                    <SideDialog.Heading as="h2">
                      <ChevronsLeftRightEllipsisIcon /> {selectedSpan?.name}
                    </SideDialog.Heading>
                  </div>
                  {selectedSpan?.attributes?.usage && (
                    <TraceSpanUsage
                      spanUsage={selectedSpan.attributes.usage}
                      className="xl:grid-cols-1 xl:gap-[1rem]"
                    />
                  )}
                  <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
                </div>
                <div className="overflow-y-auto pr-[2.5rem] pt-[2rem]">
                  <SpanDetails span={selectedSpan} onScorerTriggered={onScorerTriggered} />
                </div>
              </div>
            </div>
          )} */}
        </SideDialog.Content>
      </SideDialog>

      {traceDetails && (
        <SpanDialog
          trace={traceDetails}
          span={selectedSpan}
          isOpen={Boolean(dialogIsOpen && selectedSpanId && !combinedView)}
          onClose={() => {
            navigate(`/observability?traceId=${traceId}`);
            setDialogIsOpen(false);
            setSelectedSpanId(undefined);
          }}
          onNext={thereIsNextSpan() ? toNextSpan : undefined}
          onPrevious={thereIsPreviousSpan() ? toPreviousSpan : undefined}
          onViewToggle={() => setCombinedView(!combinedView)}
          spanInfo={selectedSpanInfo}
          onScorerTriggered={onScorerTriggered}
          defaultActiveTab={spanDialogDefaultTab}
          initialScoreId={initialScoreId}
        />
      )}
    </>
  );
}
