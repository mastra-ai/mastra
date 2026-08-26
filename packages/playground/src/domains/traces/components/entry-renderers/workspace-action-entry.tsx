import { spanSubject } from '../../lib/humanize-span-name';
import type { EntryRendererProps } from './types';

export function WorkspaceActionEntry({ span }: EntryRendererProps) {
  const success = span.attributes?.success;

  return (
    <p className="text-neutral6 text-ui-smd">
      {spanSubject(span)}
      {success === false ? <span className="text-neutral3"> — failed</span> : null}
    </p>
  );
}
