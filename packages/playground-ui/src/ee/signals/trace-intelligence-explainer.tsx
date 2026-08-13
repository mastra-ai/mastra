import { Info } from 'lucide-react';
import { getSignalHue } from './signal-colors';
import { SIGNAL_DESCRIPTIONS, SIGNAL_PROCESSING_ORDER } from './signal-formatting';
import { nodeColor } from '@/ds/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

/** Info tooltip for first-time viewers: signals → themes → snapshots. */
export function TraceIntelligenceExplainer() {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="What is trace intelligence?"
        className="text-neutral3 hover:text-neutral6 flex cursor-help items-center transition-colors"
        type="button"
      >
        <Icon size="sm">
          <Info />
        </Icon>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm space-y-3 p-4 text-xs">
        <p className="text-neutral5">
          Every trace from this agent is analyzed for four signals, and traces with similar signals are clustered into
          named themes.
        </p>
        <ul className="space-y-1.5">
          {SIGNAL_PROCESSING_ORDER.map(signalName => (
            <li key={signalName} className="text-neutral4">
              <span
                className="font-mono text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: nodeColor(getSignalHue(signalName)) }}
              >
                {signalName}
              </span>{' '}
              — {SIGNAL_DESCRIPTIONS[signalName]}
            </li>
          ))}
        </ul>
        <p className="text-neutral4">
          Snapshots capture the themes at points in time, so the views show how they appear, grow, and fade.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
