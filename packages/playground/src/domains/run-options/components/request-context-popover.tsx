import { toast } from '@mastra/playground-ui/utils/toast';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { RunActionPopover } from './run-action-popover';
import { RequestContext } from '@/domains/agents/components/request-context';
import type { RequestContextEntityType } from '@/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

interface RequestContextPopoverProps {
  entityType: RequestContextEntityType;
  entityId: string;
}

export function RequestContextPopover({ entityType, entityId }: RequestContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const [requestContext, setRequestContext] = useEntityRequestContext(entityType, entityId);

  const handleSave = (value: Record<string, any>) => {
    setRequestContext(value);
    toast.success('Request context saved locally');
    setOpen(false);
  };

  return (
    <RunActionPopover label="Request context" icon={<KeyRound />} open={open} onOpenChange={setOpen}>
      <RequestContext value={requestContext} onSave={handleSave} editorClassName="h-[260px]" />
    </RunActionPopover>
  );
}
