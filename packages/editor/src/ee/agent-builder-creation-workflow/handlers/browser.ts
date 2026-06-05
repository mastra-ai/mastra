/**
 * Resolve whether browser access is enabled for the agent. Infra-agnostic.
 */
export function resolveBrowserEnabled(browserEnabled?: boolean): boolean | undefined {
  return typeof browserEnabled === 'boolean' ? browserEnabled : undefined;
}
