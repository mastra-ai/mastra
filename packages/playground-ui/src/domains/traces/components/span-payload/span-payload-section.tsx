import { useState } from 'react';
import type { ReactNode } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanelSectionHeading } from '@/ds/components/DataPanel/data-panel-section-heading';
import { Switch } from '@/ds/components/Switch';
import { cn } from '@/lib/utils';

export type SpanPayloadView = 'rich' | 'raw';

export interface SpanPayloadSectionProps {
  title: string;
  icon?: ReactNode;
  /** The payload as stored; shown as JSON in the Raw view. */
  raw: unknown;
  /** Whether a dedicated presentation exists rather than a JSON fallback. */
  hasPreview?: boolean;
  /**
   * The human-readable rendering. `null` when the payload has no rich form
   * (JSON fallback): the section then shows Raw only and hides the toggle.
   */
  children: ReactNode;
  /** `panel` matches `DataPanel.CodeSection`; `details` matches `DataDetailsPanel.CodeSection`. */
  layout?: 'panel' | 'details';
  defaultView?: SpanPayloadView;
  className?: string;
}

function ViewToggle({ view, onChange }: { view: SpanPayloadView; onChange: (view: SpanPayloadView) => void }) {
  return (
    <label className="text-ui-sm flex items-center gap-2" data-slot="span-payload-view-toggle">
      JSON
      <Switch
        aria-label="JSON"
        checked={view === 'raw'}
        onCheckedChange={checked => onChange(checked ? 'raw' : 'rich')}
      />
    </label>
  );
}

/**
 * A span payload section with a JSON switch. All JSON views share
 * the same syntax highlighting while preserving the stored payload.
 */
export function SpanPayloadSection({
  title,
  icon,
  raw,
  hasPreview = true,
  children,
  layout = 'panel',
  defaultView = 'rich',
  className,
}: SpanPayloadSectionProps) {
  const [view, setView] = useState<SpanPayloadView>(defaultView);
  if (raw == null) return null;

  const hasRich = hasPreview && children != null;
  const showJson = !hasRich || view === 'raw';

  return (
    <div
      data-slot="span-payload-section"
      data-view={showJson ? 'raw' : 'rich'}
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataPanelSectionHeading icon={icon} className={layout === 'details' ? 'text-ui-xs' : undefined}>
          {title}
        </DataPanelSectionHeading>
        <div className="ml-auto flex items-center gap-2">
          <CopyButton content={JSON.stringify(raw, null, 2)} size="sm" />
          {hasRich && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>
      <div className="min-w-0">{showJson ? <SpanPayloadJson value={raw} /> : children}</div>
    </div>
  );
}
