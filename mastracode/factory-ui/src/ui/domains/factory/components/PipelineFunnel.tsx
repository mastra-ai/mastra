import { Txt } from '@mastra/playground-ui/components/Txt';

import type { FactoryMetrics } from '../services/metrics';
import { stageLabel } from '../stages';

type FunnelGate = FactoryMetrics['funnel']['gates'][number];

/** What the gate held on to, or `null` when everything moved on. */
function stoppedNote(gate: FunnelGate): string | null {
  const parts: string[] = [];
  if (gate.stalled > 0) parts.push(`${gate.stalled} still here`);
  if (gate.canceled > 0) parts.push(`${gate.canceled} abandoned`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Where the window's work stopped. A bar is the share of the cohort that got at
 * least that far, so the stack only ever narrows and the step between two bars
 * is exactly the line under the upper one.
 */
export function PipelineFunnel({ funnel }: { funnel: FactoryMetrics['funnel'] }) {
  const pulledIn = funnel.gates[0]?.reached ?? 0;
  if (pulledIn === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3 m-0">
        Nothing entered the pipeline in this window.
      </Txt>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {funnel.gates.map((gate, index) => {
        const note = stoppedNote(gate);
        const shipped = index === funnel.gates.length - 1;
        return (
          <li
            key={gate.stage}
            className="hover:bg-surface4 grid grid-cols-[6.5rem_1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors"
          >
            <Txt as="span" variant="ui-sm" className="text-icon4 truncate">
              {stageLabel(gate.stage)}
            </Txt>
            <div
              role="img"
              aria-label={`${stageLabel(gate.stage)}: ${gate.reached} of ${pulledIn}${note ? `, ${note}` : ''}`}
              className="bg-surface4 h-2 overflow-hidden rounded-full"
            >
              <div
                className={`h-full rounded-full ${shipped ? 'bg-positive1' : 'bg-chart-soft-1'}`}
                style={{ width: `${(gate.reached / pulledIn) * 100}%` }}
              />
            </div>
            <Txt as="span" variant="ui-xs" className="text-icon3 w-8 text-right tabular-nums">
              {gate.reached}
            </Txt>
            {note ? (
              <Txt as="span" variant="ui-xs" className="text-icon3 col-start-2">
                {note}
              </Txt>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
