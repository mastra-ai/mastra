import { createHash } from 'node:crypto';

/** A tool ID is required for agent executions, but not for direct invocations. */
export function agentToolCallIdForWrite(execution: unknown): string | undefined {
  const agent = (execution as { agent?: unknown } | undefined)?.agent;
  if (agent === undefined) return undefined;
  const toolCallId = (agent as { toolCallId?: unknown } | null)?.toolCallId;
  if (typeof toolCallId !== 'string' || toolCallId.trim().length === 0) {
    throw new Error('Agent GitHub writes require the active tool call ID for idempotency.');
  }
  return toolCallId;
}

/**
 * Build a provider idempotency key from tenant and session values resolved by
 * Factory plus the execution's stable operation id. Raw identifiers stay out
 * of the header, and JSON framing avoids ambiguous concatenations.
 */
export function factoryGithubIdempotencyKey(input: {
  orgId: string;
  factoryProjectId: string;
  projectRepositoryId: string;
  repositoryId: string;
  threadId: string;
  operation: string;
  operationId: string;
}): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify([
        input.orgId,
        input.factoryProjectId,
        input.projectRepositoryId,
        input.repositoryId,
        input.threadId,
        input.operation,
        input.operationId,
      ]),
    )
    .digest('hex');
  return `factory-github:v1:${digest}`;
}
