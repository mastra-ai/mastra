import {
  SideDialog,
  KeyValueList,
  type KeyValueListItemData,
  TextAndIcon,
  getShortId,
  Section,
} from '@/components/ui/elements';
import {
  PanelTopIcon,
  ChevronsLeftRightEllipsisIcon,
  HashIcon,
  EyeIcon,
  CircleGaugeIcon,
  GaugeIcon,
} from 'lucide-react';
import { SpanDetails } from './span-details';
import { SpanRecord } from '@mastra/core/storage';
import { useLinkComponent } from '@/lib/framework';
import { Tabs } from '@/components/ui/elements/tabs/tabs';
import { Sections } from '@/components/ui/containers';
import { SpanScoreList } from './span-score-list';
import { SpanScoring } from './span-scoring';
import { TraceSpanUsage } from './trace-span-usage';
import { ListScoresResponse } from '@mastra/client-js';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SpanTabs } from './span-tabs';

type SpanDialogProps = {
  trace: SpanRecord;
  span?: SpanRecord;
  spanScoresData?: ListScoresResponse | null;
  onSpanScoresPageChange?: (page: number) => void;
  isLoadingSpanScoresData?: boolean;
  spanInfo?: KeyValueListItemData[];
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onViewToggle?: () => void;
  defaultActiveTab?: string;
  initialScoreId?: string;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

export function SpanDialog({
  trace,
  span,
  spanScoresData,
  onSpanScoresPageChange,
  isLoadingSpanScoresData,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onViewToggle,
  spanInfo = [],
  defaultActiveTab = 'details',
  initialScoreId,
  computeTraceLink,
}: SpanDialogProps) {
  return (
    <SideDialog
      dialogTitle="Observability Span"
      dialogDescription="View and analyze span details"
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <EyeIcon /> {getShortId(span?.traceId)}
        </TextAndIcon>
        ›
        <TextAndIcon>
          <ChevronsLeftRightEllipsisIcon />
          {getShortId(span?.spanId)}
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
        <button className="ml-auto mr-[2rem]" onClick={onViewToggle}>
          <PanelTopIcon />
          <VisuallyHidden>Switch to dialog view</VisuallyHidden>
        </button>
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <ChevronsLeftRightEllipsisIcon /> {span?.name}
          </SideDialog.Heading>
          <TextAndIcon>
            <HashIcon /> {span?.spanId}
          </TextAndIcon>
        </SideDialog.Header>
        <SpanTabs
          trace={trace}
          span={span}
          spanScoresData={spanScoresData}
          onSpanScoresPageChange={onSpanScoresPageChange}
          isLoadingSpanScoresData={isLoadingSpanScoresData}
          spanInfo={spanInfo}
          defaultActiveTab={defaultActiveTab}
          initialScoreId={initialScoreId}
          computeTraceLink={computeTraceLink}
        />
      </SideDialog.Content>
    </SideDialog>
  );
}
