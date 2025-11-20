import { RequestContext } from '@mastra/core/request-context';
import type { RuntimeContext } from '../server-adapter';
import type { Mastra } from '@mastra/core';

export function createTestRuntimeContext({ mastra }: { mastra: Mastra }): RuntimeContext {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}
