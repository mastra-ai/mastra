import type { SpanRecord } from '../../types';
import { getModelFacts } from '../span-token-usage.utils';

/** What the panel calls a span: the model it ran, else its entity, else its name. */
export function getSpanTitle(span: SpanRecord): string {
  return getModelFacts(span).model ?? span.entityName ?? span.name;
}
