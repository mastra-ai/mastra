import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { IconKey1 } from '@mastra/playground-ui/icons/central/IconKey1';
import { toast } from '@mastra/playground-ui/utils/toast';

import { useState } from 'react';
import { JsonObjectEditor } from './json-object-editor';
import { RunActionPopover } from './run-action-popover';
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
    <RunActionPopover label="Request context" icon={<IconKey1 />} open={open} onOpenChange={setOpen}>
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
