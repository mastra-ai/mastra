import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogHeader,
  SideDialogTop,
  SideDialogCodeSection,
  KeyValueList,
} from '@mastra/playground-ui';
import { isThisYear, isToday } from 'date-fns';
import { format } from 'date-fns/format';
import { CalendarIcon, ClockIcon, PanelLeftIcon, PanelTopIcon, SquareSplitVerticalIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';

// Recursive component to render spans as nested elements
function SpanTree({
  span,
  depth = 0,
  onSpanClick,
  selectedSpanId,
}: {
  span: any;
  depth?: number;
  onSpanClick?: (span: any) => void;
  selectedSpanId?: string;
}) {
  return (
    <div
      className="border-l border-dashed border-gray-500 pl-[1.5rem]"
      // style={{ marginLeft: `${indent}px` }}
    >
      <button
        onClick={() => onSpanClick(span.id)}
        type="button"
        aria-label={`View details for span ${span.name}`}
        className={cn('flex items-center p-[0.5rem] rounded-md  transition-colors cursor-pointer ', 'hover:bg-icon2', {
          'bg-icon1 text-white': selectedSpanId === span.id,
        })}
        //   style={{ marginLeft: `${indent}px` }}
      >
        {/* Span name and details */}
        <div className="flex text-[0.875rem]">
          <div className="truncate">{span.name}</div>
          <div className="flex items-center gap-[1rem]">
            <span>{span.type}</span>
            <span>{span.latency}ms</span>
            {span.model && <span>Model: {span.model}</span>}
            {span.totalCost > 0 && <span>Cost: ${span.totalCost.toFixed(4)}</span>}
          </div>
        </div>

        {/* Expand/collapse indicator if has children */}
        {span.spans && span.spans.length > 0 && (
          <div className="">
            {span.spans.length} child{span.spans.length !== 1 ? 'ren' : ''}
          </div>
        )}
      </button>

      {/* Recursively render child spans */}
      {span.spans && span.spans.length > 0 && (
        <div className="">
          {span.spans.map((childSpan: any) => (
            <SpanTree
              key={childSpan.id}
              span={childSpan}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpanTimeline({
  span,
  depth = 0,
  onSpanClick,
  selectedSpanId,
  overallLatency,
}: {
  span: any;
  depth?: number;
  onSpanClick?: (span: any) => void;
  selectedSpanId?: string;
  overallLatency?: number;
}) {
  // 16px indent per level

  let overallStartTime;
  let overallEndTime;
  let overallDuration;

  const startTimeDate = span?.startTime ? new Date(span.startTime) : null;
  const endTimeDate = span?.endTime ? new Date(span.endTime) : null;
  const duration = startTimeDate && endTimeDate ? endTimeDate.getTime() - startTimeDate.getTime() : 0;
  const latency = span?.latency;

  // console.log({ duration });

  if (depth === 0) {
    overallLatency = latency;
    // overallStartTime = startTimeDate;
    // overallEndTime = endTimeDate;
    // overallDuration = duration;
    // console.log('Overall Span:', {
    //   start: overallStartTime,
    //   end: overallEndTime,
    //   duration: overallDuration,
    // });
  }

  // console.log('Span Timeline:', {
  //   startTimeDate,
  //   duration,
  // });

  // const startShift = overallStartTime && startTimeDate ? startTimeDate.getTime() - overallStartTime.getTime() : 0;

  return (
    <div>
      <div
        className={cn('flex items-center p-[0.5rem] rounded-md  transition-colors cursor-pointer ', 'hover:bg-icon2')}
      >
        {latency}
        <div
          className="w-full bg-green-500 h-[2px]"
          style={{ width: overallLatency ? `${(duration / overallLatency) * 100}%` : '0%' }}
        ></div>
      </div>
      {/* Recursively render child spans */}
      {span.spans && span.spans.length > 0 && (
        <div className="">
          {span.spans.map((childSpan: any) => (
            <SpanTimeline
              key={childSpan.id}
              span={childSpan}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              selectedSpanId={selectedSpanId}
              overallLatency={overallLatency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TraceDialogProps = {
  trace?: any;
  spans?: any[];
  nestedSpans: any;
  spanIds?: string[];
  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
};

export function TraceDialog({
  trace,
  spans,
  nestedSpans,
  spanIds,
  isOpen,
  onClose,
  onNext,
  onPrevious,
}: TraceDialogProps) {
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedSpanId, setSelectedSpanId] = useState<any>(null);
  const [selectedSpan, setSelectedSpan] = useState<any>(null);
  const [combinedView, setCombinedView] = useState<boolean>(false);
  const [combinedViewProportion, setCombinedViewProportion] = useState<'1/1' | '1/2' | '1/3'>('1/1');

  console.log({ selectedSpan, combinedViewProportion });

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

  const handleSpanClick = (id: string) => {
    console.log('Selected span:', id);

    setSelectedSpanId(id);
    setDialogIsOpen(true);
  };

  useEffect(() => {
    if (selectedSpanId && spans) {
      const span = spans.find((span: any) => span.id === selectedSpanId);
      if (span) {
        setSelectedSpan(span);
      } else {
        console.warn('Span not found for id:', selectedSpanId);
      }
    }
  }, [selectedSpanId, spans]);

  const toNextSpan = () => {
    const currentIndex = spanIds?.findIndex(id => id === selectedSpanId);

    if (currentIndex === -1 || currentIndex === (spanIds?.length || 0) - 1) {
      return null; // No next event
    }

    const prevSpanId = spanIds?.[(currentIndex || 0) + 1];
    const prevSpan = spans?.find((span: any) => span.id === prevSpanId);

    if (!prevSpan) {
      console.warn('Span not found for id:', prevSpanId);
      return;
    }

    setSelectedSpanId(prevSpanId);
  };

  const toPreviousSpan = () => {
    const currentIndex = spanIds?.findIndex(id => id === selectedSpanId);

    if (currentIndex === -1 || currentIndex === (spanIds?.length || 0) - 1) {
      return null; // No next event
    }

    const nextSpanId = spanIds?.[(currentIndex || 0) - 1];
    const nextSpan = spans?.find((span: any) => span.id === nextSpanId);

    if (!nextSpan) {
      console.warn('Span not found for id:', nextSpanId);
      return;
    }

    setSelectedSpanId(nextSpanId);
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
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{trace?.id}</div>
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

          <div className="grid grid-cols-[3fr_1fr] gap-[1.5rem] overflow-y-auto">
            <div className="space-y-[1.5rem] overflow-y-auto">
              {nestedSpans?.map((span: any) => (
                <SpanTree key={span.id} span={span} onSpanClick={handleSpanClick} selectedSpanId={selectedSpanId} />
              ))}
            </div>
            <div className="space-y-[1.5rem] overflow-y-auto">
              {nestedSpans?.map((span: any) => (
                <SpanTimeline key={span.id} span={span} onSpanClick={handleSpanClick} selectedSpanId={selectedSpanId} />
              ))}
            </div>
          </div>
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
