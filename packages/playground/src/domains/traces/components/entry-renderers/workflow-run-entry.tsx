import { spanSubject } from '../../lib/humanize-span-name';
import { ToolCallShell } from './tool-call-shell';
import type { EntryRendererProps } from './types';

/**
 * A workflow run is an invocation like any other on this page: it takes an input, returns an
 * output and can fail. It is drawn with the tool-call shell so it reads that way, with its status
 * as the header detail and its final state as the payload.
 *
 * That final state is all the conversation needs from it — `SpanRows` leaves the steps out, since
 * a dozen rows saying `add-letter success` bury the calls and answers around them. The full trace
 * still has them.
 */
export function WorkflowRunEntry({ span, adornment }: EntryRendererProps) {
  const status = span.attributes?.status;

  return (
    <ToolCallShell
      adornment={adornment}
      testId="workflow-run-entry"
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
