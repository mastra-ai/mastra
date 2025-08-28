import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogHeader,
  SideDialogTop,
  SideDialogCodeSection,
  KeyValueList,
  formatHierarchicalSpans,
  UISpan,
} from '@mastra/playground-ui';
import { isThisYear, isToday } from 'date-fns';
import { format } from 'date-fns/format';
import { CalendarIcon, ClockIcon, PanelLeftIcon, PanelTopIcon, SquareSplitVerticalIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router';

// import { TraceSpanTree } from './trace-tree-span';
import { TraceTree } from './trace-tree';
import { useAITrace } from '@/domains/observability/hooks/use-ai-trace';

type TraceDialogProps = {
  parentTraceId?: string;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

export function TraceDialog({ parentTraceId, isOpen, onClose, onNext, onPrevious }: TraceDialogProps) {
  const { data: detailedTrace } = useAITrace(parentTraceId, { enabled: !!parentTraceId });

  const rawSpans = detailedTrace?.spans || [];

  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(undefined);
  const [combinedView, setCombinedView] = useState<boolean>(false);
  const [combinedViewProportion, setCombinedViewProportion] = useState<'1/1' | '1/2' | '1/3'>('1/1');

  const hierarchicalSpans = useMemo(() => {
    if (!detailedTrace) return [];
    return formatHierarchicalSpans(detailedTrace);
  }, [detailedTrace]);

  // Handler to toggle combined view proportion
  const toggleCombinedViewProportion = () => {
    setCombinedViewProportion(prev => {
      switch (prev) {
        case '1/3':
          return '1/2';
        case '1/2':
          return '1/1';
        case '1/1':
          return '1/3';
        default:
          return '1/3';
      }
    });
  };

  const handleSpanClick = (span: UISpan) => {
    setSelectedSpanId(span.id);
    setDialogIsOpen(true);
  };

  // useEffect(() => {
  //   if (selectedSpanId && spans) {
  //     const span = spans.find((span: any) => span.id === selectedSpanId);
  //     if (span) {
  //       setSelectedSpan(span);
  //     } else {
  //       console.warn('Span not found for id:', selectedSpanId);
  //     }
  //   }
  // }, [selectedSpanId, spans]);

  const toNextSpan = () => {
    const currentIndex = rawSpans.findIndex(span => span.spanId === selectedSpanId);
    if (currentIndex === -1 || currentIndex === (rawSpans.length || 0) - 1) {
      return null; // No next event
    }
    const prevSpanId = rawSpans[(currentIndex || 0) + 1].spanId;
    const prevSpan = rawSpans.find((span: any) => span.spanId === prevSpanId);
    if (!prevSpan) {
      console.warn('Span not found for id:', prevSpanId);
      return;
    }
    setSelectedSpanId(prevSpanId);
  };

  const toPreviousSpan = () => {
    // const currentIndex = spanIds?.findIndex(id => id === selectedSpanId);
    // if (currentIndex === -1 || currentIndex === (spanIds?.length || 0) - 1) {
    //   return null; // No next event
    // }
    // const nextSpanId = spanIds?.[(currentIndex || 0) - 1];
    // const nextSpan = spans?.find((span: any) => span.id === nextSpanId);
    // if (!nextSpan) {
    //   console.warn('Span not found for id:', nextSpanId);
    //   return;
    // }
    // setSelectedSpanId(nextSpanId);
  };

  const selectedSpanInfo = [
    {
      key: 'id',
      label: 'Span ID',
      value: selectedSpan?.id,
    },
    {
      key: 'id',
      label: 'Trace ID',
      value: selectedSpan?.traceId,
    },
    {
      key: 'createdAt',
      label: 'Created At',
      value: formatDate(selectedSpan?.createdAt),
    },
    {
      key: 'startedAt',
      label: 'Started At',
      value: formatDate(selectedSpan?.startTime),
    },
  ];

  function formatDate(dateString: string | undefined): React.ReactNode {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return '';

    if (isToday(date)) {
      return (
        <span className="flex items-center [&>svg]:w-[1em] [&>svg]:opacity-70 [&>svg]:h-[1em] gap-[0.5rem]">
          <ClockIcon />
          {format(date, 'HH:mm:ss')}
        </span>
      );
    }

    return (
      <span className="flex items-center [&>svg]:w-[.9em] [&>svg]:opacity-60 [&>svg]:h-[.9em] gap-[0.5rem]">
        <CalendarIcon />
        {isThisYear(date) ? format(date, 'dd MMM') : format(date, 'dd MMM yyyy')}
        <ClockIcon />
        {format(date, 'HH:mm:ss')}
      </span>
    );
  }

  return (
    <>
      <SideDialog
        dialogTitle="Observability Event"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!dialogIsOpen}
        className={cn('w-[calc(100vw-20rem)] max-w-[75%]', '3xl:max-w-[60rem]', '4xl:max-w-[60%]')}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{detailedTrace?.traceId}</div>
        </SideDialogTop>

        <div
          className={cn('p-[1.5rem] overflow-y-auto  grid', {
            'grid-rows-[auto_1fr_1fr]': combinedView && combinedViewProportion === '1/1',
            'grid-rows-[auto_1fr_2fr]': combinedView && combinedViewProportion === '1/2',
            'grid-rows-[auto_1fr_3fr]': combinedView && combinedViewProportion === '1/3',
            'grid-rows-[auto_1fr]': !combinedView,
          })}
        >
          <SideDialogHeader>
            <h2>Trace</h2>
          </SideDialogHeader>

          <TraceTree
            spans={hierarchicalSpans}
            onSpanClick={handleSpanClick}
            selectedSpanId={selectedSpanId}
            overallLatency={hierarchicalSpans?.[0]?.latency || 0}
            overallStartTime={hierarchicalSpans?.[0]?.startTime || ''}
          />

          {combinedView && (
            <div className="overflow-y-auto border-t-2 border-gray-500 grid grid-rows-[auto_1fr]">
              <div className="flex items-center justify-between py-[.5rem] border-b border-border1 pr-[1rem]">
                <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
                  <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{selectedSpanId}</div>
                </SideDialogTop>
                <div className="flex items-center gap-[1rem]">
                  <button onClick={toggleCombinedViewProportion}>
                    <SquareSplitVerticalIcon />
                  </button>
                  <button className="flex items-center gap-1" onClick={() => setCombinedView(false)}>
                    {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[20rem_1fr] p-[1.5rem] overflow-y-auto">
                <div className="overflow-y-auto">
                  <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
                </div>
                <div className="overflow-y-auto">
                  <SpanDetails span={selectedSpan} />
                </div>
              </div>
            </div>
          )}
        </div>
      </SideDialog>

      <SideDialog
        dialogTitle="Observability Span"
        isOpen={dialogIsOpen && selectedSpanId && !combinedView}
        onClose={() => setDialogIsOpen(false)}
        hasCloseButton={true}
        className={cn('w-[calc(100vw-20rem)] max-w-[60%]', '3xl:max-w-[50rem]', '4xl:max-w-[40%]')}
      >
        <div className="flex items-center justify-between pr-[1.5rem]">
          <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
            <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
              <span>{selectedSpan?.traceId?.slice(0, 6)}</span>›<span>{selectedSpanId?.slice(0, 6)}</span>
            </div>
          </SideDialogTop>
          <button className="flex items-center gap-1" onClick={() => setCombinedView(true)}>
            {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
          </button>
        </div>

        <div className="p-[1.5rem] overflow-y-auto grid gap-[1.5rem]">
          <SideDialogHeader>
            <h2>{selectedSpan?.name}</h2>
          </SideDialogHeader>
          <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
          <SpanDetails span={selectedSpan} />
        </div>
      </SideDialog>
    </>
  );
}

function SpanDetails({ span }: { span: any }) {
  return (
    <div className="grid gap-[1.5rem] mb-[2rem]">
      <SideDialogCodeSection title="Input" codeStr={JSON.stringify(span.input || {}, null, 2)} />
      <SideDialogCodeSection title="Output" codeStr={JSON.stringify(span.output || {}, null, 2)} />
      <SideDialogCodeSection title="Metadata" codeStr={JSON.stringify(span.metadata || {}, null, 2)} />
      <SideDialogCodeSection title="Parameters" codeStr={JSON.stringify(span.parameters || {}, null, 2)} />
    </div>
  );
}
