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
    <div className="w-full border-t border-dashed border-border1" />
    <span className="signals-pipeline-connector absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-positive1 shadow-[0_0_12px_currentColor]" />
  </div>
);

export type SignalsEmptyStateProps = {
  actionSlot?: ReactNode;
  LinkComponent?: LinkComponent;
};

export const SignalsEmptyState = ({ actionSlot, LinkComponent = 'a' }: SignalsEmptyStateProps) => {
  return (
    <section className="min-h-full w-full bg-surface1 p-6 md:px-10 lg:px-12 xl:px-[4.375rem]">
      <div className="max-w-260 mx-auto w-full">
        <header>
          <h1 className="text-header-xl font-medium tracking-tight text-neutral6">
            Understand what drives every agent interaction
          </h1>
        </header>

        <div
          aria-label="Signals analysis pipeline"
          className="mt-14 grid gap-4 lg:grid-cols-[17.5rem_4.5rem_17.5rem_4.5rem_minmax(0,1fr)] lg:gap-0"
          role="list"
        >
          <article className="h-50 p-5" role="listitem">
            <h2 className="text-lg font-semibold text-neutral6">Traces</h2>
            <p className="mt-0.5 text-xs text-neutral3">Every agent interaction</p>
            <p className="mt-5 font-mono text-[0.5625rem] tracking-[0.24em] text-neutral2 uppercase">Input</p>
            <div className="mt-2.5 space-y-2">
              {traceRows.map(([name, duration]) => (
                <div
                  className="flex items-center justify-between rounded border border-border1 bg-surface3 px-3 py-1.5 font-mono text-ui-xs"
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
            className="h-50 flex flex-col items-center p-5 text-center"
            elevation="elevated"
            role="listitem"
          >
            <h2 className="text-lg font-semibold text-neutral6">Mastra Engine</h2>
            <p className="mt-0.5 text-xs text-neutral3">Clusters recurring patterns</p>
            <div aria-hidden="true" className="relative mt-5 flex size-20 items-center justify-center">
              <span className="signals-engine-pulse absolute size-20 rounded-full border border-positive1/15" />
              <span className="absolute size-14 rounded-full border border-positive1/25" />
              <span className="absolute size-9 rounded-full border border-positive1/40 bg-positive1/5 shadow-[0_0_24px_var(--color-positive1)]" />
              <CpuIcon className="relative size-4 text-positive1" />
            </div>
            <p className="mt-3 max-w-40 text-ui-xs leading-4 text-neutral2">
              Finds relationships across conversations, tools, and workflows
            </p>
          </Card>

          <PipelineConnector />

          <article className="h-50 p-5" role="listitem">
            <h2 className="text-lg font-semibold text-neutral6">Signal analysis</h2>
            <p className="mt-0.5 text-xs text-neutral3">What your users actually do</p>
            <p className="mt-5 font-mono text-[0.5625rem] tracking-[0.24em] text-neutral2 uppercase">Output</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signalLabels.map(label => (
                <span
                  className="signals-chip inline-flex items-center gap-2 rounded border border-current/25 bg-surface3 px-2.5 py-1.5 text-xs font-medium shadow-[0_0_14px_color-mix(in_oklch,currentColor_12%,transparent)]"
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
          <h2 id="signal-definitions-heading" className="text-lg font-semibold text-neutral6">
            What each signal means
          </h2>
          <div aria-label="Signal definitions" className="mt-4 grid gap-3 sm:grid-cols-2" role="list">
            {signalDefinitions.map(signal => (
              <article className="px-1 py-2" key={signal.label} role="listitem">
                <h3 className="text-sm font-semibold" style={signalStyle(signal.label)}>
                  {signal.label}
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-neutral3">{signal.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-label="Signal relationship preview">
          <p className="font-mono text-[0.5625rem] tracking-[0.2em] text-neutral2 uppercase">
            Grouped trace relationships will appear after traces contain at least two signal types
          </p>
          <div aria-hidden="true" className="h-18 mt-3 grid grid-cols-3 gap-5 opacity-35">
            {[0, 1, 2].map(index => (
              <div className="rounded-md border border-dashed border-border1 bg-surface2/30 p-4" key={index}>
                <div className="h-1.5 w-16 rounded-full bg-neutral1" />
                <div className="mt-3 h-1 w-full rounded-full bg-neutral1/60" />
                <div className="mt-2 h-1 w-2/3 rounded-full bg-neutral1/40" />
              </div>
            ))}
          </div>
        </section>

        <aside className="mt-9 flex min-h-16 flex-col gap-4 rounded-md border border-border1 bg-surface2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-warning1 shadow-[0_0_9px_currentColor] sm:mt-0"
            />
            <p className="text-xs leading-5 text-neutral3">
              <strong className="font-semibold text-neutral5">Waiting for traces.</strong> Signals activate
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
