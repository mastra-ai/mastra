import { Notice } from '@mastra/playground-ui/components/Notice';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { isEmptyZodObject } from '@mastra/playground-ui/lib/form/is-empty-zod-object';
import { PlayIcon } from 'lucide-react';
import type { ZodType } from 'zod';
import { RequestContextPopover } from '@/domains/run-options/components/request-context-popover';

export interface ToolRequestProps {
  zodInputSchema: ZodType;
  isRunning: boolean;
  onRun: (data: unknown) => void;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

export function ToolRequest({
  zodInputSchema,
  isRunning,
  onRun,
  requestContextEntityType,
  requestContextEntityId,
}: ToolRequestProps) {
  const hasInputFields = !isEmptyZodObject(zodInputSchema);

  return (
    <SectionCard
      title="Request"
      description="Fill in the input and run the tool."
      action={<RequestContextPopover entityType={requestContextEntityType} entityId={requestContextEntityId} />}
    >
      <DynamicForm
        isSubmitLoading={isRunning}
        schema={zodInputSchema}
        onSubmit={onRun}
        submitButtonLabel="Run"
        submitButtonIcon={<PlayIcon />}
        submitButtonVariant="primary"
        className="space-y-4"
      >
        {!hasInputFields && <Notice variant="info">No input is required to run this tool.</Notice>}
      </DynamicForm>
    </SectionCard>
  );
}
