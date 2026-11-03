import { PlusIcon } from 'lucide-react';
import type { Scorer } from '../lib/scores';
import type { CatalogueEntry, EditorKind } from './catalogue';
import { catalogue } from './catalogue';
import type { QuickMetric, WidgetPreset } from './presets';
import { QUICK_METRICS, WIDGET_PRESETS } from './presets';
import { MetricPicker } from './view-editor';
import { Button } from '@/ds/components/Button';
import { Card } from '@/ds/components/Card';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

type WidgetStarterProps = {
  scorers: readonly Scorer[];
  onQuickMetric: (metric: QuickMetric) => void;
  onPreset: (preset: WidgetPreset) => void;
  onPick: (entry: CatalogueEntry) => void;
};

/** A new widget's first screen: one click on a metric or a preset gets a drawn widget to edit. */
export function WidgetStarter({ scorers, onQuickMetric, onPreset, onPick }: WidgetStarterProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl animate-in flex-col gap-10 px-6 py-12 duration-300 fade-in-0 motion-reduce:animate-none">
        <div className="flex flex-col items-center gap-2 text-center">
          <Txt as="h2" variant="title" tone="ink">
            What do you want to track?
          </Txt>
          <Txt tone="muted">Add a metric or start from a preset. Everything stays editable.</Txt>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Txt as="span" variant="label" tone="muted">
              Quick add:
            </Txt>
            {QUICK_METRICS.map(m => (
              <Button key={m.label} size="sm" icon={<PlusIcon />} onClick={() => onQuickMetric(m)}>
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <Txt as="h3" variant="eyebrow" tone="muted">
            Start from a preset
          </Txt>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WIDGET_PRESETS.map(preset => (
              <Card
                key={preset.id}
                interactive
                elevation="flat"
                className="flex flex-col gap-3 p-3 text-left"
                onClick={() => onPreset(preset)}
              >
                <KindSketch kind={preset.kind} />
                <div className="flex flex-col gap-0.5 px-1">
                  <Txt as="span" variant="card-title" tone="ink">
                    {preset.title}
                  </Txt>
                  <Txt as="span" variant="caption" tone="muted">
                    {preset.description}
                  </Txt>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Txt as="h3" variant="eyebrow" tone="muted">
            Or start blank
          </Txt>
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-6 py-8">
            <Txt variant="body-sm" tone="muted">
              Pick any metric, then filter, split and shape it.
            </Txt>
            <MetricPicker entries={catalogue(scorers)} onPick={onPick} />
          </div>
        </section>
      </div>
    </div>
  );
}

const BARS = [40, 65, 50, 80, 60, 90, 70];

/** A wireframe of how a kind draws, so presets read at a glance. */
function KindSketch({ kind }: { kind: EditorKind }) {
  const frame = 'flex h-24 gap-1.5 rounded-lg bg-fill-subtle p-3';
  const block = 'rounded-sm bg-fill';
  if (kind === 'kpis') {
    return (
      <div className={cn(frame, 'items-stretch')} aria-hidden>
        {[0, 1, 2].map(i => (
          <div key={i} className={cn(block, 'flex flex-1 flex-col justify-end gap-1 p-2')}>
            <div className="h-3 w-3/4 rounded-xs bg-chart-blue/50" />
            <div className="h-1.5 w-1/2 rounded-xs bg-fill-hover" />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'table') {
    return (
      <div className={cn(frame, 'flex-col justify-center')} aria-hidden>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex flex-1 items-center gap-1.5">
            <div className={cn(block, 'h-2 flex-2')} />
            <div className={cn(block, 'h-2 flex-1')} />
            <div className={cn('h-2 flex-1 rounded-sm', i % 2 ? 'bg-chart-green/40' : 'bg-chart-red/40')} />
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'stackedBar') {
    return (
      <div className={cn(frame, 'items-end')} aria-hidden>
        {BARS.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end gap-px" style={{ height: `${h}%` }}>
            <div className="flex-2 rounded-t-sm bg-chart-blue/50" />
            <div className="flex-3 rounded-b-sm bg-fill" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn(frame, 'items-stretch')} aria-hidden>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="size-full overflow-visible">
        <polyline
          points="0,30 15,24 30,27 45,15 60,19 75,9 100,13"
          fill="none"
          className="stroke-chart-blue"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="0,36 15,33 30,34 45,28 60,30 75,24 100,26"
          fill="none"
          className="stroke-fill-hover"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
