'use client';

import { BracesIcon, XIcon } from 'lucide-react';
import { useExperimentTrace } from '../hooks/use-experiment-trace';
import { ExperimentTraceSpanDetails } from './experiment-trace-span-details';
import { Button } from '@/ds/components/Button';
import { Column } from '@/ds/components/Columns/column';
import { MainHeader } from '@/ds/components/MainHeader';
import { PrevNextNav } from '@/ds/components/PrevNextNav';
import { getShortId } from '@/ds/components/Text';

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
