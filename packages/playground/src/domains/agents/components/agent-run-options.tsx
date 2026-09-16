import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RequestContextLabel, useRequestContext } from '@mastra/playground-ui/domains/request-context';
import {
  RUN_OPTIONS_EDITOR_HEIGHT,
  RunOptionsPopover,
  useRunOptionsDraft,
} from '@mastra/playground-ui/domains/run-options';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useMemo, useState } from 'react';

import { useOptionalAgentEditFormContext } from '../context/agent-edit-form-context';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { DynamicForm } from '@/lib/form';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export const RUN_OPTIONS_SHORTCUT = 'u';

const REQUEST_CONTEXT_TOOLTIP = 'Request context values are passed into experiments and test chats.';

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
function VariablesRequestContextForm({ variablesSchema }: { variablesSchema: Record<string, unknown> }) {
  const { setRequestContext, requestContext } = useRequestContext();
  const [draft, setDraft] = useState<Record<string, unknown>>();
  const localFormValuesStr = JSON.stringify(draft ?? requestContext);

  useRunOptionsDraft({
    isDirty: draft !== undefined && localFormValuesStr !== JSON.stringify(requestContext),
    save: () => {
      if (draft) setRequestContext(draft);
      setDraft(undefined);
      return true;
    },
  });

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
        <Txt variant="ui-sm" className="text-red-400">
          Failed to parse request context schema
        </Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RequestContextLabel tooltip={REQUEST_CONTEXT_TOOLTIP}>Request Context</RequestContextLabel>
        <CopyButton content={localFormValuesStr} />
      </div>

      <DynamicForm schema={zodSchema} onValuesChange={setDraft} defaultValues={requestContext} />
    </div>
  );
}

interface AgentRunOptionsProps {
  requestContextSchema?: string;
  /** `icon` for the composer, `labelled` for the editor top bar (adds the `u` shortcut). */
  triggerVariant: 'icon' | 'labelled';
}

const TRIGGER_TEST_IDS = {
  icon: 'composer-run-options-trigger',
  labelled: 'agent-top-bar-run-options-trigger',
} as const;

/**
 * Agent run options popover: request context + tracing options.
 * Requires RequestContextProvider and TracingSettingsProvider.
 */
export function AgentRunOptions({ requestContextSchema, triggerVariant }: AgentRunOptionsProps) {
  const [open, setOpen] = useState(false);
  const formCtx = useOptionalAgentEditFormContext();
  const variables = formCtx?.form.watch('variables') as Record<string, unknown> | undefined;
  const isLabelled = triggerVariant === 'labelled';

  useKeydown({ [RUN_OPTIONS_SHORTCUT]: () => setOpen(previous => !previous) }, { enabled: isLabelled });

  const requestContextFormSlot =
    !requestContextSchema && hasSchemaProperties(variables) ? (
      <VariablesRequestContextForm variablesSchema={variables} />
    ) : undefined;

  return (
    <RunOptionsPopover
      triggerVariant={triggerVariant}
      align={isLabelled ? 'end' : 'start'}
      open={open}
      onOpenChange={setOpen}
      shortcutHint={isLabelled ? <Kbd size="xs">U</Kbd> : undefined}
      testId={TRIGGER_TEST_IDS[triggerVariant]}
      requestContextSchema={requestContextSchema}
      requestContextFormSlot={requestContextFormSlot}
      requestContextTooltip={REQUEST_CONTEXT_TOOLTIP}
    >
      <TracingRunOptions className="px-0 py-0" editorClassName={RUN_OPTIONS_EDITOR_HEIGHT} hideTitle showEditorHeader />
    </RunOptionsPopover>
  );
}
