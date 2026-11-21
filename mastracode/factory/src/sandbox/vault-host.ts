/**
 * Sandbox providers factory ships that never attach the platform credential vault.
 * A host callback is `custom` and can return a vault sandbox, and any name we
 * don't ship might too, so those fail closed: an offline start by someone other
 * than the owner is refused until the running sandbox is confirmed token mode.
 */
const KNOWN_NON_VAULT_SANDBOX_PROVIDERS = new Set(['local', 'docker', 'e2b']);

export function sandboxHostMayUseCredentialVault(provider: string | undefined): boolean {
  return provider !== undefined && !KNOWN_NON_VAULT_SANDBOX_PROVIDERS.has(provider);
}
