import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
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
          <Field>
            <FieldLabel>Resource ID</FieldLabel>
            <Input
              value={resourceIdDraft}
              onChange={event => setResourceIdDraft(event.target.value)}
              placeholder="e.g. tenant-42"
            />
            <FieldDescription>Ignored when server auth derives the resource ID from the user.</FieldDescription>
          </Field>
        }
      />
    </>
  );
}
