import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import type { ServerContext } from '../server-adapter';

export function createTestServerContext({ mastra }: { mastra: Mastra }): ServerContext {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}
