import { WorkflowTracingRunOptions } from '@mastra/playground-ui/domains/workflows/components/workflow-tracing-run-options';
import { toast } from '@mastra/playground-ui/utils/toast';
import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { RunActionPopover } from './run-action-popover';

interface RunOptionsPopoverProps {
  /** Extra draft fields rendered above the tracing editor (e.g. workflow resource ID). */
  extraFields?: ReactNode;
  /** Commits the extra fields' drafts; called when Save succeeds. */
  onSaveExtra?: () => void;
  /** Lets the owner of `extraFields` reset its drafts when the popover opens. */
  onOpenChange?: (open: boolean) => void;
}

/** Tracing options are persisted per entity by the enclosing `TracingSettingsProvider`. */
export function RunOptionsPopover({ extraFields, onSaveExtra, onOpenChange }: RunOptionsPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleSaved = () => {
    onSaveExtra?.();
    toast.success('Run options saved locally');
    handleOpenChange(false);
  };

  return (
    <RunActionPopover label="Run options" icon={<SlidersHorizontal />} open={open} onOpenChange={handleOpenChange}>
      {extraFields}
      <WorkflowTracingRunOptions onSaved={handleSaved} editorClassName="h-[260px]" />
    </RunActionPopover>
  );
}
