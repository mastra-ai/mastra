import type { LightSpanRecord } from '@mastra/core/storage';
import { TraceInvestigate } from './trace-investigate';

export type TracesInvestigationProps = {
  threadId: string;
  traces: LightSpanRecord[];
};

export function TracesInvestigation({ threadId, traces }: TracesInvestigationProps) {
  return (
    <div data-testid="traces-investigation" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-neutral2 text-ui-sm">Thread ID</span>
        <span className="text-neutral6 text-ui-md">{threadId}</span>
      </div>

      {traces.map(trace => (
        <section key={trace.traceId} className="border-border1 border-t pt-6">
          <TraceInvestigate traceId={trace.traceId} />
        </section>
      ))}
    </div>
  );
}
