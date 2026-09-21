import { useState } from 'react';
import type { ReactNode } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanelSectionHeading } from '@/ds/components/DataPanel/data-panel-section-heading';
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
    <ButtonsGroup aria-label="Payload view" data-slot="span-payload-view-toggle">
      <Button
        size="sm"
        variant={view === 'rich' ? 'primary' : 'default'}
        aria-pressed={view === 'rich'}
        onClick={() => onChange('rich')}
      >
        Preview
      </Button>
      <Button
        size="sm"
        variant={view === 'raw' ? 'primary' : 'default'}
        aria-pressed={view === 'raw'}
        onClick={() => onChange('raw')}
      >
        JSON
      </Button>
    </ButtonsGroup>
  );
}

/**
 * A span payload section with a Preview / JSON button group. All JSON views share
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
        <DataPanelSectionHeading icon={icon} className={layout === 'details' ? 'text-meta' : undefined}>
          {title}
        </DataPanelSectionHeading>
        <div className="ml-auto flex items-center gap-2">
          <CopyButton content={JSON.stringify(raw, null, 2)} size="sm" variant="ghost" />
          {hasRich && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>
      <div className="min-w-0">{showJson ? <SpanPayloadJson value={raw} /> : children}</div>
    </div>
  );
}
