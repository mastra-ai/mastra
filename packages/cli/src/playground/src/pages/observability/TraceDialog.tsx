import { CodeMirrorBlock } from '@/components/ui/code-mirror-block';
import { cn } from '@/lib/utils';
import { SideDialog, SideDialogHeader, SideDialogTop } from '@mastra/playground-ui';
import { useState } from 'react';

// Recursive component to render spans as nested elements
function SpanTree({ span, depth = 0, onSpanClick }: { span: any; depth?: number; onSpanClick?: (span: any) => void }) {
  const indent = depth * 16; // 16px indent per level

  return (
    <div className="border-l border-border1 pl-4 mb-2">
      <button
        onClick={() => onSpanClick(span)}
        type="button"
        aria-label={`View details for span ${span.name}`}
        className={cn(
          'flex items-center gap-2 p-2 rounded-md hover:bg-bg-3 transition-colors cursor-pointer',
          'hover:bg-icon1',
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
            <SpanTree key={childSpan.id} span={childSpan} depth={depth + 1} onSpanClick={onSpanClick} />
          ))}
        </div>
      )}
    </div>
  );
}

type TraceDialogProps = {
  trace?: any;
  spans?: any;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
};

export function TraceDialog({ trace, spans, isOpen, onClose, onNext, onPrevious }: TraceDialogProps) {
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedSpan, setSelectedSpan] = useState<any>(null);

  const handleSpanClick = (span: any) => {
    setSelectedSpan(span);
    setDialogIsOpen(true);
  };

  const toPreviousSpan = (currentSpan: any) => {
    const currentIndex = spans?.findIndex(span => span?.id === currentSpan?.id);
    if (currentIndex === -1 || currentIndex === (spans?.length || 0) - 1) {
      return null; // No next event
    }
    return () => setSelectedSpan(events[(currentIndex || 0) + 1]);
  };

  const toNextSpan = (currentEvent: any) => {
    const currentIndex = events?.findIndex(event => event?.id === currentEvent?.id);
    if ((currentIndex || 0) <= 0) {
      return null; // No previous event
    }
    return () => setSelectedEvent(events[(currentIndex || 0) - 1]);
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

        <div className="p-[1.5rem] overflow-y-auto">
          <>
            <SideDialogHeader>
              <h2>Trace</h2>
            </SideDialogHeader>

            <div className="space-y-4">
              {/* Trace summary */}
              <div className="bg-bg-2 p-4 rounded-lg">
                <h3 className="font-semibold text-el-6 mb-2">{trace?.name}</h3>
                <div className="text-sm text-el-3 space-y-1">
                  <div>Total Latency: {trace?.latency}ms</div>
                  <div>Environment: {trace?.environment}</div>
                  <div>Created: {new Date(trace?.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {/* Spans tree */}
              <div>
                <h3 className="font-semibold text-el-6 mb-3">Spans</h3>
                <div className="space-y-1">
                  {spans?.map((span: any) => (
                    <SpanTree key={span.id} span={span} onSpanClick={handleSpanClick} />
                  ))}
                </div>
              </div>
            </div>
          </>
        </div>
      </SideDialog>

      <SideDialog
        dialogTitle="Observability Span"
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        hasCloseButton={true}
        className={cn('w-[calc(100vw-20rem)] max-w-[60%]', '3xl:max-w-[50rem]', '4xl:max-w-[40%]')}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{trace?.id}</div>
        </SideDialogTop>
        <div className="p-[1.5rem] overflow-y-auto">
          <>
            <SideDialogHeader>
              <h2>Span</h2>
            </SideDialogHeader>

            <div className="grid gap-[1.5rem]">
              <section className="border border-border1 rounded-lg">
                <div className="border-b border-border1 last:border-b-0 grid">
                  <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Input</h3>
                  {selectedSpan?.input && (
                    <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
                      <CodeMirrorBlock value={JSON.stringify(selectedSpan.input, null, 2)} />
                    </div>
                  )}
                </div>
              </section>

              <section className="border border-border1 rounded-lg">
                <div className="border-b border-border1 last:border-b-0 grid">
                  <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Output</h3>
                  {selectedSpan?.output && (
                    <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
                      <CodeMirrorBlock value={JSON.stringify(selectedSpan.output, null, 2)} />
                    </div>
                  )}
                </div>
              </section>

              <section className="border border-border1 rounded-lg">
                <div className="border-b border-border1 last:border-b-0 grid">
                  <h3 className="p-[1rem] px-[1.5rem] border-b border-border1">Metadata</h3>
                  {selectedSpan?.metadata && (
                    <div className={cn('overflow-auto text-icon4 text-[0.875rem] [&>div]:border-none break-all')}>
                      <CodeMirrorBlock value={JSON.stringify(selectedSpan.metadata, null, 2)} />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        </div>
      </SideDialog>
    </>
  );
}
