import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { RequestContextSchemaForm } from '@mastra/playground-ui/domains/request-context';
import { RUN_OPTIONS_EDITOR_HEIGHT, RunOptionsPopover } from '@mastra/playground-ui/domains/run-options';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useState } from 'react';
import { stringify } from 'superjson';

import { useOptionalAgentEditFormContext } from '../context/agent-edit-form-context';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

export const RUN_OPTIONS_SHORTCUT = 'u';

const REQUEST_CONTEXT_TOOLTIP = 'Request context values are passed into experiments and test chats.';

function hasSchemaProperties(schema: Record<string, unknown> | undefined): schema is Record<string, unknown> {
  const properties = schema?.properties;
  return Boolean(
    properties && typeof properties === 'object' && !Array.isArray(properties) && Object.keys(properties).length > 0,
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
      <RequestContextSchemaForm requestContextSchema={stringify(variables)} labelTooltip={REQUEST_CONTEXT_TOOLTIP} />
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
