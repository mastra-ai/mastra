import { Minimize2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../../ds/components/Button';
import { ButtonsGroup } from '../../../../ds/components/ButtonsGroup';
import { Card, CardContent } from '../../../../ds/components/Card';
import { CollapsibleBox, useCollapsibleBox } from '../../../../ds/components/CollapsibleBox';
import { CopyButton } from '../../../../ds/components/CopyButton';
import { DataPanelSectionHeading } from '../../../../ds/components/DataPanel/data-panel-section-heading';
import { cn } from '../../../../lib/utils';
import { SpanPayloadJson } from './span-payload-json';

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
    <ButtonsGroup size="sm" aria-label="Payload view" data-slot="span-payload-view-toggle">
      <Button
        variant={view === 'rich' ? 'primary' : 'default'}
        aria-pressed={view === 'rich'}
        onClick={() => onChange('rich')}
      >
        Preview
      </Button>
      <Button
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
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataPanelSectionHeading icon={icon} className={layout === 'details' ? 'text-meta' : undefined}>
          {title}
        </DataPanelSectionHeading>
        <div className="ml-auto flex items-center gap-2">
          <CopyButton content={JSON.stringify(raw, null, 2)} variant="ghost" />
          {hasRich && <ViewToggle view={view} onChange={setView} />}
        </div>
      </div>
      <div className="min-w-0">
        {framed ? (
          <Card data-slot="span-payload-card" className="min-w-0 overflow-hidden">
            <CollapsibleBox state={box} expandLabel="Expand">
              <CardContent>{content}</CardContent>
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
