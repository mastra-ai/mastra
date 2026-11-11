import { createStateStore } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { JSONUIProvider, Renderer, defineRegistry } from '@json-render/react';
import type { ComponentFn } from '@json-render/react';
import { studioCatalog } from '@mastra/json-render/studio';

import { useEffect, useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Card } from '@/ds/components/Card';
import { MetricsKpiCard } from '@/ds/components/MetricsKpiCard';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type Component<K extends keyof typeof studioCatalog.data.components> = ComponentFn<typeof studioCatalog, K>;

// Props arrive one patch at a time while the interface streams, so each component copes with missing ones.
const Stack: Component<'Stack'> = ({ props, children }) => (
  <div className={cn('flex gap-3', props.direction === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col')}>
    {children}
  </div>
);

const GRID_COLUMNS = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' } as const;

const Grid: Component<'Grid'> = ({ props, children }) => (
  <div className={cn('grid grid-cols-1 gap-3', GRID_COLUMNS[props.columns as keyof typeof GRID_COLUMNS])}>
    {children}
  </div>
);

const InterfaceCard: Component<'Card'> = ({ props, children }) => (
  <Card className="grid gap-3 p-4">
    {props.title && (
      <Txt as="h3" variant="card-title">
        {props.title}
      </Txt>
    )}
    {children}
  </Card>
);

const Heading: Component<'Heading'> = ({ props }) => (
  <Txt as="h2" variant="heading">
    {props.text}
  </Txt>
);

const Text: Component<'Text'> = ({ props }) => (
  <Txt as="p" tone={props.tone === 'muted' ? 'muted' : undefined}>
    {props.text}
  </Txt>
);

const InterfaceBadge: Component<'Badge'> = ({ props }) => (
  <Badge variant={props.variant} emphasis="subtle">
    {props.text}
  </Badge>
);

const Metric: Component<'Metric'> = ({ props }) => (
  <MetricsKpiCard className="min-w-0">
    <MetricsKpiCard.Label>{props.label}</MetricsKpiCard.Label>
    <MetricsKpiCard.ValueRow>
      <MetricsKpiCard.Value>{props.value}</MetricsKpiCard.Value>
      {props.changePct !== undefined && (
        <MetricsKpiCard.Change
          changePct={props.changePct}
          comparison={props.comparison}
          lowerIsBetter={props.lowerIsBetter}
        />
      )}
    </MetricsKpiCard.ValueRow>
  </MetricsKpiCard>
);

const InterfaceNotice: Component<'Notice'> = ({ props }) => (
  <Notice variant={props.variant ?? 'info'} title={props.title}>
    <Notice.Message>{props.text}</Notice.Message>
  </Notice>
);

const { registry } = defineRegistry(studioCatalog, {
  components: {
    Stack,
    Grid,
    Card: InterfaceCard,
    Heading,
    Text,
    Badge: InterfaceBadge,
    Metric,
    Notice: InterfaceNotice,
  },
});

/** The JSON Pointer to a top-level state key, escaped so a key like `price/seat` stays one key. */
const pointerTo = (key: string) => `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** The store writes that make it hold `state`, clearing the keys `state` no longer has. */
const writesFor = (current: Record<string, unknown>, state: Record<string, unknown>) => ({
  ...Object.fromEntries(Object.keys(current).map(key => [pointerTo(key), undefined])),
  ...Object.fromEntries(Object.entries(state).map(([key, value]) => [pointerTo(key), value])),
});

export interface JsonRenderInterfaceProps {
  spec: Spec;
}

/** Renders a json-render spec an agent composed from `studioCatalog`, with design-system components. */
export function JsonRenderInterface({ spec }: JsonRenderInterfaceProps) {
  const [store] = useState(() => createStateStore(spec.state ?? {}));

  // State streams in after the first render, as later patches of the same spec, which can also remove it.
  useEffect(() => {
    store.update(writesFor(store.getSnapshot(), spec.state ?? {}));
  }, [spec.state, store]);

  return (
    <JSONUIProvider registry={registry} store={store}>
      <div role="group" aria-label="Interface">
        <Renderer spec={spec} registry={registry} />
      </div>
    </JSONUIProvider>
  );
}
