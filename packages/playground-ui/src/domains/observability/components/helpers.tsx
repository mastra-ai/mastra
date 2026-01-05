import { format } from 'date-fns';
import { SpanRecord } from '@mastra/core/storage';
import { useLinkComponent } from '@/lib/framework';

export function useTraceInfo(trace: SpanRecord | undefined) {
  const { paths } = useLinkComponent();
  if (!trace) {
    return [];
  }

  const agentsLink = paths.agentsLink();
  const workflowsLink = paths.workflowsLink();

  // Use direct span fields for entity info
  const entityId = trace.entityId;
  const entityType = trace.entityType;
  const entityName = trace.entityName;

  const isAgent = entityType === 'agent';
  const isWorkflow = entityType === 'workflow_run';
  const entityLink =
    isAgent && entityId ? paths.agentLink(entityId) : isWorkflow && entityId ? paths.workflowLink(entityId) : undefined;

  return [
    {
      key: 'entityId',
      label: 'Entity Id',
      value: [
        {
          id: entityId ?? 'unknown',
          name: entityName || entityId || '-',
          path: entityLink,
        },
      ],
    },
    {
      key: 'entityType',
      label: 'Entity Type',
      value: [
        {
          id: entityType ?? 'unknown',
          name: entityType ?? '-',
          path: isAgent ? agentsLink : isWorkflow ? workflowsLink : undefined,
        },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: (trace?.attributes?.status as string) || '-',
    },
    {
      key: 'startedAt',
      label: 'Started at',
      value: trace?.startedAt ? format(new Date(trace?.startedAt), 'MMM dd, h:mm:ss.SSS aaa') : '-',
    },
    {
      key: 'endedAt',
      label: 'Ended at',
      value: trace?.endedAt ? format(new Date(trace?.endedAt), 'MMM dd, h:mm:ss.SSS aaa') : '-',
    },
  ];
}

type getSpanInfoProps = {
  span: SpanRecord | undefined;
};

export function getSpanInfo({ span }: getSpanInfoProps) {
  if (!span) {
    return [];
  }

  const baseInfo = [
    {
      key: 'spanType',
      label: 'Span Type',
      value: span?.spanType,
    },
    {
      key: 'startedAt',
      label: 'Started At',
      value: span?.startedAt ? format(new Date(span.startedAt), 'MMM dd, h:mm:ss.SSS aaa') : '-',
    },
    {
      key: 'endedAt',
      label: 'Ended At',
      value: span?.endedAt ? format(new Date(span.endedAt), 'MMM dd, h:mm:ss.SSS aaa') : '-',
    },
  ];

  // Add finish reason if available
  const finishReason = span?.attributes?.finishReason as string | undefined;
  if (finishReason) {
    baseInfo.push({
      key: 'finishReason',
      label: 'Finish Reason',
      value: finishReason,
    });
  }

  return baseInfo;
}
