import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { RequestContextEditor } from './request-context-editor';
import type { RequestContextEntityType } from '@/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

interface RequestContextPopoverProps {
  entityType: RequestContextEntityType;
  entityId: string;
  requestContextSchema?: string;
}

// Keep the wide popup anchored to `start` and slide it into view instead of flipping sides.
const COLLISION_AVOIDANCE = { align: 'shift' } as const;

export function RequestContextPopover({ entityType, entityId, requestContextSchema }: RequestContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const [requestContext, setRequestContext] = useEntityRequestContext(entityType, entityId);

  const handleSave = (value: Record<string, any>) => {
    setRequestContext(value);
    toast.success('Request context saved locally');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        variant="default"
        size="icon-md"
        type="button"
        tooltip="Request context"
        aria-label="Request context"
      >
        <KeyRound />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionAvoidance={COLLISION_AVOIDANCE}
        className="w-[min(480px,calc(100vw-2rem))] p-0"
      >
        {/* The popover is portaled, but React events still bubble through it: keep inner
            form submissions from reaching an enclosing form (e.g. the workflow trigger). */}
        <div onSubmit={event => event.stopPropagation()}>
          <ScrollArea className="w-full" maxHeight="min(600px, calc(100dvh - 8rem))">
            <div className="space-y-4 p-4">
              <Txt as="h3" variant="body" tone="muted">
                Request context
              </Txt>
              <RequestContextEditor
                value={requestContext}
                onSave={handleSave}
                requestContextSchema={requestContextSchema}
                freeformEditorClassName="h-[260px] md:h-[320px]"
              />
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
