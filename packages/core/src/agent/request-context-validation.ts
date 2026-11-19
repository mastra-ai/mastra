import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { RequestContext } from '../request-context';
import { getRequestContextInputValues } from '../request-context/input-source';
import type { StandardSchemaWithJSON } from '../schema';

export async function validateAgentRequestContext({
  requestContextSchema,
  requestContext,
  agentId,
  agentName,
}: {
  requestContextSchema?: StandardSchemaWithJSON<unknown>;
  requestContext?: RequestContext;
  agentId: string;
  agentName: string;
}) {
  if (!requestContextSchema) return;

  const contextValues = getRequestContextInputValues(requestContext);
  const validation = await requestContextSchema['~standard'].validate(contextValues);

  if (validation.issues) {
    const errorMessages = validation.issues
      .map(e => {
        const pathStr = e.path?.map(p => (typeof p === 'object' ? p.key : p)).join('.');
        return `- ${pathStr}: ${e.message}`;
      })
      .join('\n');
    throw new MastraError({
      id: 'AGENT_REQUEST_CONTEXT_VALIDATION_FAILED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Request context validation failed for agent '${agentId}':\n${errorMessages}`,
      details: { agentId, agentName },
    });
  }
}
