import { RuntimeContext } from '@mastra/core/runtime-context';

export function parseClientRuntimeContext(runtimeContext?: RuntimeContext | Record<string, any>) {
  if (runtimeContext) {
    if (runtimeContext instanceof RuntimeContext) {
      return Object.fromEntries(runtimeContext.entries());
    }
    return runtimeContext;
  }
  return undefined;
}
