import { spanSubject } from '../../lib/humanize-span-name';
import type { EntryRendererProps } from './types';

/**
 * Only the model id: the turn's final answer gets its own row at the bottom of the timeline,
 * so echoing it here would say the same thing twice.
 */
export function ModelGenerationEntry({ span }: EntryRendererProps) {
  return <p className="text-neutral6 text-ui-smd font-mono">{spanSubject(span)}</p>;
}
