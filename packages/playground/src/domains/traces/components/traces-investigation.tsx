import type { LightSpanRecord } from '@mastra/core/storage';
import { TraceInvestigate } from './trace-investigate';

export type TracesInvestigationProps = {
  threadId: string;
  traces: LightSpanRecord[];
};

export function TracesInvestigation({ threadId, traces }: TracesInvestigationProps) {
  return (
    <div data-testid="traces-investigation" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-icon3 text-ui-sm">Thread ID</span>
        <span className="text-icon6 text-ui-md">{threadId}</span>
      </div>

      {traces.map(trace => (
        <TraceInvestigate key={trace.traceId} traceId={trace.traceId} />
      ))}
    </div>
  );
}
