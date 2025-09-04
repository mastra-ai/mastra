import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogTop,
  KeyValueList,
  type KeyValueListItemData,
  TextAndIcon,
  SideDialogHeader,
  SideDialogHeading,
  getShortId,
} from '@/components/ui/elements';
import { PanelLeftIcon, PanelTopIcon, ChevronsLeftRightEllipsisIcon, HashIcon, EyeIcon, Link } from 'lucide-react';
import { TraceSpanUsage } from './trace-span-usage';
import { SpanDetails } from './span-details';

type SpanDialogProps = {
  span?: any;
  spanInfo?: KeyValueListItemData[];
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onViewToggle?: () => void;
};

export function SpanDialog({
  span,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onViewToggle,
  spanInfo = [],
}: SpanDialogProps) {
  return (
    <SideDialog
      dialogTitle="Observability Span"
      dialogDescription="View and analyze span details"
      isOpen={isOpen}
      onClose={onClose}
      hasCloseButton={true}
      className={cn('w-[calc(100vw-20rem)] max-w-[60%]', '3xl:max-w-[50rem]', '4xl:max-w-[40%]')}
    >
      <div className="flex items-center justify-between pr-[1.5rem]">
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
            <TextAndIcon>
              <EyeIcon /> {getShortId(span?.traceId)}
            </TextAndIcon>
            ›
            <TextAndIcon>
              <ChevronsLeftRightEllipsisIcon />
              {getShortId(span?.spanId)}
            </TextAndIcon>
          </div>
        </SideDialogTop>
        <button className="flex items-center gap-1" onClick={onViewToggle}>
          <PanelTopIcon />
        </button>
      </div>

      <div className="p-[1.5rem] px-[2.5rem] overflow-y-auto grid gap-[1.5rem]">
        <SideDialogHeader className="flex  gap-[1rem] items-baseline pr-[2.5rem]">
          <SideDialogHeading>
            <ChevronsLeftRightEllipsisIcon /> {span?.name}
          </SideDialogHeading>
          <TextAndIcon>
            <HashIcon /> {span?.spanId}
          </TextAndIcon>
        </SideDialogHeader>

        {span?.attributes?.usage && <TraceSpanUsage spanUsage={span.attributes.usage} className="mt-[1.5rem]" />}
        <KeyValueList data={spanInfo} LinkComponent={Link} className="mt-[1.5rem]" />
        <SpanDetails span={span} />
      </div>
    </SideDialog>
  );
}
