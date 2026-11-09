export const COMPUTER_IDENTITY_MISMATCH = 'computer identity mismatch between Agent and reserved request context';

export function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(value => typeof value === 'string' && value.trim().length > 0);
}

export function resolveComputerIdentity(input: {
  agentThreadId?: string;
  agentResourceId?: string;
  reservedThreadId?: string;
  reservedResourceId?: string;
}): { threadId?: string; resourceId?: string } {
  const agentThreadId = firstNonEmpty(input.agentThreadId);
  const agentResourceId = firstNonEmpty(input.agentResourceId);
  const reservedThreadId = firstNonEmpty(input.reservedThreadId);
  const reservedResourceId = firstNonEmpty(input.reservedResourceId);

  if (
    (reservedThreadId && agentThreadId && reservedThreadId !== agentThreadId) ||
    (reservedResourceId && agentResourceId && reservedResourceId !== agentResourceId)
  ) {
    throw new Error(COMPUTER_IDENTITY_MISMATCH);
  }

  return {
    threadId: reservedThreadId ?? agentThreadId,
    resourceId: reservedResourceId ?? agentResourceId,
  };
}
