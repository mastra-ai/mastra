import { format } from 'date-fns';
import { AISpanRecord } from '@mastra/core';

export function getTraceInfo(
  trace: AISpanRecord | undefined,
  computeAgentsLink?: () => string,
  computeWorkflowsLink?: () => string,
) {
  if (!trace) {
    return [];
  }

  const agentsLink = computeAgentsLink ? computeAgentsLink() : '/agents';
  const workflowsLink = computeWorkflowsLink ? computeWorkflowsLink() : '/workflows';

  const agentLink = computeAgentsLink
    ? `${agentsLink}/${trace?.metadata?.resourceId}`
    : `/agents/${trace?.metadata?.resourceId}`;

  const workflowLink = computeWorkflowsLink
    ? `${workflowsLink}/${trace?.metadata?.resourceId}`
    : `/workflows/${trace?.metadata?.resourceId}`;

  return [
    {
      key: 'entityId',
      label: 'Entity Id',
      value: [
        {
          id: trace?.metadata?.resourceId,
          name: trace?.attributes?.agentId || trace?.attributes?.workflowId || '-',
          path: trace?.attributes?.agentId ? agentLink : trace?.attributes?.workflowId ? workflowLink : undefined,
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
          path: trace?.attributes?.agentId ? agentsLink : trace?.attributes?.workflowId ? workflowsLink : undefined,
        },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: trace?.attributes?.status || '-',
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

  if (withSpanId) {
    baseInfo.unshift({
      key: 'spanId',
      label: '#',
      value: span?.spanId,
    });
  }

  return baseInfo;
}
