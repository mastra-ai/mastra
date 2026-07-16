import { ArrowDownIcon, ArrowRightIcon, ChartNoAxesColumnIncreasingIcon, CpuIcon, Rows3Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../../ds/components/Badge';

const signalDimensions = ['Outcome', 'Goal', 'Behavior', 'Sentiment'];

interface SignalsEmptyStateProps {
  actionSlot?: ReactNode;
}

function FlowConnector() {
  return (
    <div className="flex shrink-0 items-center justify-center text-neutral2" aria-hidden="true">
      <ArrowDownIcon className="size-5 md:hidden" />
      <ArrowRightIcon className="hidden size-5 md:block" />
    </div>
  );
}

export function SignalsEmptyState({ actionSlot }: SignalsEmptyStateProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-10 text-center">
      <div className="max-w-2xl">
        <p className="font-mono text-xs text-neutral3 uppercase">Signals</p>
        <h1 className="text-ui-3xl mt-3 font-semibold text-neutral6">Understand what drives every agent interaction</h1>
        <p className="mt-3 text-ui-md text-neutral3">
          Mastra automatically aggregates agent traces into signal analysis, revealing recurring outcomes, goals,
          behaviors, and sentiment across interactions.
        </p>
      </div>

      <div
        className="mt-10 flex w-full flex-col items-stretch gap-3 md:flex-row md:items-center"
        aria-label="How signals work"
      >
        <div className="flex min-h-32 flex-1 flex-col items-center justify-center rounded-xl border border-border1 bg-surface2 p-5">
          <Rows3Icon className="size-5 text-neutral4" aria-hidden="true" />
          <h2 className="mt-3 text-ui-md font-medium text-neutral6">Traces</h2>
          <p className="mt-1 text-ui-sm text-neutral3">Agent interactions</p>
        </div>

        <FlowConnector />

        <div className="flex min-h-32 flex-1 flex-col items-center justify-center rounded-xl border border-border1 bg-surface3 p-5">
          <CpuIcon className="size-5 text-neutral4" aria-hidden="true" />
          <h2 className="mt-3 text-ui-md font-medium text-neutral6">Mastra Engine</h2>
          <p className="mt-1 text-ui-sm text-neutral3">Aggregates patterns</p>
        </div>

        <FlowConnector />

        <div className="flex min-h-32 flex-[1.5] flex-col items-center justify-center rounded-xl border border-border1 bg-surface2 p-5">
          <ChartNoAxesColumnIncreasingIcon className="size-5 text-neutral4" aria-hidden="true" />
          <h2 className="mt-3 text-ui-md font-medium text-neutral6">Signal analysis</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Signal dimensions">
            {signalDimensions.map(signal => (
              <Badge key={signal} size="sm">
                {signal}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-xl text-ui-sm text-neutral3">
        Once enough interactions have been processed, grouped trace relationships will appear here automatically.
      </p>

      {actionSlot ? <div className="mt-6">{actionSlot}</div> : null}
    </section>
  );
}
