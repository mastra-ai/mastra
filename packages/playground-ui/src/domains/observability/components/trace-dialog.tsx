import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogTop,
  SideDialogCodeSection,
  KeyValueList,
  TextAndIcon,
  getShortId,
  SideDialogHeader,
  SideDialogHeading,
} from '@/components/ui/elements';
import { type UISpan } from '../types';
import { PanelLeftIcon, PanelTopIcon, HashIcon, EyeIcon } from 'lucide-react';
import { useState } from 'react';
import { TraceTimeline } from './trace-timeline';
import { TraceSpanUsage } from './trace-span-usage';
import { useLinkComponent } from '@/lib/framework';
import { AISpanRecord } from '@mastra/core';
import { getTraceInfo, getSpanInfo } from './helpers';
import { SpanDialog } from './span-dialog';

type TraceDialogProps = {
  traceSpans?: any[];
  traceId?: string;
  traceDetails?: AISpanRecord;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isLoadingSpans?: boolean;
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
}: TraceDialogProps) {
  const { Link } = useLinkComponent();
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(undefined);
  const [combinedView, setCombinedView] = useState<boolean>(false);
  const selectedSpan = traceSpans.find(span => span.spanId === selectedSpanId) ?? traceSpans[0];

  const handleSpanClick = (span: UISpan) => {
    setSelectedSpanId(span.id);
    setDialogIsOpen(true);
  };

  const toNextSpan = () => {
    const currentIndex = traceSpans.findIndex(span => span.spanId === selectedSpanId);
    const nextSpan = traceSpans[currentIndex + 1];

    if (nextSpan) {
      setSelectedSpanId(nextSpan.spanId);
    }
  };

  const toPreviousSpan = () => {
    const currentIndex = traceSpans.findIndex(span => span.spanId === selectedSpanId);
    const prevSpan = traceSpans[currentIndex - 1];

    if (prevSpan) {
      setSelectedSpanId(prevSpan.spanId);
    }
  };

  const traceInfo = getTraceInfo(traceDetails);
  const selectedSpanInfo = getSpanInfo(selectedSpan);

  return (
    <>
      <SideDialog
        dialogTitle="Observability Trace"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!dialogIsOpen}
        className={cn('w-[calc(100vw-20rem)] max-w-[75%]', '3xl:max-w-[60rem]', '4xl:max-w-[60%]')}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <TextAndIcon>
            <EyeIcon /> {getShortId(traceId)}
          </TextAndIcon>
        </SideDialogTop>

        <div
          className={cn('p-[1.5rem] pl-[2.5rem] pr-0 overflow-y-auto grid grid-rows-[auto_1fr_1fr]', {
            'grid-rows-[auto_1fr]': !combinedView,
          })}
        >
          <SideDialogHeader className="flex  gap-[1rem] items-baseline pr-[3.5rem]">
            <SideDialogHeading>
              <EyeIcon /> {traceDetails?.name}
            </SideDialogHeading>

            <TextAndIcon>
              <HashIcon /> {traceId}
            </TextAndIcon>
          </SideDialogHeader>

          <div className="overflow-y-auto pr-[1rem]">
            {traceDetails?.metadata?.usage && (
              <TraceSpanUsage
                traceUsage={traceDetails?.metadata?.usage}
                traceSpans={traceSpans}
                className="mt-[3rem]"
              />
            )}
            <KeyValueList data={traceInfo} LinkComponent={Link} className="mt-[3rem]" />
            <TraceTimeline
              spans={traceSpans}
              onSpanClick={handleSpanClick}
              selectedSpanId={selectedSpanId}
              isLoading={isLoadingSpans}
            />
          </div>

          {combinedView && (
            <div className="overflow-y-auto border-t-2 border-gray-500 grid grid-rows-[auto_1fr]">
              <div className="flex items-center justify-between py-[.5rem] border-b border-border1 pr-[1rem]">
                <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
                  <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{selectedSpanId}</div>
                </SideDialogTop>
                <div className="flex items-center gap-[1rem]">
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

      <SpanDialog
        span={selectedSpan}
        isOpen={Boolean(dialogIsOpen && selectedSpanId && !combinedView)}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNextSpan}
        onPrevious={toPreviousSpan}
        onViewToggle={() => setCombinedView(!combinedView)}
        spanInfo={selectedSpanInfo}
      />
    </>
  );
}

function SpanDetails({ span }: { span: any }) {
  return (
    <div className="grid gap-[1.5rem] mb-[2rem]">
      <SideDialogCodeSection title="Input" codeStr={JSON.stringify(span.input || null, null, 2)} />
      <SideDialogCodeSection title="Output" codeStr={JSON.stringify(span.output || null, null, 2)} />
      <SideDialogCodeSection title="Metadata" codeStr={JSON.stringify(span.metadata || null, null, 2)} />
      <SideDialogCodeSection title="Attributes" codeStr={JSON.stringify(span.attributes || null, null, 2)} />
    </div>
  );
}
