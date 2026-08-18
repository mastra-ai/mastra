import type { EntityLearningProgressResponse, SignalCatalogEntry, TraceSignalName } from '@mastra/client-js';
import { CpuIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import './signals-empty-state.css';
import { Button } from '../../../ds/components/Button';
import { Card } from '../../../ds/components/Card';
import { nodeColor } from '../../../ds/components/SankeyChart/sankeyColor';
import type { LinkComponent } from '../../../ds/types/link-component';
import { getSignalHue } from '../signal-colors';
import { BUILT_IN_SIGNAL_CATALOG, orderedSignals, signalDescription, signalLabel } from '../signal-formatting';

type SignalDefinition = {
  key: TraceSignalName;
  label: string;
  description: string;
};

const signalDefinitions: SignalDefinition[] = [
  { key: 'goal', label: 'Goal', description: 'What the user is trying to achieve.' },
  { key: 'outcome', label: 'Outcome', description: 'Whether the interaction was completed, unresolved, or blocked.' },
  {
    key: 'behavior',
    label: 'Behavior',
    description:
      'The observable actions and patterns in the trace, including tool use, retries, failures, and recovery.',
  },
  { key: 'sentiment', label: 'Sentiment', description: "The user's emotional state or attitude." },
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

export type TraceIntelligenceProgress = EntityLearningProgressResponse;

export type SignalsEmptyStateProps = {
  actionSlot?: ReactNode;
  LinkComponent?: LinkComponent;
  progress?: TraceIntelligenceProgress;
  isRangeEmpty?: boolean;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function statusCopy(progress?: TraceIntelligenceProgress, isRangeEmpty?: boolean) {
  if (isRangeEmpty) {
    return {
      title: 'No Trace Intelligence themes in this date range.',
      body: 'Choose a wider snapshot date range, or wait for newly processed traces to form recurring themes.',
    };
  }
  if (!progress || progress.status === 'collecting') {
    return {
      title: 'Collecting traces for Trace Intelligence.',
      body: 'Trace Intelligence starts grouping recurring patterns after your deployed agents send enough completed traces.',
    };
  }
  if (progress.status === 'ready') {
    return {
      title: 'Trace Intelligence themes are ready.',
      body: 'Select at least two available trace signal types to see how goals, outcomes, behaviors, and sentiment connect.',
    };
  }
  return {
    title: 'Analyzing traces for Trace Intelligence.',
    body: 'Trace signals have started processing. Themes appear after enough generated and embedded trace signals form recurring patterns.',
  };
}

function ProgressSummary({ progress }: { progress: TraceIntelligenceProgress }) {
  const catalog = progress.signalCatalog ?? BUILT_IN_SIGNAL_CATALOG;
  const enabledSignalCount = catalog.filter(signal => signal.enabled).length;
  const readySignalCount = catalog.filter(signal => signal.enabled && signal.status === 'ready').length;
  return (
    <dl className="mt-4 grid gap-2 sm:grid-cols-3">
      <div className="border-border1 bg-surface3 rounded-md border px-3 py-2">
        <dt className="text-neutral3 text-xs">Traces analyzed</dt>
        <dd className="text-neutral6 mt-1 text-lg font-semibold">{formatNumber(progress.traceCount)}</dd>
      </div>
      <div className="border-border1 bg-surface3 rounded-md border px-3 py-2">
        <dt className="text-neutral3 text-xs">Trace signal types ready</dt>
        <dd className="text-neutral6 mt-1 text-lg font-semibold">
          {progress.signalCatalog ? readySignalCount : progress.availableSignals.length} of {enabledSignalCount}
        </dd>
      </div>
      <div className="border-border1 bg-surface3 rounded-md border px-3 py-2">
        <dt className="text-neutral3 text-xs">Status</dt>
        <dd className="text-neutral6 mt-1 text-lg font-semibold capitalize">{progress.status}</dd>
      </div>
    </dl>
  );
}

function SignalProgressList({ progress }: { progress?: TraceIntelligenceProgress }) {
  if (!progress) return null;

  const catalog = progress.signalCatalog ?? BUILT_IN_SIGNAL_CATALOG;
  return (
    <ul aria-label="Trace signal processing progress" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {orderedSignals(
        catalog,
        catalog.filter(signal => signal.enabled).map(signal => signal.name),
      ).map(signalName => {
        const value = progress.signals[signalName] ?? { generated: 0, embedded: 0 };
        const catalogEntry = catalog.find(signal => signal.name === signalName);
        const label = signalLabel(catalog, signalName);
        const isReady = catalogEntry ? catalogEntry.status === 'ready' : progress.availableSignals.includes(signalName);
        return (
          <li className="border-border1 bg-surface2 rounded-md border px-3 py-2" key={signalName}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={signalStyle(signalName)}>
                {label}
              </span>
              <span className="text-neutral4 text-xs">{isReady ? 'Themes ready' : 'Processing'}</span>
            </div>
            <p className="text-neutral3 mt-1 text-xs">
              {formatNumber(value.generated)} generated · {formatNumber(value.embedded)} embedded
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function PendingSignalProgress({
  progress,
  signalCatalog,
}: {
  progress?: TraceIntelligenceProgress;
  signalCatalog: readonly SignalCatalogEntry[];
}) {
  const catalog = progress?.signalCatalog ?? signalCatalog;
  const pendingSignals = catalog.filter(signal => signal.enabled && signal.status !== 'ready');
  if (pendingSignals.length === 0) return null;

  return (
    <section className="border-border1 bg-surface2 rounded-lg border p-4" aria-labelledby="pending-signals-heading">
      <h2 id="pending-signals-heading" className="text-neutral6 text-sm font-semibold">
        Signals building themes
      </h2>
      <p className="text-neutral3 mt-1 text-xs">
        Themes appear once enough new traces are analyzed, embedded, and clustered.
      </p>
      <ul aria-label="Pending trace signals" className="mt-3 grid gap-2 sm:grid-cols-2">
        {pendingSignals.map(signal => {
          const value = progress?.signals[signal.name] ?? { generated: 0, embedded: 0 };
          return (
            <li className="border-border1 bg-surface1 rounded-md border px-3 py-2" key={signal.name}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={signalStyle(signal.name)}>
                  {signalLabel(catalog, signal.name)}
                </span>
                <span className="text-neutral4 text-xs capitalize">{signal.status}</span>
              </div>
              {signalDescription(catalog, signal.name) ? (
                <p className="text-neutral3 mt-1 text-xs">{signalDescription(catalog, signal.name)}</p>
              ) : null}
              <p className="text-neutral3 mt-1 text-xs">
                {formatNumber(value.generated)} generated · {formatNumber(value.embedded)} embedded
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const SignalsEmptyState = ({
  actionSlot,
  LinkComponent = 'a',
  progress,
  isRangeEmpty,
}: SignalsEmptyStateProps) => {
  const copy = statusCopy(progress, isRangeEmpty);

  return (
    <section className="bg-surface1 min-h-full w-full p-6 md:px-10 lg:px-12 xl:px-[4.375rem]">
      <div className="mx-auto w-full max-w-260">
        <header>
          <p className="text-neutral4 flex items-center gap-2 font-mono text-xs tracking-wider uppercase">
            <span aria-hidden="true" className="bg-accent1 size-2 rounded-full" />
            Trace Intelligence
          </p>
          <h1 className="text-header-xl text-neutral6 mt-2 font-medium tracking-tight">
            Understand what drives every agent interaction
          </h1>
          <p className="text-neutral3 mt-2 max-w-180 text-sm leading-5">
            Trace Intelligence groups recurring goals, outcomes, behaviors, and sentiment across completed traces.
          </p>
        </header>

        <div
          role="list"
          aria-label="Trace Intelligence analysis pipeline"
          className="mt-14 grid gap-4 lg:grid-cols-[17.5rem_4.5rem_17.5rem_4.5rem_minmax(0,1fr)] lg:gap-0"
        >
          <div role="listitem" className="min-h-50 p-5">
            <h2 className="text-neutral6 text-lg font-semibold">Traces</h2>
            <p className="text-neutral3 mt-0.5 text-xs">Every agent interaction</p>
            <p className="text-neutral3 mt-5 font-mono text-[0.6875rem] tracking-[0.18em] uppercase">Input</p>
            <div className="mt-2.5 space-y-2">
              {traceRows.map(([name, duration]) => (
                <div
                  className="border-border1 bg-surface3 text-ui-xs flex items-center justify-between rounded border px-3 py-1.5 font-mono"
                  key={name}
                >
                  <span className="text-neutral4">{name}</span>
                  <span className="text-neutral3">{duration}</span>
                </div>
              ))}
            </div>
          </div>

          <PipelineConnector />

          <Card
            as="div"
            role="listitem"
            className="flex min-h-50 flex-col items-center p-5 text-center"
            elevation="elevated"
          >
            <h2 className="text-neutral6 text-lg font-semibold">Trace Intelligence</h2>
            <p className="text-neutral3 mt-0.5 text-xs">Finds recurring themes</p>
            <div aria-hidden="true" className="relative mt-5 flex size-20 items-center justify-center">
              <span className="signals-engine-pulse border-positive1/15 absolute size-20 rounded-full border" />
              <span className="border-positive1/25 absolute size-14 rounded-full border" />
              <span className="border-positive1/40 bg-positive1/5 absolute size-9 rounded-full border shadow-[0_0_24px_var(--color-positive1)]" />
              <CpuIcon className="text-positive1 relative size-4" />
            </div>
            <p className="text-ui-xs text-neutral3 mt-3 max-w-40 leading-4">
              Clusters similar trace signals into themes for each dimension
            </p>
          </Card>

          <PipelineConnector />

          <div role="listitem" className="min-h-50 p-5">
            <h2 className="text-neutral6 text-lg font-semibold">Theme analysis</h2>
            <p className="text-neutral3 mt-0.5 text-xs">How recurring patterns connect</p>
            <p className="text-neutral3 mt-5 font-mono text-[0.6875rem] tracking-[0.18em] uppercase">Output</p>
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
          </div>
        </div>

        <section className="mt-10" aria-labelledby="signal-definitions-heading">
          <h2 id="signal-definitions-heading" className="text-neutral6 text-lg font-semibold">
            What each trace signal means
          </h2>
          <ul aria-label="Trace signal definitions" className="mt-4 grid gap-3 sm:grid-cols-2">
            {signalDefinitions.map(signal => (
              <li className="px-1 py-2" key={signal.label}>
                <h3 className="text-sm font-semibold" style={signalStyle(signal.label)}>
                  {signal.label}
                </h3>
                <p className="text-neutral3 mt-1.5 text-xs leading-5">{signal.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="border-border1 bg-surface2 mt-9 rounded-md border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-warning1 mt-1.5 size-2 shrink-0 rounded-full shadow-[0_0_9px_currentColor]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-neutral3 text-xs leading-5">
                <strong className="text-neutral5 font-semibold">{copy.title}</strong> {copy.body}
              </p>
              {progress ? <ProgressSummary progress={progress} /> : null}
              <SignalProgressList progress={progress} />
            </div>
          </div>
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actionSlot}
            <Button
              as="a"
              href="https://mastra.ai/en/docs/mastra-platform/trace-intelligence"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
            >
              Read the docs<span className="sr-only"> (opens in new tab)</span>
            </Button>
            <Button as={LinkComponent} href="/traces" variant="primary" size="sm">
              View incoming traces
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
};
