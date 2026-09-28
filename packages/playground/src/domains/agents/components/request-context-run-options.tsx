import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RequestContextLabel } from '@mastra/playground-ui/domains/request-context/components/request-context-label';
import { RequestContextSchemaForm } from '@mastra/playground-ui/domains/request-context/components/request-context-schema-form';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { FileJson, FormInput } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOptionalAgentEditFormContext } from '../context/agent-edit-form-context';
import { RequestContext } from './request-context';
import { useSchemaRequestContext } from '@/domains/request-context/context/schema-request-context';

interface AgentRequestContextRunOptionsProps {
  requestContextSchema?: string;
  freeformEditorClassName?: string;
  requestContextTooltip?: string;
}

type InputMode = 'form' | 'json';

function hasSchemaProperties(schema: Record<string, unknown> | undefined): schema is Record<string, unknown> {
  const properties = schema?.properties;
  return Boolean(
    properties && typeof properties === 'object' && !Array.isArray(properties) && Object.keys(properties).length > 0,
  );
}

/**
 * Renders a schema-driven form from the agent editor variables JSON schema.
 * Used when the agent has editor-defined variables but no code-level requestContextSchema.
 */
function VariablesRequestContextForm({
  labelTooltip,
  variablesSchema,
}: {
  labelTooltip?: string;
  variablesSchema: Record<string, unknown>;
}) {
  const { setSchemaValues, schemaValues } = useSchemaRequestContext();
  const localFormValuesStr = JSON.stringify(schemaValues);

  const zodSchema = useMemo(() => {
    try {
      return jsonSchemaToZodRuntime(variablesSchema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
    } catch (error) {
      console.error('Failed to parse variables schema:', error);
      return null;
    }
  }, [variablesSchema]);

  if (!zodSchema) {
    return (
      <div className="p-4">
        <Txt variant="caption" className="text-red-400">
          Failed to parse request context schema
        </Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RequestContextLabel tooltip={labelTooltip}>Request Context</RequestContextLabel>
        <CopyButton content={localFormValuesStr} />
      </div>

      <DynamicForm
        schema={zodSchema}
        onSubmit={setSchemaValues}
        submitButtonLabel="Save"
        defaultValues={schemaValues}
      />
    </div>
  );
}

function ModeSwitcher({ mode, onModeChange }: { mode: InputMode; onModeChange: (mode: InputMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
      <button
        type="button"
        aria-pressed={mode === 'form'}
        onClick={() => onModeChange('form')}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-caption',
          controlStateColorTransition,
          mode === 'form' ? 'bg-fill-hover text-foreground' : quietTextHover,
        )}
      >
        <Icon size="xs">
          <FormInput />
        </Icon>
        Form
      </button>
      <button
        type="button"
        aria-pressed={mode === 'json'}
        onClick={() => onModeChange('json')}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-caption',
          controlStateColorTransition,
          mode === 'json' ? 'bg-fill-hover text-foreground' : quietTextHover,
        )}
      >
        <Icon size="xs">
          <FileJson />
        </Icon>
        JSON
      </button>
    </div>
  );
}

export function AgentRequestContextRunOptionsBody({
  requestContextSchema,
  freeformEditorClassName,
  requestContextTooltip,
}: AgentRequestContextRunOptionsProps) {
  const formCtx = useOptionalAgentEditFormContext();
  const variables = formCtx?.form.watch('variables') as Record<string, unknown> | undefined;
  const [mode, setMode] = useState<InputMode>('form');

  const hasVariables = hasSchemaProperties(variables);
  const hasSchemaForm = Boolean(requestContextSchema) || hasVariables;

  const { schemaValues, setSchemaValues } = useSchemaRequestContext();

  return (
    <div className="space-y-4">
      {hasSchemaForm ? (
        <>
          <div className="flex items-center justify-end">
            <ModeSwitcher mode={mode} onModeChange={setMode} />
          </div>

          {mode === 'form' ? (
            requestContextSchema ? (
              <RequestContextSchemaForm
                requestContextSchema={requestContextSchema}
                labelTooltip={requestContextTooltip}
                values={schemaValues}
                onSave={setSchemaValues}
              />
            ) : hasVariables ? (
              <VariablesRequestContextForm variablesSchema={variables} labelTooltip={requestContextTooltip} />
            ) : null
          ) : (
            <RequestContext editorClassName={freeformEditorClassName} labelTooltip={requestContextTooltip} />
          )}
        </>
      ) : (
        <RequestContext editorClassName={freeformEditorClassName} labelTooltip={requestContextTooltip} />
      )}
    </div>
  );
}

export function AgentRequestContextRunOptions({ requestContextSchema }: AgentRequestContextRunOptionsProps) {
  return (
    <ScrollArea className="max-h-[500px]">
      <div className="p-4">
        <AgentRequestContextRunOptionsBody requestContextSchema={requestContextSchema} />
      </div>
    </ScrollArea>
  );
}
