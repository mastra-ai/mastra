import { Span, RefinedTrace } from '@mastra/playground-ui';

export const refineTraces = (traces: Span[], isWorkflow: boolean = false): RefinedTrace[] => {
  const listOfSpanIds = new Set<string>();

  const newName = (name: string) => {
    if (name?.startsWith('workflow.') && isWorkflow) {
      return name?.split('.')?.slice(2)?.join('.');
    }
    if (name?.startsWith('agent.') && !isWorkflow) {
      return name?.split('.')?.slice(1)?.join('.');
    }
    return name;
  };

  const groupedTraces = traces?.reduce<Record<string, Span[]>>((acc, curr) => {
    const newCurr = { ...curr, name: newName(curr.name), duration: curr.endTime - curr.startTime };

    listOfSpanIds.add(curr.id);

    return { ...acc, [curr.traceId]: [...(acc[curr.traceId] || []), newCurr] };
  }, {});

  const tracesData = Object.entries(groupedTraces).map(([key, value]) => {
    const parentSpan = value.find(span => !span.parentSpanId || !listOfSpanIds.has(span.parentSpanId));

    const enrichedSpans = value.map(span => ({
      ...span,
      parentSpanId: parentSpan?.id === span.id ? null : span?.parentSpanId,
    }));

    const failedStatus = value.find(span => span.status.code === 2)?.status;

    const runId = value?.[0]?.attributes?.runId;

    return {
      traceId: key,
      serviceName: parentSpan?.name || key,
      duration: parentSpan?.duration || value.reduce((acc, curr) => acc + curr.duration, 0),
      status: failedStatus || parentSpan?.status || value[0].status,
      started: value[0].startTime,
      trace: enrichedSpans,
      runId: runId ? String(runId) : undefined,
    };
  });

  return tracesData;
};
