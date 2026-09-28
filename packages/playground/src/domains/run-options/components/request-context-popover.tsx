import { toast } from '@mastra/playground-ui/utils/toast';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { JsonObjectEditor } from './json-object-editor';
import { RunActionPopover } from './run-action-popover';
import type { RequestContextEntityType } from '@/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { useRequestContextPresets } from '@/domains/request-context/hooks/use-request-context-presets';

interface RequestContextPopoverProps {
  entityType: RequestContextEntityType;
  entityId: string;
}

export function RequestContextPopover({ entityType, entityId }: RequestContextPopoverProps) {
  const [open, setOpen] = useState(false);
  const [requestContext, setRequestContext] = useEntityRequestContext(entityType, entityId);
  const presets = useRequestContextPresets();

  const handleSave = (value: Record<string, any>) => {
    setRequestContext(value);
    toast.success('Request context saved locally');
    setOpen(false);
  };

  return (
    <RunActionPopover label="Request context" icon={<KeyRound />} open={open} onOpenChange={setOpen}>
      <JsonObjectEditor
        label="Request Context"
        presets={presets}
        value={requestContext}
        onSave={handleSave}
        editorClassName="h-[260px]"
      />
    </RunActionPopover>
  );
}
