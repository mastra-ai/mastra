import { TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import type { WorkflowRunActionsContext } from '@mastra/playground-ui/domains/workflows/workflow/workflow-trigger';
import { useState } from 'react';

import { RequestContextPopover } from './request-context-popover';
import { RunOptionsPopover } from './run-options-popover';

interface WorkflowRunActionsProps extends WorkflowRunActionsContext {
  workflowId: string;
}

export function WorkflowRunActions({ workflowId, resourceId, setResourceId }: WorkflowRunActionsProps) {
  const [resourceIdDraft, setResourceIdDraft] = useState(resourceId);

  return (
    <>
      <RequestContextPopover entityType="workflow" entityId={workflowId} />
      <RunOptionsPopover
        entityType="workflow"
        entityId={workflowId}
        onOpenChange={open => {
          if (open) setResourceIdDraft(resourceId);
        }}
        onSaveExtra={() => setResourceId(resourceIdDraft)}
        extraFields={
          <TextFieldBlock
            name="workflow-run-resource-id"
            label="Resource ID"
            value={resourceIdDraft}
            onChange={event => setResourceIdDraft(event.target.value)}
            placeholder="e.g. tenant-42"
            helpText="Ignored when server auth derives the resource ID from the user."
          />
        }
      />
    </>
  );
}
