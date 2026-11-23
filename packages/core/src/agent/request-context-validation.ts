import type { StandardSchemaV1 } from '@standard-schema/spec';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';

export function throwAgentRequestContextValidationError({
  issues,
  agentId,
  agentName,
}: {
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
  agentId: string;
  agentName: string;
}) {
  const errorMessages = issues
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
