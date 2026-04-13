'use client';

import { Button, Column, MainHeader, PrevNextNav, getShortId } from '@mastra/playground-ui';
import { BracesIcon, XIcon } from 'lucide-react';
import { useExperimentTrace } from '../hooks/use-experiment-trace';
import { ExperimentTraceSpanDetails } from './experiment-trace-span-details';

export type ExperimentResultSpanPaneProps = {
  traceId: string;
  spanId: string;
  onNext?: () => void;
  onPrevious?: () => void;
  onClose: () => void;
};

export function ExperimentResultSpanPane({
  traceId,
  spanId,
  onNext,
  onPrevious,
  onClose,
}: ExperimentResultSpanPaneProps) {
  const { data: traceData } = useExperimentTrace(traceId);
  const span = traceData?.spans?.find(s => s.spanId === spanId);

  return (
    <>
      <Column.Toolbar>
        <PrevNextNav
          onPrevious={onPrevious}
          onNext={onNext}
          previousAriaLabel="View previous span details"
          nextAriaLabel="View next span details"
        />
        <Button onClick={onClose} aria-label="Close span details">
          <XIcon />
        </Button>
      </Column.Toolbar>

      <Column.Content>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <BracesIcon /> Span {getShortId(spanId)}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <ExperimentTraceSpanDetails span={span} />
      </Column.Content>
    </>
  );
}
