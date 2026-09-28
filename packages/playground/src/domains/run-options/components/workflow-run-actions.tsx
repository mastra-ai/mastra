import { TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import type { WorkflowRunActionsContext } from '@mastra/playground-ui/domains/workflows/workflow/workflow-trigger';
import { useState } from 'react';

import { RequestContextPopover } from './request-context-popover';
import { RunOptionsPopover } from './run-options-popover';

interface WorkflowRunActionsProps extends WorkflowRunActionsContext {
  workflowId: string;
  requestContextSchema?: string;
}

/** Trigger-form controls for a workflow. Requires a `TracingSettingsProvider` for the workflow. */
export function WorkflowRunActions({
  workflowId,
  requestContextSchema,
  resourceId,
  setResourceId,
}: WorkflowRunActionsProps) {
  const [resourceIdDraft, setResourceIdDraft] = useState(resourceId);

  return (
    <>
      <RequestContextPopover entityType="workflow" entityId={workflowId} requestContextSchema={requestContextSchema} />
      <RunOptionsPopover
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
