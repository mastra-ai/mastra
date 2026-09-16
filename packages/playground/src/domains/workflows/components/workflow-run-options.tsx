import { RUN_OPTIONS_EDITOR_HEIGHT, RunOptionsPopover } from '@mastra/playground-ui/domains/run-options';

import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

export interface WorkflowRunOptionsProps {
  requestContextSchema?: string;
}

/**
 * Workflow run options popover: request context + tracing options.
 * Rendered inside the trigger form; inner saves never submit the workflow.
 * Requires RequestContextProvider and TracingSettingsProvider.
 */
export const WorkflowRunOptions = ({ requestContextSchema }: WorkflowRunOptionsProps) => (
  <RunOptionsPopover
    triggerVariant="icon"
    align="end"
    testId="workflow-run-options-trigger"
    requestContextSchema={requestContextSchema}
    requestContextTooltip="Request context values are passed to this workflow run."
  >
    <TracingRunOptions className="px-0 py-0" editorClassName={RUN_OPTIONS_EDITOR_HEIGHT} hideTitle showEditorHeader />
  </RunOptionsPopover>
);
