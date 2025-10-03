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
import { AISpanRecord } from '@mastra/core';
import { useLinkComponent } from '@/lib/framework';
import { Tabs } from '@/components/ui/elements/tabs/tabs';
import { Sections } from '@/components/ui/containers';
import { TraceScoreList } from './trace-score-list';
import { SpanScoring } from './span-scoring';
import { TraceSpanUsage } from './trace-span-usage';

type SpanDialogProps = {
  trace: AISpanRecord;
  span?: AISpanRecord;
  spanInfo?: KeyValueListItemData[];
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onViewToggle?: () => void;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
  defaultActiveTab?: string;
  initialScoreId?: string;
};

export function SpanDialog({
  trace,
  span,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onViewToggle,
  spanInfo = [],
  onScorerTriggered,
  defaultActiveTab = 'details',
  initialScoreId,
}: SpanDialogProps) {
  const { Link } = useLinkComponent();

  let entityType;
  if (trace?.attributes?.agentId) {
    entityType = 'Agent';
  } else if (trace?.attributes?.workflowId) {
    entityType = 'Workflow';
  }

  console.log({ span });

  return (
    <SideDialog
      dialogTitle="Observability Span"
      dialogDescription="View and analyze span details"
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
        <TextAndIcon>
          <EyeIcon /> {getShortId(span?.traceId)}
        </TextAndIcon>
        ›
        <TextAndIcon>
          <ChevronsLeftRightEllipsisIcon />
          {getShortId(span?.spanId)}
        </TextAndIcon>
        <button className="flex items-center gap-1" onClick={onViewToggle}>
          <PanelTopIcon />
        </button>
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header className="flex gap-[1rem] items-baseline pr-[2.5rem]">
          <SideDialog.Heading>
            <ChevronsLeftRightEllipsisIcon /> {span?.name}
          </SideDialog.Heading>
          <TextAndIcon>
            <HashIcon /> {span?.spanId}
          </TextAndIcon>
        </SideDialog.Header>

        <Tabs defaultTab={defaultActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="scores">Scoring</Tabs.Tab>
          </Tabs.List>
          <Tabs.Content value="details">
            <Sections>
              {span?.attributes?.usage && <TraceSpanUsage spanUsage={span.attributes.usage} />}
              <KeyValueList data={spanInfo} LinkComponent={Link} />
              <SpanDetails span={span} onScorerTriggered={onScorerTriggered} />
            </Sections>
          </Tabs.Content>
          <Tabs.Content value="scores">
            <Sections>
              <Section>
                <Section.Header>
                  <Section.Heading>
                    <CircleGaugeIcon /> Scoring{' '}
                  </Section.Heading>
                </Section.Header>

                <SpanScoring
                  traceId={trace.traceId}
                  spanId={span?.spanId}
                  onScorerTriggered={onScorerTriggered}
                  entityType={entityType}
                />
              </Section>

              <Section>
                <Section.Header>
                  <Section.Heading>
                    <GaugeIcon /> Scores
                  </Section.Heading>
                </Section.Header>
                <TraceScoreList
                  scores={span?.links}
                  initialScoreId={initialScoreId}
                  traceId={trace.traceId}
                  spanId={span?.spanId}
                />
              </Section>
            </Sections>
          </Tabs.Content>
        </Tabs>
      </SideDialog.Content>
    </SideDialog>
  );
}
