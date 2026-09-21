import type { SignalCatalogEntry } from '@mastra/client-js';
import { Info } from 'lucide-react';
import { getSignalHue } from './signal-colors';
import { orderedSignals, signalDescription, signalLabel } from './signal-formatting';
import { nodeColor } from '@/ds/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

/** Info tooltip for first-time viewers: signals → themes → snapshots. */
export function TraceIntelligenceExplainer({ signalCatalog }: { signalCatalog: readonly SignalCatalogEntry[] }) {
  const enabledSignals = orderedSignals(
    signalCatalog,
    signalCatalog.filter(signal => signal.enabled).map(signal => signal.name),
  );
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="What is trace intelligence?"
        className={cn(quietTextHover, controlStateColorTransition, 'flex cursor-help items-center')}
        type="button"
      >
        <Icon size="sm">
          <Info />
        </Icon>
      </TooltipTrigger>
      <TooltipContent className="text-caption max-w-sm space-y-3 p-4">
        <p className="text-foreground">
          Every trace is analyzed for {enabledSignals.length === 4 ? 'four' : enabledSignals.length}{' '}
          {enabledSignals.length === 1 ? 'signal' : 'signals'}, and traces with similar signals are clustered into named
          themes.
        </p>
        <ul className="space-y-1.5">
          {enabledSignals.map(signalName => (
            <li key={signalName} className="text-muted-foreground">
              <span
                className="text-meta font-mono tracking-widest uppercase"
                style={{ color: nodeColor(getSignalHue(signalName)) }}
              >
                {signalLabel(signalCatalog, signalName)}
              </span>{' '}
              — {signalDescription(signalCatalog, signalName)}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Snapshots capture the themes at points in time, so the views show how they appear, grow, and fade.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
