import { createHash } from 'node:crypto';

function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(
        Object.keys(item as Record<string, unknown>)
          .sort()
          .map(key => [key, (item as Record<string, unknown>)[key]]),
      );
    }
    return item;
  });

  if (serialized === undefined) {
    throw new TypeError('Inline workspace configuration must be JSON-serializable');
  }
  return serialized;
}

export function createInlineWorkspaceIdentity(config: unknown): { configHash: string; workspaceId: string } {
  const configHash = createHash('sha256').update(stableStringify(config)).digest('hex').slice(0, 12);
  return { configHash, workspaceId: `inline-${configHash}` };
}
