import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogTop,
  KeyValueList,
  TextAndIcon,
  getShortId,
  SideDialogHeader,
  SideDialogHeading,
} from '@/components/ui/elements';
import { PanelLeftIcon, HashIcon, EyeIcon, ChevronsLeftRightEllipsisIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TraceTimeline } from './trace-timeline';
import { TraceSpanUsage } from './trace-span-usage';
import { useLinkComponent } from '@/lib/framework';
import { AISpanRecord } from '@mastra/core';
import { getTraceInfo, getSpanInfo } from './helpers';
import { SpanDialog } from './span-dialog';
import { SpanDetails } from './span-details';
import { formatHierarchicalSpans } from '../utils/format-hierarchical-spans';
import { UISpan } from '../types';

type TraceDialogProps = {
  traceSpans?: AISpanRecord[];
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
  const selectedSpan = traceSpans.find(span => span.spanId === selectedSpanId);

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
    setDialogIsOpen(true);
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

  const traceInfo = getTraceInfo(traceDetails);
  const selectedSpanInfo = getSpanInfo({ span: selectedSpan, withTraceId: !combinedView, withSpanId: combinedView });

  return (
    <>
      <SideDialog
        dialogTitle="Observability Trace"
        dialogDescription="View and analyze trace details"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!dialogIsOpen || combinedView}
        className={cn('w-[calc(100vw-20rem)] max-w-[80%]', '3xl:max-w-[65%]', '4xl:max-w-[55%]')}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <TextAndIcon>
            <EyeIcon /> {getShortId(traceId)}
          </TextAndIcon>
        </SideDialogTop>

        <div
          className={cn('pt-[1.5rem] pl-[2.5rem] grid-rows-[auto_1fr] grid h-full overflow-y-auto', {
            'grid-rows-[auto_1fr_1fr]': selectedSpan && combinedView,
          })}
        >
          <SideDialogHeader className="flex gap-[1rem] items-baseline pr-[2.5rem]">
            <SideDialogHeading>
              <EyeIcon /> {traceDetails?.name}
            </SideDialogHeading>

            <TextAndIcon>
              <HashIcon /> {traceId}
            </TextAndIcon>
          </SideDialogHeader>

          <div className={cn('overflow-y-auto pb-[2.5rem]')}>
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
          </div>

          {selectedSpan && combinedView && (
            <div className="overflow-y-auto grid grid-rows-[auto_1fr] relative">
              <div className="absolute left-0 right-[2.5rem] h-[.5rem] bg-surface1 rounded-full top-0"></div>
              <div className="flex items-center justify-between pb-[.5rem] pt-[1rem] border-b border-border1 pr-[2.5rem]">
                <SideDialogTop
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
                </SideDialogTop>
                <div className="flex items-center gap-[1rem]">
                  <button className="flex items-center gap-1" onClick={() => setCombinedView(false)}>
                    <PanelLeftIcon />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[20rem_1fr] gap-[1rem] overflow-y-auto">
                <div className="overflow-y-auto grid content-start p-[1.5rem] pl-0 gap-[2rem]">
                  <SideDialogHeading as="h2">
                    <ChevronsLeftRightEllipsisIcon /> {selectedSpan?.name}
                  </SideDialogHeading>
                  {selectedSpan?.attributes?.usage && (
                    <TraceSpanUsage
                      spanUsage={selectedSpan.attributes.usage}
                      className="xl:grid-cols-1 xl:gap-[1rem]"
                    />
                  )}
                  <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
                </div>
                <div className="overflow-y-auto pr-[2.5rem] pt-[2rem]">
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
        onNext={thereIsNextSpan() ? toNextSpan : undefined}
        onPrevious={thereIsPreviousSpan() ? toPreviousSpan : undefined}
        onViewToggle={() => setCombinedView(!combinedView)}
        spanInfo={selectedSpanInfo}
      />
    </>
  );
}
