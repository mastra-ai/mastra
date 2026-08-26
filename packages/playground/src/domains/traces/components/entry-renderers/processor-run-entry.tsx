import { spanSubject } from '../../lib/humanize-span-name';
import type { EntryRendererProps } from './types';

export function ProcessorRunEntry({ span }: EntryRendererProps) {
  const mutations = span.attributes?.messageListMutations;
  const count = Array.isArray(mutations) ? mutations.length : 0;

  return (
    <p className="text-neutral6 text-ui-sm">
      {spanSubject(span)}
      {count > 0 ? <span className="text-neutral3"> — {count} message change(s)</span> : null}
    </p>
  );
}
