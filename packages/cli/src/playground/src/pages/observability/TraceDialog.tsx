import { CodeMirrorBlock } from '@/components/ui/code-mirror-block';
import { cn } from '@/lib/utils';
import { SideDialog, SideDialogHeader, SideDialogTop } from '@mastra/playground-ui';
import { PanelLeft, PanelLeftIcon, PanelTopIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

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
  const indent = depth * 16; // 16px indent per level

  return (
    <div className="border-l border-border1 pl-4 mb-2">
      <button
        onClick={() => onSpanClick(span.id)}
        type="button"
        aria-label={`View details for span ${span.name}`}
        className={cn(
          'flex items-center gap-2 p-2 rounded-md hover:bg-bg-3 transition-colors cursor-pointer',
          'hover:bg-icon1',
          {
            'bg-red-500 text-white': selectedSpanId === span.id,
          },
        )}
        style={{ marginLeft: `${indent}px` }}
      >
        {/* Span name and details */}
        <div className="flex">
          <div className="font-medium text-sm text-el-6 truncate">{span.name}</div>
          <div className="text-xs text-el-3 flex items-center gap-4">
            <span>{span.type}</span>
            <span>{span.latency}ms</span>
            {span.model && <span>Model: {span.model}</span>}
            {span.totalCost > 0 && <span>Cost: ${span.totalCost.toFixed(4)}</span>}
          </div>
        </div>

        {/* Expand/collapse indicator if has children */}
        {span.spans && span.spans.length > 0 && (
          <div className="text-xs text-el-3">
            {span.spans.length} child{span.spans.length !== 1 ? 'ren' : ''}
          </div>
        )}
      </button>

      {/* Recursively render child spans */}
      {span.spans && span.spans.length > 0 && (
        <div className="mt-2">
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

  // console.log('-->>', nestedSpans, spanIds);

  console.log({ selectedSpan });

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
            'grid-rows-[1fr_2fr]': combinedView,
            'grid-rows-[1fr]': !combinedView,
          })}
        >
          {/* <SideDialogHeader>
              <h2>Trace</h2>
            </SideDialogHeader> */}

          {/* Trace summary */}
          {/* <div className="bg-bg-2 p-4 rounded-lg">
                <h3 className="font-semibold text-el-6 mb-2">{trace?.name}</h3>
                <div className="text-sm text-el-3 space-y-1">
                <div>Total Latency: {trace?.latency}ms</div>
                <div>Environment: {trace?.environment}</div>
                <div>Created: {new Date(trace?.createdAt).toLocaleString()}</div>
                </div>
                </div> */}

          {/* Spans tree */}

          <div className="space-y-4 overflow-y-auto">
            {nestedSpans?.map((span: any) => (
              <SpanTree key={span.id} span={span} onSpanClick={handleSpanClick} selectedSpanId={selectedSpanId} />
            ))}
          </div>
          {combinedView && (
            <div className="border-t-2 border-gray-500">
              <div className="flex items-center justify-between">
                <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
                  <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{selectedSpanId}</div>
                </SideDialogTop>
                <button className="flex items-center gap-1" onClick={() => setCombinedView(false)}>
                  {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
                </button>
              </div>
              <SpanDetails span={selectedSpan} />
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
        <div className="flex items-center justify-between">
          <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
            <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{selectedSpanId}</div>
          </SideDialogTop>
          <button className="flex items-center gap-1" onClick={() => setCombinedView(true)}>
            {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
          </button>
        </div>
        <div className="p-[1.5rem] overflow-y-auto">
          <SpanDetails span={selectedSpan} />
        </div>
      </SideDialog>
    </>
  );
}

function SpanDetails({ span }: { span: any }) {
  return (
    <div className="grid gap-[1.5rem]">
      <section className="border border-border1 rounded-lg">
        <div className="border-b border-border1 last:border-b-0 grid">
          <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Input</h3>
          {span && (
            <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
              <CodeMirrorBlock value={JSON.stringify(span.input || {}, null, 2)} />
            </div>
          )}
        </div>
      </section>

      <section className="border border-border1 rounded-lg">
        <div className="border-b border-border1 last:border-b-0 grid">
          <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Output</h3>
          {span && (
            <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
              <CodeMirrorBlock value={JSON.stringify(span?.output || {}, null, 2)} />
            </div>
          )}
        </div>
      </section>

      <section className="border border-border1 rounded-lg">
        <div className="border-b border-border1 last:border-b-0 grid">
          <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Metadata</h3>
          {span && (
            <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
              <CodeMirrorBlock value={JSON.stringify(span?.metadata || {}, null, 2)} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
