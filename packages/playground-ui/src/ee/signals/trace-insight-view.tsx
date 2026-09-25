import { ChevronLeft } from 'lucide-react';
import { useTraceInsight } from './hooks';
import { signalLabel } from './signal-formatting';
import type { TraceInsightResponse } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

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
        <Button icon={<ChevronLeft />} size="sm" onClick={onBack}>
          Back to examples
        </Button>
        <Button icon={<TraceIcon />} render={<LinkComponent href={getTraceHref(traceId)} />} size="sm">
          Open full trace
        </Button>
      </div>
      {insightQuery.isPending && (
        <Txt variant="body" tone="muted">
          Loading trace insight…
        </Txt>
      )}
      {insightQuery.isError && (
        <Txt variant="body" className="text-error">
          Unable to load the trace insight.
        </Txt>
      )}
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
  info: raisedSurfaceStyle,
  success: 'border border-green-400/30 bg-green-500/10',
  problem: 'border border-red-400/30 bg-red-500/10',
};

function ObservationItem({ observation }: { observation: string }) {
  const { severity, kind, text } = parseTraceObservation(observation);

  return (
    <li className={`rounded-md p-3 text-body ${OBSERVATION_SEVERITY_CARD[severity ?? 'info']}`}>
      {kind !== undefined && (
        <Txt variant="meta" tone="muted" className="uppercase">
          {severity === 'problem' && (
            <>
              <span className="text-error">problem</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <span>{kind}</span>
        </Txt>
      )}
      <p className={`text-foreground ${kind === undefined ? '' : 'mt-1'}`}>{text}</p>
    </li>
  );
}

function TraceInsightBody({ insight }: { insight: TraceInsightResponse }) {
  const { signalCatalog } = useTraceIntelligence();
  return (
    <>
      {insight.summary === undefined ? (
        <Txt variant="body" tone="muted">
          No insight available yet for this trace.
        </Txt>
      ) : (
        <section aria-labelledby="trace-insight-summary-heading">
          <Txt id="trace-insight-summary-heading" as="h2" variant="column" tone="muted" className="uppercase">
            Trace summary
          </Txt>
          <Txt variant="body" tone="ink" className="mt-3">
            {insight.summary.summary}
          </Txt>
          {insight.summary.currentTask !== undefined && (
            <dl className="mt-4 text-body">
              <dt className="text-muted-foreground">Current task</dt>
              <dd className="mt-1 text-foreground">{insight.summary.currentTask}</dd>
            </dl>
          )}
          {insight.summary.degenerate === true && (
            <Txt variant="body" className="mt-4 text-error">
              This trace was flagged as degenerate or looping.
            </Txt>
          )}
          {insight.summary.observations.length > 0 && (
            <>
              <Txt
                id="trace-insight-observations-heading"
                as="h3"
                variant="column"
                tone="muted"
                className="mt-4 uppercase"
              >
                Observations
              </Txt>
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
          <Txt id="trace-insight-signals-heading" as="h2" variant="column" tone="muted" className="uppercase">
            Trace signal summaries
          </Txt>
          <ul className="mt-3 space-y-3">
            {insight.signals.map(signal => (
              <li key={signal.signalName} className={cn(raisedSurfaceStyle, 'rounded-md p-3 text-body')}>
                <p className="text-muted-foreground">{signalLabel(signalCatalog, signal.signalName)}</p>
                <p className="mt-1 text-foreground">{signal.signalText}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
