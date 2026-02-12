'use client';

import { BracesIcon } from 'lucide-react';
import { getShortId } from '@/ds/components/Text';
import { ListAndDetails } from '@/ds/components/ListAndDetails/list-and-details';
import { MainHeader } from '@/ds/components/MainHeader';
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
      <ListAndDetails.ColumnToolbar>
        <ListAndDetails.NextPrevNavigation
          onPrevious={onPrevious}
          onNext={onNext}
          previousAriaLabel="View previous span details"
          nextAriaLabel="View next span details"
        />
        <ListAndDetails.CloseButton onClick={onClose} aria-label="Close span details" />
      </ListAndDetails.ColumnToolbar>

      <ListAndDetails.ColumnContent>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title size="smaller">
              <BracesIcon /> Span {getShortId(spanId)}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        <ExperimentTraceSpanDetails span={span} />
      </ListAndDetails.ColumnContent>
    </>
  );
}
