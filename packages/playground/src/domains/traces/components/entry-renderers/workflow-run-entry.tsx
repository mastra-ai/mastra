import { spanSubject } from '../../lib/humanize-span-name';
import type { EntryRendererProps } from './types';

export function WorkflowRunEntry({ span }: EntryRendererProps) {
  const status = span.attributes?.status;

  return (
    <p className="text-neutral6 text-ui-smd">
      {spanSubject(span)}
      {typeof status === 'string' ? <span className="text-neutral3"> — {status}</span> : null}
    </p>
  );
}
