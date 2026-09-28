import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { WorkflowTracingRunOptions } from '@mastra/playground-ui/domains/workflows/components/workflow-tracing-run-options';
import { toast } from '@mastra/playground-ui/utils/toast';
import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

interface RunOptionsPopoverProps {
  /** Extra draft fields rendered above the tracing editor (e.g. workflow resource ID). */
  extraFields?: ReactNode;
  /** Commits the extra fields' drafts; called when Save succeeds. */
  onSaveExtra?: () => void;
  /** Lets the owner of `extraFields` reset its drafts when the popover opens. */
  onOpenChange?: (open: boolean) => void;
}

const COLLISION_AVOIDANCE = { align: 'shift' } as const;

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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger variant="default" size="icon-md" type="button" tooltip="Run options" aria-label="Run options">
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={COLLISION_AVOIDANCE}
        className="w-[min(480px,calc(100vw-2rem))] p-0"
      >
        <div onSubmit={event => event.stopPropagation()}>
          <ScrollArea className="w-full" maxHeight="min(600px, calc(100dvh - 8rem))">
            <div className="space-y-2 py-4">
              <Txt as="h3" variant="body" tone="muted" className="px-5">
                Run options
              </Txt>
              {extraFields && <div className="px-5 py-2">{extraFields}</div>}
              <WorkflowTracingRunOptions onSaved={handleSaved} />
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
