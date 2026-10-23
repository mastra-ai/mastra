import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { CaseService } from '../domain/case-service.js';

export function operationContext(caseService: CaseService, operatorId: string, requestContext?: RequestContext) {
  const threadId =
    (requestContext?.get('insuranceThreadId') as string | undefined) ??
    parseMemoryRequestContext(requestContext)?.thread?.id;
  return { operatorId, threadId: caseService.requireThread(threadId) };
}
