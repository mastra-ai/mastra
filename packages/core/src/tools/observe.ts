import { createObservabilityContext, SpanType } from '../observability';
import type { AnySpan, AIBaseAttributes } from '../observability';
import { executeWithContext } from '../observability/utils';
import type { ToolObserve } from './types';
import { noopObserve } from './types';

export function createToolObserve(span?: AnySpan): ToolObserve {
  if (!span?.isValid) {
    return noopObserve;
  }

  const logger = createObservabilityContext({ currentSpan: span }).loggerVNext;

  return {
    log(level, message, data) {
      logger[level](message, data);
    },
    async span(name, fn, attributes) {
      const childSpan = span.createChildSpan({
        type: SpanType.GENERIC,
        name,
        attributes: attributes as AIBaseAttributes,
      });

      try {
        const result = await executeWithContext({
          span: childSpan,
          fn: async () => fn(),
        });
        childSpan.end({ output: result });
        return result;
      } catch (error) {
        childSpan.error({ error: error instanceof Error ? error : new Error(String(error)), endSpan: true });
        throw error;
      }
    },
  };
}
