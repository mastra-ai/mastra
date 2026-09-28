import { toast } from '@mastra/playground-ui/utils/toast';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { RequestContextEditor } from './request-context-editor';
import { RunActionPopover } from './run-action-popover';
import type { RequestContextEntityType } from '@/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

interface RequestContextPopoverProps {
  entityType: RequestContextEntityType;
  entityId: string;
  requestContextSchema?: string;
}

export function RequestContextPopover({ entityType, entityId, requestContextSchema }: RequestContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const [requestContext, setRequestContext] = useEntityRequestContext(entityType, entityId);

  const handleSave = (value: Record<string, any>) => {
    setRequestContext(value);
    toast.success('Request context saved locally');
    setOpen(false);
  };

  return (
    <RunActionPopover label="Request context" icon={<KeyRound />} open={open} onOpenChange={setOpen}>
      <RequestContextEditor
        value={requestContext}
        onSave={handleSave}
        requestContextSchema={requestContextSchema}
        freeformEditorClassName="h-[260px]"
      />
    </RunActionPopover>
  );
}
