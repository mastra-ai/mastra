import type { LightSpanRecord } from '@mastra/core/storage';
import { TraceInvestigate } from './trace-investigate';

export type TracesInvestigationProps = {
  threadId: string;
  traces: LightSpanRecord[];
};

export function TracesInvestigation({ threadId, traces }: TracesInvestigationProps) {
  return (
    <div data-testid="traces-investigation" className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <span className="text-neutral2 text-ui-smd">Thread ID</span>
        <span className="text-neutral6 text-ui-lg">{threadId}</span>
      </div>

      {traces.map(trace => (
        <section key={trace.traceId}>
          <TraceInvestigate traceId={trace.traceId} />
        </section>
      ))}
    </div>
  );
}
