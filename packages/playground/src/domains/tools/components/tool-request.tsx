import { Txt } from '@mastra/playground-ui/components/Txt';
import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { isEmptyZodObject } from '@mastra/playground-ui/lib/form/is-empty-zod-object';
import { SettingsContainer, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
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
    <SettingsGroup>
      <SettingsHeader
        action={<RequestContextPopover entityType={requestContextEntityType} entityId={requestContextEntityId} />}
      >
        <SettingsTitle>Request</SettingsTitle>
      </SettingsHeader>
      <SettingsContainer>
        <div className="p-4">
          <DynamicForm
            isSubmitLoading={isRunning}
            schema={zodInputSchema}
            onSubmit={onRun}
            submitButtonLabel="Run"
            submitButtonIcon={<PlayIcon />}
            submitButtonVariant="primary"
            className="space-y-4"
          >
            {!hasInputFields && (
              <Txt variant="body-sm" tone="muted">
                This tool takes no input. Run it as is.
              </Txt>
            )}
          </DynamicForm>
        </div>
      </SettingsContainer>
    </SettingsGroup>
  );
}
