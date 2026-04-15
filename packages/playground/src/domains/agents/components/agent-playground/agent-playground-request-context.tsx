import { CopyButton, ScrollArea, Txt, Icon, cn } from '@mastra/playground-ui';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { FileJson, FormInput } from 'lucide-react';
import { useState, useMemo } from 'react';

import { useOptionalAgentEditFormContext } from '../../context/agent-edit-form-context';
import { RequestContext } from '../request-context';
import { RequestContextSchemaForm } from '@/domains/request-context/components/request-context-schema-form';
import { useSchemaRequestContext } from '@/domains/request-context/context/schema-request-context';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';

interface AgentPlaygroundRequestContextProps {
  requestContextSchema?: string;
}

type InputMode = 'form' | 'json';

/**
 * Renders a schema-driven form from the agent's variables (JSON Schema).
 * Used when the agent has CMS-defined variables but no code-level requestContextSchema.
 */
function VariablesRequestContextForm({ variablesSchema }: { variablesSchema: Record<string, unknown> }) {
  const { setSchemaValues, schemaValues } = useSchemaRequestContext();
  const localFormValuesStr = JSON.stringify(schemaValues);

  const zodSchema = useMemo(() => {
    try {
      return resolveSerializedZodOutput(jsonSchemaToZod(variablesSchema as Parameters<typeof jsonSchemaToZod>[0]));
    } catch (error) {
      console.error('Failed to parse variables schema:', error);
      return null;
    }
  }, [variablesSchema]);

  if (!zodSchema) {
    return (
      <div className="p-4">
        <Txt variant="ui-sm" className="text-red-400">
          Failed to parse request context schema
        </Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Txt as="span" variant="ui-md" className="text-neutral3">
          Request Context
        </Txt>
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
    <div className="flex items-center gap-1 rounded-md border border-border1 p-0.5">
      <button
        type="button"
        aria-pressed={mode === 'form'}
        onClick={() => onModeChange('form')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
          mode === 'form' ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:text-neutral5',
        )}
      >
        <Icon size="sm">
          <FormInput />
        </Icon>
        Form
      </button>
      <button
        type="button"
        aria-pressed={mode === 'json'}
        onClick={() => onModeChange('json')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
          mode === 'json' ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:text-neutral5',
        )}
      >
        <Icon size="sm">
          <FileJson />
        </Icon>
        JSON
      </button>
    </div>
  );
}

export function AgentPlaygroundRequestContext({ requestContextSchema }: AgentPlaygroundRequestContextProps) {
  const formCtx = useOptionalAgentEditFormContext();
  const variables = formCtx?.form.watch('variables') as Record<string, unknown> | undefined;
  const [mode, setMode] = useState<InputMode>('form');

  // Check if variables define any properties (i.e. there's an actual schema)
  const hasVariables =
    variables && typeof variables === 'object' && Object.keys((variables as any)?.properties ?? {}).length > 0;
  const hasSchemaForm = !!requestContextSchema || hasVariables;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <Txt variant="ui-sm" className="text-neutral3">
          Request context values are passed into both experiments and test chats. Use them to trigger conditional flows
          in your agent's instructions and tools.
        </Txt>

        {hasSchemaForm ? (
          <>
            <div className="flex items-center justify-end">
              <ModeSwitcher mode={mode} onModeChange={setMode} />
            </div>

            {mode === 'form' ? (
              requestContextSchema ? (
                <RequestContextSchemaForm requestContextSchema={requestContextSchema} />
              ) : hasVariables ? (
                <VariablesRequestContextForm variablesSchema={variables} />
              ) : null
            ) : (
              <RequestContext />
            )}
          </>
        ) : (
          <RequestContext />
        )}
      </div>
    </ScrollArea>
  );
}
