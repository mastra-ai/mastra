import { spanSubject } from '../../lib/humanize-span-name';
import { ToolCallShell } from './tool-call-shell';
import type { EntryRendererProps } from './types';

/**
 * A processor run is an invocation like a tool call: it receives the message list, may rewrite it
 * and returns a verdict. It is drawn with the same shell, opening onto its three payloads —
 * what it received, the runner bookkeeping around it, and what it produced.
 */
export function ProcessorRunEntry({ span, adornment }: EntryRendererProps) {
  const mutations = span.attributes?.messageListMutations;
  const count = Array.isArray(mutations) ? mutations.length : 0;

  return (
    <ToolCallShell
      adornment={adornment}
      testId="processor-run-entry"
      failed={Boolean(span.error)}
      error={span.error}
      label={spanSubject(span)}
      detail={count > 0 ? `${count} message change(s)` : undefined}
      sections={[
        { label: 'Input', value: span.input },
        { label: 'Metadata', value: span.attributes },
        { label: 'Output', value: span.output },
      ]}
    />
  );
}
