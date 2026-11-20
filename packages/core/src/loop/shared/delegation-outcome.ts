import type { SpanTermination } from '../../observability/types';
import type { RequestContext } from '../../request-context';

// The hook and tool-result mapper share this live context, even when the next
// workflow step uses a different deserialized copy. Never put tracing causes on the wire.
const failures = new WeakMap<RequestContext, SpanTermination>();
export function recordDelegationFailure(context: RequestContext, cause: SpanTermination): void {
  failures.set(context, cause);
}
export function takeDelegationFailure(context: RequestContext): SpanTermination | undefined {
  const cause = failures.get(context);
  failures.delete(context);
  return cause;
}
