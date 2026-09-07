import { useTraceInsight } from './hooks';
import { signalLabel } from './signal-formatting';
import type { TraceInsightResponse } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { Button } from '@/ds/components/Button';

interface TraceInsightViewProps {
  traceId: string;
  onBack: () => void;
}

export function TraceInsightView({ traceId, onBack }: TraceInsightViewProps) {
  const { LinkComponent, getTraceHref } = useTraceIntelligence();
  const insightQuery = useTraceInsight(traceId);

  return (
    <div className="grid content-start gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to examples
        </Button>
        <Button as={LinkComponent} href={getTraceHref(traceId)} variant="outline" size="sm">
          Open full trace
        </Button>
      </div>
      {insightQuery.isPending && <p className="text-neutral3 text-sm">Loading trace insight…</p>}
      {insightQuery.isError && <p className="text-sm text-red-500">Unable to load the trace insight.</p>}
      {insightQuery.data && <TraceInsightBody insight={insightQuery.data} />}
    </div>
  );
}

type ObservationSeverity = 'info' | 'success' | 'problem';

interface ParsedObservation {
  severity?: ObservationSeverity;
  kind?: string;
  text: string;
}

function isObservationSeverity(value: string): value is ObservationSeverity {
  return value === 'info' || value === 'success' || value === 'problem';
}

/**
 * Trace summaries prefix each observation with a machine-readable
 * `severity=… | kind=… |` header (see the trace-summary prompt). Strip it for
 * display and keep the parts so the UI can render them as visual cues, the
 * same way the observational-memory views parse their emoji markers out of
 * the raw text.
 */
function parseTraceObservation(observation: string): ParsedObservation {
  const match = observation.match(/^severity=(\w+)\s*\|\s*kind=(\w+)\s*\|\s*/);
  if (!match) return { text: observation };
  const [prefix, severity, kind] = match;
  return {
    severity: severity !== undefined && isObservationSeverity(severity) ? severity : undefined,
    kind,
    text: observation.slice(prefix.length),
  };
}

const OBSERVATION_SEVERITY_CARD: Record<ObservationSeverity, string> = {
  info: 'border-border1 bg-surface3',
  success: 'border-green-400/30 bg-green-500/10',
  problem: 'border-red-400/30 bg-red-500/10',
};

function ObservationItem({ observation }: { observation: string }) {
  const { severity, kind, text } = parseTraceObservation(observation);

  return (
    <li className={`rounded-md border p-3 text-sm ${OBSERVATION_SEVERITY_CARD[severity ?? 'info']}`}>
      {kind !== undefined && (
        <p className="text-neutral3 font-mono text-[10px] tracking-wider uppercase">
          {severity === 'problem' && (
            <>
              <span className="text-red-400">problem</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <span>{kind}</span>
        </p>
      )}
      <p className={`text-neutral5 ${kind === undefined ? '' : 'mt-1'}`}>{text}</p>
    </li>
  );
}

function TraceInsightBody({ insight }: { insight: TraceInsightResponse }) {
  const { signalCatalog } = useTraceIntelligence();
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
              <h3
                id="trace-insight-observations-heading"
                className="text-neutral3 mt-4 font-mono text-xs tracking-wider uppercase"
              >
                Observations
              </h3>
              <ul aria-labelledby="trace-insight-observations-heading" className="mt-3 space-y-2">
                {insight.summary.observations.map((observation, index) => (
                  <ObservationItem key={`${observation}:${index}`} observation={observation} />
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
                <p className="text-neutral3">{signalLabel(signalCatalog, signal.signalName)}</p>
                <p className="text-neutral5 mt-1">{signal.signalText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
