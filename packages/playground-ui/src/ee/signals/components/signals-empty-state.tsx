import type { EntityLearningProgressResponse, SignalCatalogEntry } from '@mastra/client-js';
import { CpuIcon, ExternalLink } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { Button } from '../../../ds/components/Button';
import { Card } from '../../../ds/components/Card';
import type { LinkComponent } from '../../../ds/types/link-component';
import { getSignalColor } from '../signal-colors';
import { BUILT_IN_SIGNAL_CATALOG, orderedSignals, signalDescription, signalLabel } from '../signal-formatting';
import { Txt } from '@/ds/components/Txt';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

const traceRows = [
  ['chat.completion', '1.2s'],
  ['tool.search_docs', '340ms'],
  ['workflow.support', '2.8s'],
];

const signalStyle = (label: string): CSSProperties => ({
  color: getSignalColor(label),
});

const PipelineConnector = () => (
  <div aria-hidden="true" className="relative hidden h-full items-center lg:flex">
    <div className="w-full border-t border-dashed border-border" />
    <span className="absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand-green-indicator" />
  </div>
);

export type TraceIntelligenceProgress = EntityLearningProgressResponse;

export type SignalsEmptyStateProps = {
  actionSlot?: ReactNode;
  LinkComponent?: LinkComponent;
  progress?: TraceIntelligenceProgress;
  signalCatalog?: readonly SignalCatalogEntry[];
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
      <div className={cn(raisedSurfaceStyle, 'rounded-md px-3 py-2')}>
        <Txt as="dt" variant="caption" tone="muted">
          Traces analyzed
        </Txt>
        <Txt as="dd" variant="heading" tone="ink" className="mt-1">
          {formatNumber(progress.traceCount)}
        </Txt>
      </div>
      <div className={cn(raisedSurfaceStyle, 'rounded-md px-3 py-2')}>
        <Txt as="dt" variant="caption" tone="muted">
          Trace signal types ready
        </Txt>
        <Txt as="dd" variant="heading" tone="ink" className="mt-1">
          {progress.signalCatalog ? readySignalCount : progress.availableSignals.length} of {enabledSignalCount}
        </Txt>
      </div>
      <div className={cn(raisedSurfaceStyle, 'rounded-md px-3 py-2')}>
        <Txt as="dt" variant="caption" tone="muted">
          Status
        </Txt>
        <Txt as="dd" variant="heading" tone="ink" className="mt-1 capitalize">
          {progress.status}
        </Txt>
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
          <li className="rounded-md border border-border bg-background px-3 py-2" key={signalName}>
            <div className="flex items-center justify-between gap-2">
              <Txt as="span" variant="subheading" style={signalStyle(signalName)}>
                {label}
              </Txt>
              <Txt as="span" variant="caption" tone="muted">
                {isReady ? 'Themes ready' : 'Processing'}
              </Txt>
            </div>
            <Txt variant="caption" tone="muted" className="mt-1">
              {formatNumber(value.generated)} generated · {formatNumber(value.embedded)} embedded
            </Txt>
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
    <section className="rounded-lg border border-border bg-background p-4" aria-labelledby="pending-signals-heading">
      <Txt as="h2" variant="subheading" tone="ink" id="pending-signals-heading">
        Signals building themes
      </Txt>
      <Txt variant="caption" tone="muted" className="mt-1">
        Themes appear once enough new traces are analyzed, embedded, and clustered.
      </Txt>
      <ul aria-label="Pending trace signals" className="mt-3 grid gap-2 sm:grid-cols-2">
        {pendingSignals.map(signal => {
          const value = progress?.signals[signal.name] ?? { generated: 0, embedded: 0 };
          return (
            <Txt
              as="li"
              variant="body-sm"
              font="body"
              className={cn(raisedSurfaceStyle, 'rounded-md px-3 py-2')}
              key={signal.name}
            >
              <div className="flex items-center justify-between gap-2">
                <Txt as="span" variant="subheading" style={signalStyle(signal.name)}>
                  {signalLabel(catalog, signal.name)}
                </Txt>
                <Txt as="span" variant="caption" tone="muted" className="capitalize">
                  {signal.status}
                </Txt>
              </div>
              {signalDescription(catalog, signal.name) ? (
                <Txt variant="caption" tone="muted" className="mt-1">
                  {signalDescription(catalog, signal.name)}
                </Txt>
              ) : null}
              <Txt variant="caption" tone="muted" className="mt-1">
                {formatNumber(value.generated)} generated · {formatNumber(value.embedded)} embedded
              </Txt>
            </Txt>
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
  signalCatalog,
  isRangeEmpty,
}: SignalsEmptyStateProps) => {
  const copy = statusCopy(progress, isRangeEmpty);
  const catalog = signalCatalog ?? progress?.signalCatalog ?? BUILT_IN_SIGNAL_CATALOG;
  const enabledSignalNames = orderedSignals(
    catalog,
    catalog.filter(signal => signal.enabled).map(signal => signal.name),
  );
  const signalDefinitions = enabledSignalNames.map(name => ({
    key: name,
    label: signalLabel(catalog, name),
    description: signalDescription(catalog, name),
  }));

  return (
    <section className="min-h-full w-full bg-sidebar p-6 md:px-10 lg:px-12 xl:px-[4.375rem]">
      <div className="mx-auto w-full max-w-260">
        <header>
          <Txt variant="eyebrow" tone="muted" className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-green-indicator" />
            Trace Intelligence
          </Txt>
          <Txt as="h1" variant="display" tone="ink" className="mt-2">
            Understand what drives every agent interaction
          </Txt>
          <Txt tone="muted" className="mt-2 max-w-180">
            Trace Intelligence groups recurring goals, outcomes, behaviors, and sentiment across completed traces.
          </Txt>
        </header>

        <div
          role="list"
          aria-label="Trace Intelligence analysis pipeline"
          className="mt-14 grid gap-4 lg:grid-cols-[17.5rem_4.5rem_17.5rem_4.5rem_minmax(0,1fr)] lg:gap-0"
        >
          <div role="listitem" className="min-h-50 p-5">
            <Txt as="h2" variant="heading" tone="ink">
              Traces
            </Txt>
            <Txt variant="caption" tone="muted" className="mt-0.5">
              Every agent interaction
            </Txt>
            <Txt variant="eyebrow" tone="muted" className="mt-5">
              Input
            </Txt>
            <div className="mt-2.5 space-y-2">
              {traceRows.map(([name, duration]) => (
                <Txt
                  as="div"
                  variant="meta"
                  font="mono"
                  className={cn(raisedSurfaceStyle, 'flex items-center justify-between rounded px-3 py-1.5')}
                  key={name}
                >
                  <span className="text-muted-foreground">{name}</span>
                  <span className="text-muted-foreground">{duration}</span>
                </Txt>
              ))}
            </div>
          </div>

          <PipelineConnector />

          <Card
            as="div"
            role="listitem"
            className="flex min-h-50 flex-col items-center p-5 text-center"
            elevation="raised"
          >
            <Txt as="h2" variant="heading" tone="ink">
              Trace Intelligence
            </Txt>
            <Txt variant="caption" tone="muted" className="mt-0.5">
              Finds recurring themes
            </Txt>
            <div
              aria-hidden="true"
              className="mt-5 flex size-14 items-center justify-center rounded-full border border-brand-green-indicator bg-fill-subtle"
            >
              <CpuIcon className="size-4 text-brand-green-indicator" />
            </div>
            <Txt variant="meta" tone="muted" className="mt-3 max-w-40">
              Clusters similar trace signals into themes for each dimension
            </Txt>
          </Card>

          <PipelineConnector />

          <div role="listitem" className="min-h-50 p-5">
            <Txt as="h2" variant="heading" tone="ink">
              Theme analysis
            </Txt>
            <Txt variant="caption" tone="muted" className="mt-0.5">
              How recurring patterns connect
            </Txt>
            <Txt variant="eyebrow" tone="muted" className="mt-5">
              Output
            </Txt>
            <div className="mt-3 flex flex-wrap gap-2">
              {signalDefinitions.map(signal => (
                <Txt
                  as="span"
                  variant="column"
                  className="inline-flex items-center gap-2 rounded border border-border bg-card px-2.5 py-1.5"
                  key={signal.key}
                  style={signalStyle(signal.key)}
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  {signal.label}
                </Txt>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-10" aria-labelledby="signal-definitions-heading">
          <Txt as="h2" variant="heading" tone="ink" id="signal-definitions-heading">
            What each trace signal means
          </Txt>
          <ul aria-label="Trace signal definitions" className="mt-4 grid gap-3 sm:grid-cols-2">
            {signalDefinitions.map(signal => (
              <li className="px-1 py-2" key={signal.key}>
                <Txt as="h3" variant="subheading" style={signalStyle(signal.key)}>
                  {signal.label}
                </Txt>
                {signal.description ? (
                  <Txt variant="caption" tone="muted" className="mt-1.5">
                    {signal.description}
                  </Txt>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <aside className="mt-9 rounded-md border border-border bg-background px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-warning-indicator" />
            <div className="min-w-0 flex-1">
              <Txt variant="caption" tone="muted">
                <Txt as="strong" variant="column" tone="ink">
                  {copy.title}
                </Txt>{' '}
                {copy.body}
              </Txt>
              {progress ? <ProgressSummary progress={progress} /> : null}
              <SignalProgressList progress={progress} />
            </div>
          </div>
          <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actionSlot}
            <Button
              icon={<ExternalLink />}
              render={
                <a
                  href="https://mastra.ai/en/docs/mastra-platform/trace-intelligence"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              size="sm"
            >
              Read the docs<span className="sr-only"> (opens in new tab)</span>
            </Button>
            <Button icon={<TraceIcon />} render={<LinkComponent href="/traces" />} variant="primary" size="sm">
              View incoming traces
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
};
