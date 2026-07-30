import { Button } from '@mastra/playground-ui/components/Button';
import { Link } from 'react-router';

import { useTraceInsight } from './hooks';
import { formatSignalName } from './signal-formatting';
import type { TraceInsightResponse } from './types';

interface TraceInsightViewProps {
  traceId: string;
  onBack: () => void;
}

export function TraceInsightView({ traceId, onBack }: TraceInsightViewProps) {
  const insightQuery = useTraceInsight(traceId);

  return (
    <div className="grid content-start gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to examples
        </Button>
        <Button as={Link} to={`/traces/${encodeURIComponent(traceId)}`} variant="outline" size="sm">
          Open full trace
        </Button>
      </div>
      {insightQuery.isPending && <p className="text-neutral3 text-sm">Loading trace insight…</p>}
      {insightQuery.isError && <p className="text-sm text-red-500">Unable to load the trace insight.</p>}
      {insightQuery.data && <TraceInsightBody insight={insightQuery.data} />}
    </div>
  );
}

function TraceInsightBody({ insight }: { insight: TraceInsightResponse }) {
  return (
    <>
      {insight.summary === undefined ? (
        <p className="text-neutral3 text-sm">No insight available yet for this trace.</p>
      ) : (
        <section aria-labelledby="trace-insight-summary-heading">
          <h2 id="trace-insight-summary-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
            Trace summary
          </h2>
          <p className="text-neutral5 mt-3 text-sm">{insight.summary.summary}</p>
          {insight.summary.currentTask !== undefined && (
            <dl className="mt-4 text-sm">
              <dt className="text-neutral3">Current task</dt>
              <dd className="text-neutral5 mt-1">{insight.summary.currentTask}</dd>
            </dl>
          )}
          {insight.summary.degenerate === true && (
            <p className="mt-4 text-sm text-red-500">This trace was flagged as degenerate or looping.</p>
          )}
          {insight.summary.observations.length > 0 && (
            <>
              <h3 className="text-neutral3 mt-4 font-mono text-xs tracking-wider uppercase">Observations</h3>
              <ul className="mt-3 space-y-2">
                {insight.summary.observations.map((observation, index) => (
                  <li key={`${observation}:${index}`} className="border-border2 text-neutral5 border-l pl-3 text-sm">
                    {observation}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {insight.signals.length > 0 && (
        <section aria-labelledby="trace-insight-signals-heading">
          <h2 id="trace-insight-signals-heading" className="text-neutral3 font-mono text-xs tracking-wider uppercase">
            Trace signal summaries
          </h2>
          <ul className="mt-3 space-y-3">
            {insight.signals.map(signal => (
              <li key={signal.signalName} className="border-border1 bg-surface3 rounded-md border p-3 text-sm">
                <p className="text-neutral3">{formatSignalName(signal.signalName)}</p>
                <p className="text-neutral5 mt-1">{signal.signalText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
