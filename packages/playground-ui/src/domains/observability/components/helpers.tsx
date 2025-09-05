import { format } from 'date-fns';
import { AISpanRecord } from '@mastra/core';

export function getTraceInfo(trace: AISpanRecord | undefined) {
  if (!trace) {
    return [];
  }

  return [
    {
      key: 'entityId',
      label: 'Entity Id',
      value: [
        {
          id: trace?.metadata?.resourceId,
          name: trace?.attributes?.agentId || trace?.attributes?.workflowId || '-',
          path: trace?.attributes?.agentId
            ? `/agents/${trace?.metadata?.resourceId}`
            : trace?.attributes?.workflowId
              ? `/workflows/${trace?.metadata?.resourceId}`
              : undefined,
        },
      ],
    },
    {
      key: 'entityType',
      label: 'Entity Type',
      value: [
        {
          id: trace?.attributes?.agentId || trace?.attributes?.workflowId,
          name: trace?.attributes?.agentId ? 'Agent' : trace?.attributes?.workflowId ? 'Workflow' : '-',
          path: trace?.attributes?.agentId ? `/agents` : trace?.attributes?.workflowId ? `/workflows` : undefined,
        },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: trace?.attributes?.status || '-',
    },
    {
      key: 'createdAt',
      label: 'Created at',
      value: trace?.createdAt ? format(new Date(trace?.createdAt), 'PPpp') : '-',
    },
  ];
}

type getSpanInfoProps = {
  span: AISpanRecord | undefined;
  withTraceId?: boolean;
  withSpanId?: boolean;
};

export function getSpanInfo({ span, withTraceId = true, withSpanId = true }: getSpanInfoProps) {
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
      key: 'createdAt',
      label: 'Created at',
      value: span?.createdAt ? format(new Date(span?.createdAt), 'MMM dd, HH:mm:ss.SSS') : '-',
    },
    {
      key: 'startedAt',
      label: 'Started At',
      value: span?.startedAt ? format(new Date(span.startedAt), 'MMM dd, HH:mm:ss.SSS') : '-',
    },
    {
      key: 'endedAt',
      label: 'Ended At',
      value: span?.endedAt ? format(new Date(span.endedAt), 'MMM dd, HH:mm:ss.SSS') : '-',
    },
  ];

  // Conditionally add trace ID at the beginning
  if (withTraceId) {
    baseInfo.unshift({
      key: 'traceId',
      label: 'Trace Id',
      value: span?.traceId,
    });
  }

  if (withSpanId) {
    baseInfo.unshift({
      key: 'spanId',
      label: 'Span Id',
      value: span?.spanId,
    });
  }

  return baseInfo;
}
