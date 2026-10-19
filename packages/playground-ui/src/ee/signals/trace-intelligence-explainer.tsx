import type { SignalCatalogEntry } from '@mastra/client-js';
import { getSignalColor } from './signal-colors';
import { orderedSignals, signalDescription, signalLabel } from './signal-formatting';
import { InfoTooltip } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';

/** Info tooltip for first-time viewers: signals → themes → snapshots. */
export function TraceIntelligenceExplainer({ signalCatalog }: { signalCatalog: readonly SignalCatalogEntry[] }) {
  const enabledSignals = orderedSignals(
    signalCatalog,
    signalCatalog.filter(signal => signal.enabled).map(signal => signal.name),
  );
  return (
    <InfoTooltip aria-label="What is trace intelligence?" contentClassName="max-w-sm space-y-3 p-4">
      <p className="text-foreground">
        Every trace is analyzed for {enabledSignals.length === 4 ? 'four' : enabledSignals.length}{' '}
        {enabledSignals.length === 1 ? 'signal' : 'signals'}, and traces with similar signals are clustered into named
        themes.
      </p>
      <ul className="space-y-1.5">
        {enabledSignals.map(signalName => (
          <li key={signalName} className="text-muted-foreground">
            <Txt
              as="span"
              variant="meta"

              className="uppercase"
              style={{ color: getSignalColor(signalName) }}
            >
              {signalLabel(signalCatalog, signalName)}
            </Txt>{' '}
            — {signalDescription(signalCatalog, signalName)}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        Snapshots capture the themes at points in time, so the views show how they appear, grow, and fade.
      </p>
    </InfoTooltip>
  );
}
