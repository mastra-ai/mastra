import { spanSubject } from '../../lib/humanize-span-name';
import { ToolCallShell } from './tool-call-shell';
import type { EntryRendererProps } from './types';

/** A step of a workflow run, drawn like the run itself (see `WorkflowRunEntry`). */
export function WorkflowStepEntry({ span, adornment }: EntryRendererProps) {
  const status = span.attributes?.status;

  return (
    <ToolCallShell
      adornment={adornment}
      testId="workflow-step-entry"
      failed={Boolean(span.error)}
      label={spanSubject(span)}
      detail={typeof status === 'string' ? status : undefined}
      sections={[
        { label: 'Arguments', value: span.input },
        { label: 'Result', value: span.output },
      ]}
    />
  );
}
