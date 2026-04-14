'use client';

import { Button, Column, MainHeader, getShortId } from '@mastra/playground-ui';
import { EyeIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useExperimentTrace } from '../hooks/use-experiment-trace';
import { formatTraceSpans } from '../utils/format-trace-spans';
import { ExperimentTraceTimeline } from './experiment-trace-timeline';
import { ExperimentTraceTimelineTools } from './experiment-trace-timeline-tools';

export type ExperimentResultTracePanelProps = {
  traceId: string;
  selectedSpanId?: string;
  onSpanSelect?: (spanId: string | undefined) => void;
  onClose: () => void;
};

export function ExperimentResultTracePanel({
  traceId,
  selectedSpanId,
  onSpanSelect,
  onClose,
}: ExperimentResultTracePanelProps) {
  const { data: traceData, isLoading } = useExperimentTrace(traceId);
  const traceSpans = traceData?.spans ?? [];

  const [searchPhrase, setSearchPhrase] = useState('');
  const [fadedSpanTypes, setFadedSpanTypes] = useState<string[]>([]);
  const [featuredSpanIds, setFeaturedSpanIds] = useState<string[]>([]);
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);

  const hierarchicalSpans = useMemo(() => {
    return formatTraceSpans(traceSpans);
  }, [traceSpans]);

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
  }, [searchPhrase, traceSpans]);

  // Reset local state when traceId changes
  useEffect(() => {
    setSearchPhrase('');
    setFadedSpanTypes([]);
    setFeaturedSpanIds([]);
    setExpandedSpanIds([]);
  }, [traceId]);

  const handleSpanClick = (id: string) => {
    if (selectedSpanId === id) {
      onSpanSelect?.(undefined);
    } else {
      onSpanSelect?.(id);
    }
  };

  const handleLegendClick = (type: string) => {
    setFadedSpanTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleLegendReset = () => {
    setFadedSpanTypes([]);
  };

  return (
    <>
      <Column.Toolbar>
        <Button onClick={onClose} aria-label="Close trace panel">
          <XIcon />
        </Button>
      </Column.Toolbar>

      <Column.Content>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <EyeIcon /> Trace {getShortId(traceId)}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <ExperimentTraceTimelineTools
          spans={traceSpans}
          fadedTypes={fadedSpanTypes}
          onLegendClick={handleLegendClick}
          onLegendReset={handleLegendReset}
          searchPhrase={searchPhrase}
          onSearchPhraseChange={setSearchPhrase}
          traceId={traceId}
        />

        <ExperimentTraceTimeline
          hierarchicalSpans={hierarchicalSpans}
          onSpanClick={handleSpanClick}
          selectedSpanId={selectedSpanId}
          isLoading={isLoading}
          fadedTypes={fadedSpanTypes}
          expandedSpanIds={expandedSpanIds}
          setExpandedSpanIds={setExpandedSpanIds}
          featuredSpanIds={featuredSpanIds}
        />
      </Column.Content>
    </>
  );
}
