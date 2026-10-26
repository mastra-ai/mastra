import { Braces, Eye, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { SpanPayloadJson } from './span-payload-json';
import { Button } from '@/ds/components/Button';
import { Card, CardContent } from '@/ds/components/Card';
import { CollapsibleBox, useCollapsibleBox } from '@/ds/components/CollapsibleBox';
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
  /**
   * Wraps the content in a card, with the clipping inside it so the rounded frame stays intact.
   * Turn off for content that brings its own frame, like the error banner.
   */
  framed?: boolean;
  /** `panel` matches `DataPanel.CodeSection`; `details` matches `DataDetailsPanel.CodeSection`. */
  layout?: 'panel' | 'details';
  defaultView?: SpanPayloadView;
  className?: string;
}

function ViewToggle({ view, onChange }: { view: SpanPayloadView; onChange: (view: SpanPayloadView) => void }) {
  return (
    <div
      role="group"
      aria-label="Payload view"
      data-slot="span-payload-view-toggle"
      className="flex items-center gap-1"
    >
      <Button
        size="icon-sm"
        variant={view === 'rich' ? 'subtle' : 'ghost'}
        aria-pressed={view === 'rich'}
        aria-label="Preview"
        tooltip="Preview"
        onClick={() => onChange('rich')}
      >
        <Eye />
      </Button>
      <Button
        size="icon-sm"
        variant={view === 'raw' ? 'subtle' : 'ghost'}
        aria-pressed={view === 'raw'}
        aria-label="JSON"
        tooltip="JSON"
        onClick={() => onChange('raw')}
      >
        <Braces />
      </Button>
    </div>
  );
}

/**
 * A span payload section with Preview / JSON view toggles. All JSON views share
 * the same syntax highlighting while preserving the stored payload. Long content is
 * clipped with a fade and an Expand button, like the experiment comparison sections.
 */
export function SpanPayloadSection({
  title,
  icon,
  raw,
  hasPreview = true,
  children,
  framed = true,
  layout = 'panel',
  defaultView = 'rich',
  className,
}: SpanPayloadSectionProps) {
  const [view, setView] = useState<SpanPayloadView>(defaultView);
  const box = useCollapsibleBox();
  if (raw == null) return null;

  const hasRich = hasPreview && children != null;
  const showJson = !hasRich || view === 'raw';
  const content = showJson ? <SpanPayloadJson value={raw} bare={framed} /> : children;

  return (
    <div
      data-slot="span-payload-section"
      data-view={showJson ? 'raw' : 'rich'}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataPanelSectionHeading icon={icon} className={layout === 'details' ? 'text-meta' : undefined}>
          {title}
        </DataPanelSectionHeading>
        <div className="ml-auto flex items-center gap-1">
          {hasRich && <ViewToggle view={view} onChange={setView} />}
          <CopyButton content={JSON.stringify(raw, null, 2)} variant="ghost" />
        </div>
      </div>
      <div className="min-w-0">
        {framed ? (
          <Card data-slot="span-payload-card" className="min-w-0 overflow-hidden">
            <CollapsibleBox state={box} expandLabel="Expand">
              {/* Renderers space their children with gaps; a user bubble's chat margin would double the card's Y padding. */}
              <CardContent className="[&_[data-slot=message]]:my-0">{content}</CardContent>
            </CollapsibleBox>
          </Card>
        ) : (
          <CollapsibleBox state={box} expandLabel="Expand">
            {content}
          </CollapsibleBox>
        )}
        {box.isExpanded && box.isClipped && (
          <div className="flex justify-center pt-1">
            <Button size="sm" variant="ghost" icon={<Minimize2 />} onClick={() => box.setExpanded(false)}>
              Collapse
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
