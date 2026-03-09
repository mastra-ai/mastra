import { useState, useMemo } from 'react';
import { FileJson, FormInput } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { CopyButton } from '@/ds/components/CopyButton';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { cn } from '@/lib/utils';
import { RequestContext } from '../request-context';
import { RequestContextSchemaForm } from '@/domains/request-context/components/request-context-schema-form';
import { useSchemaRequestContext } from '@/domains/request-context/context/schema-request-context';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

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
    return null;
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
  const { form } = useAgentEditFormContext();
  const variables = form.watch('variables') as Record<string, unknown> | undefined;
  const [mode, setMode] = useState<InputMode>('form');

  // Check if variables define any properties (i.e. there's an actual schema)
  const hasVariables =
    variables && typeof variables === 'object' && Object.keys((variables as any)?.properties ?? {}).length > 0;
  const hasSchemaForm = !!requestContextSchema || hasVariables;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
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
