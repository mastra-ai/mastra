import type { RequestContext } from '@mastra/core/request-context';

export interface DynamicWorkflowAccessPolicy {
  /**
   * Resolve the trusted owner for the current Mastra Code request. The host
   * should read identity installed by its authentication middleware, never a
   * workflow id or owner supplied in tool input.
   *
   * Returning `null` or `undefined` fails closed for dynamic workflows.
   */
  resolveAuthorId: (context: {
    requestContext: RequestContext;
  }) => string | null | undefined | Promise<string | null | undefined>;
}

export class DynamicWorkflowAccessDeniedError extends Error {
  constructor() {
    super('Dynamic workflow not found.');
    this.name = 'DynamicWorkflowAccessDeniedError';
  }
}

export async function resolveDynamicWorkflowAuthorId(
  policy: DynamicWorkflowAccessPolicy | undefined,
  requestContext: RequestContext | undefined,
): Promise<string | undefined> {
  if (!policy) return undefined;
  if (!requestContext) return undefined;

  const authorId = await policy.resolveAuthorId({ requestContext });
  return typeof authorId === 'string' && authorId.length > 0 ? authorId : undefined;
}
