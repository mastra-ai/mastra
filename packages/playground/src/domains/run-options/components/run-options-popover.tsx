import { toast } from '@mastra/playground-ui/utils/toast';
import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { TracingOptionsEntityType } from '../hooks/use-entity-tracing-options';
import { useEntityTracingOptions } from '../hooks/use-entity-tracing-options';
import { JsonObjectEditor } from './json-object-editor';
import { RunActionPopover } from './run-action-popover';

interface RunOptionsPopoverProps {
  entityType: TracingOptionsEntityType;
  entityId: string;
  /** Extra draft fields rendered above the tracing editor (e.g. workflow resource ID). */
  extraFields?: ReactNode;
  /** Commits the extra fields' drafts; called when Save succeeds. */
  onSaveExtra?: () => void;
  /** Lets the owner of `extraFields` reset its drafts when the popover opens. */
  onOpenChange?: (open: boolean) => void;
}

export function RunOptionsPopover({
  entityType,
  entityId,
  extraFields,
  onSaveExtra,
  onOpenChange,
}: RunOptionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [tracingOptions, setTracingOptions] = useEntityTracingOptions(entityType, entityId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleSave = (value: Record<string, any>) => {
    setTracingOptions(value);
    onSaveExtra?.();
    toast.success('Run options saved locally');
    handleOpenChange(false);
  };

  return (
    <RunActionPopover label="Run options" icon={<SlidersHorizontal />} open={open} onOpenChange={handleOpenChange}>
      {extraFields}
      <JsonObjectEditor
        label="Tracing Options"
        value={tracingOptions}
        onSave={handleSave}
        editorClassName="h-[260px]"
      />
    </RunActionPopover>
  );
}
