import { CpuIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import './signals-empty-state.css';
import { Button } from '../../../ds/components/Button';
import { Card } from '../../../ds/components/Card';
import { nodeColor } from '../../../ds/components/SankeyChart/sankeyColor';
import type { LinkComponent } from '../../../ds/types/link-component';
import { getSignalHue } from '../signal-colors';

const signalDefinitions = [
  { label: 'Goal', description: 'What the user is trying to achieve or have completed.' },
  { label: 'Sentiment', description: "The user's emotional state or attitude." },
  {
    label: 'Behavior',
    description:
      "The entity's observable actions and patterns, including tool use, omissions, retries, failures, and recovery.",
  },
  { label: 'Outcome', description: 'The final completed, unresolved, or blocked state.' },
];
const signalLabels = signalDefinitions.map(signal => signal.label);

const traceRows = [
  ['chat.completion', '1.2s'],
  ['tool.search_docs', '340ms'],
  ['workflow.support', '2.8s'],
];

const signalStyle = (label: string): CSSProperties => ({
  color: nodeColor(getSignalHue(label)),
});

const PipelineConnector = () => (
  <div aria-hidden="true" className="relative hidden h-full items-center lg:flex">
    <div className="border-border1 w-full border-t border-dashed" />
    <span className="signals-pipeline-connector bg-positive1 absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full shadow-[0_0_12px_currentColor]" />
  </div>
);

export type SignalsEmptyStateProps = {
  actionSlot?: ReactNode;
  LinkComponent?: LinkComponent;
};

export const SignalsEmptyState = ({ actionSlot, LinkComponent = 'a' }: SignalsEmptyStateProps) => {
  return (
    <section className="bg-surface1 min-h-full w-full p-6 md:px-10 lg:px-12 xl:px-[4.375rem]">
      <div className="mx-auto w-full max-w-260">
        <header>
          <h1 className="text-header-xl text-neutral6 font-medium tracking-tight">
            Understand what drives every agent interaction
          </h1>
        </header>

        <div
          aria-label="Signals analysis pipeline"
          className="mt-14 grid gap-4 lg:grid-cols-[17.5rem_4.5rem_17.5rem_4.5rem_minmax(0,1fr)] lg:gap-0"
          role="list"
        >
          <article className="h-50 p-5" role="listitem">
            <h2 className="text-neutral6 text-lg font-semibold">Traces</h2>
            <p className="text-neutral3 mt-0.5 text-xs">Every agent interaction</p>
            <p className="text-neutral2 mt-5 font-mono text-[0.5625rem] tracking-[0.24em] uppercase">Input</p>
            <div className="mt-2.5 space-y-2">
              {traceRows.map(([name, duration]) => (
                <div
                  className="border-border1 bg-surface3 text-ui-xs flex items-center justify-between rounded border px-3 py-1.5 font-mono"
                  key={name}
                >
                  <span className="text-neutral4">{name}</span>
                  <span className="text-neutral2">{duration}</span>
                </div>
              ))}
            </div>
          </article>

          <PipelineConnector />

          <Card
            as="article"
            className="flex h-50 flex-col items-center p-5 text-center"
            elevation="elevated"
            role="listitem"
          >
            <h2 className="text-neutral6 text-lg font-semibold">Mastra Engine</h2>
            <p className="text-neutral3 mt-0.5 text-xs">Clusters recurring patterns</p>
            <div aria-hidden="true" className="relative mt-5 flex size-20 items-center justify-center">
              <span className="signals-engine-pulse border-positive1/15 absolute size-20 rounded-full border" />
              <span className="border-positive1/25 absolute size-14 rounded-full border" />
              <span className="border-positive1/40 bg-positive1/5 absolute size-9 rounded-full border shadow-[0_0_24px_var(--color-positive1)]" />
              <CpuIcon className="text-positive1 relative size-4" />
            </div>
            <p className="text-ui-xs text-neutral2 mt-3 max-w-40 leading-4">
              Finds relationships across conversations, tools, and workflows
            </p>
          </Card>

          <PipelineConnector />

          <article className="h-50 p-5" role="listitem">
            <h2 className="text-neutral6 text-lg font-semibold">Signal analysis</h2>
            <p className="text-neutral3 mt-0.5 text-xs">What your users actually do</p>
            <p className="text-neutral2 mt-5 font-mono text-[0.5625rem] tracking-[0.24em] uppercase">Output</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signalLabels.map(label => (
                <span
                  className="signals-chip bg-surface3 inline-flex items-center gap-2 rounded border border-current/25 px-2.5 py-1.5 text-xs font-medium shadow-[0_0_14px_color-mix(in_oklch,currentColor_12%,transparent)]"
                  key={label}
                  style={signalStyle(label)}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current shadow-[0_0_7px_currentColor]" />
                  {label}
                </span>
              ))}
            </div>
          </article>
        </div>

        <section className="mt-10" aria-labelledby="signal-definitions-heading">
          <h2 id="signal-definitions-heading" className="text-neutral6 text-lg font-semibold">
            What each signal means
          </h2>
          <div aria-label="Signal definitions" className="mt-4 grid gap-3 sm:grid-cols-2" role="list">
            {signalDefinitions.map(signal => (
              <article className="px-1 py-2" key={signal.label} role="listitem">
                <h3 className="text-sm font-semibold" style={signalStyle(signal.label)}>
                  {signal.label}
                </h3>
                <p className="text-neutral3 mt-1.5 text-xs leading-5">{signal.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-label="Signal relationship preview">
          <p className="text-neutral2 font-mono text-[0.5625rem] tracking-[0.2em] uppercase">
            Grouped trace relationships will appear after traces contain at least two signal types
          </p>
          <div aria-hidden="true" className="mt-3 grid h-18 grid-cols-3 gap-5 opacity-35">
            {[0, 1, 2].map(index => (
              <div className="border-border1 bg-surface2/30 rounded-md border border-dashed p-4" key={index}>
                <div className="bg-neutral1 h-1.5 w-16 rounded-full" />
                <div className="bg-neutral1/60 mt-3 h-1 w-full rounded-full" />
                <div className="bg-neutral1/40 mt-2 h-1 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <aside className="border-border1 bg-surface2 mt-9 flex min-h-16 flex-col gap-4 rounded-md border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span
              aria-hidden="true"
              className="bg-warning1 mt-1.5 size-2 shrink-0 rounded-full shadow-[0_0_9px_currentColor] sm:mt-0"
            />
            <p className="text-neutral3 text-xs leading-5">
              <strong className="text-neutral5 font-semibold">Waiting for traces.</strong> Signals activate
              automatically once your agents start receiving traffic.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actionSlot}
            <Button
              as="a"
              href="https://mastra.ai/en/docs/observability/tracing/overview"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
            >
              Read the docs
            </Button>
            <Button as={LinkComponent} href="/observability" variant="primary" size="sm">
              View incoming traces
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
};
