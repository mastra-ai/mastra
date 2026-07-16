import {
  ArrowDownIcon,
  ArrowRightIcon,
  ChartNoAxesColumnIncreasingIcon,
  CpuIcon,
  ExternalLinkIcon,
  Rows3Icon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import { buildSankeyHueMap, nodeColorVivid } from '@/ds/components/SankeyChart';

const signalNames = ['Outcome', 'Goal', 'Behavior', 'Sentiment'];
const signalHues = buildSankeyHueMap(signalNames);

export interface SignalsEmptyStateProps {
  actionSlot?: ReactNode;
}

function PipelineConnector({ delay }: { delay: string }) {
  return (
    <li aria-hidden="true" className="flex items-center justify-center text-neutral3">
      <div className="relative hidden h-px w-full overflow-hidden bg-border1 md:block">
        <span
          className="absolute inset-y-0 left-0 w-1/3 bg-accent1 motion-safe:animate-signals-connector motion-reduce:animate-none"
          style={{ animationDelay: delay }}
        />
      </div>
      <ArrowRightIcon className="ml-2 hidden size-4 shrink-0 md:block" />
      <ArrowDownIcon className="size-5 md:hidden" />
    </li>
  );
}

export function SignalsEmptyState({ actionSlot }: SignalsEmptyStateProps) {
  return (
    <section className="flex min-h-full w-full items-center justify-center p-4 sm:p-8" aria-labelledby="signals-title">
      <div className="w-full max-w-6xl overflow-hidden rounded-xl border border-border1 bg-surface2 shadow-card">
        <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <p className="text-ui-xs font-semibold tracking-widest text-accent1">SIGNALS</p>
          <h1 id="signals-title" className="mt-3 text-header-xl font-semibold text-neutral6">
            Understand what drives every agent interaction
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-ui-md text-neutral4">
            Mastra transforms incoming traces into structured signal analysis, revealing outcomes, goals, behaviors, and
            sentiment across your agents.
          </p>

          <ol
            className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)_3rem_minmax(0,1fr)] md:items-stretch md:gap-4"
            aria-label="Signals analysis pipeline"
          >
            <li className="rounded-lg border border-border1 bg-surface3 p-5 text-left">
              <div className="flex items-center gap-2 text-neutral6">
                <Rows3Icon className="size-4 text-accent1" />
                <h2 className="text-ui-md font-semibold">Traces</h2>
              </div>
              <p className="mt-2 text-ui-sm text-neutral4">Agent interactions arrive as connected execution spans.</p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                {[0, 0.35, 0.7].map((delay, index) => (
                  <div
                    key={delay}
                    className="flex items-center gap-2 rounded-md border border-border1 bg-surface2 px-3 py-2 motion-safe:animate-signals-trace-row motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <span className="size-1.5 rounded-full bg-accent1" />
                    <span
                      className={
                        index === 1 ? 'h-1.5 w-1/2 rounded-full bg-neutral3' : 'h-1.5 w-2/3 rounded-full bg-neutral3'
                      }
                    />
                  </div>
                ))}
              </div>
            </li>

            <PipelineConnector delay="0s" />

            <li className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-border1 bg-surface3 p-5 text-center">
              <div className="relative flex size-24 items-center justify-center" aria-hidden="true">
                <span className="absolute inset-0 rounded-full border border-dashed border-accent1 motion-safe:animate-signals-engine-ring motion-reduce:animate-none" />
                <span className="absolute inset-3 rounded-full border border-accent1/60 motion-safe:animate-signals-engine-pulse motion-reduce:animate-none" />
                <span className="flex size-12 items-center justify-center rounded-full bg-accent1Darker text-accent1">
                  <CpuIcon className="size-5" />
                </span>
              </div>
              <h2 className="mt-4 text-ui-md font-semibold text-neutral6">Mastra Engine</h2>
              <p className="mt-2 text-ui-sm text-neutral4">Aggregates and labels patterns across every trace.</p>
            </li>

            <PipelineConnector delay="1.2s" />

            <li className="rounded-lg border border-border1 bg-surface3 p-5 text-left">
              <div className="flex items-center gap-2 text-neutral6">
                <ChartNoAxesColumnIncreasingIcon className="size-4 text-accent1" />
                <h2 className="text-ui-md font-semibold">Signal analysis</h2>
              </div>
              <p className="mt-2 text-ui-sm text-neutral4">Four dimensions make agent performance understandable.</p>
              <ul className="mt-5 grid grid-cols-2 gap-2">
                {signalNames.map((signal, index) => (
                  <li
                    key={signal}
                    className="rounded-md border border-current bg-surface2 px-3 py-2 motion-safe:animate-signals-chip motion-reduce:animate-none"
                    style={{ color: nodeColorVivid(signalHues[signal] ?? 0), animationDelay: `${index * 0.3}s` }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      <span className="text-ui-xs font-medium text-neutral5">{signal}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          </ol>
        </div>

        <div className="border-t border-border1 bg-surface1/50 p-5 sm:px-8" aria-label="Signal preview">
          <div className="mx-auto max-w-5xl opacity-60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-ui-xs font-semibold tracking-wider text-neutral4 uppercase">
                  Your analysis will appear here
                </p>
                <p className="mt-1 text-ui-sm text-neutral3">Trace groups will flow into comparable signal paths.</p>
              </div>
              <div className="hidden items-end gap-1 sm:flex" aria-hidden="true">
                {[6, 10, 8, 12, 7, 11].map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="w-2 rounded-sm bg-neutral3"
                    style={{ height: `${height * 2}px` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border1 bg-surface2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-ui-sm text-neutral4">Run your agents to start turning traces into signals.</p>
          <div className="flex flex-wrap items-center gap-2">
            {actionSlot}
            <Button
              variant="ghost"
              size="sm"
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the docs <ExternalLinkIcon />
            </Button>
            <Button variant="primary" size="sm" as="a" href="/observability">
              View incoming traces <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
