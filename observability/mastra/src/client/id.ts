export function generateClientSignalId(): string {
  return globalThis.crypto.randomUUID();
}
