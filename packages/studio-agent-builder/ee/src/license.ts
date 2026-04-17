/**
 * Runtime license assertion helper for the Studio Agent Builder.
 *
 * Mirrors the pattern used by RBAC: enforcement happens at server boot, but
 * this helper is provided for downstream callers (e.g., custom adapters)
 * that need to check the license status programmatically.
 *
 * @license Mastra Enterprise License — see ../../LICENSE.md
 */

export async function assertAgentBuilderLicense(): Promise<void> {
  const { isEEEnabled, isFeatureEnabled } = await import('@mastra/core/auth/ee');
  if (!isEEEnabled() || !isFeatureEnabled('agent-builder')) {
    throw new Error(
      '[mastra/auth-ee] Agent Builder is configured but no valid EE license was found.\n' +
        'Agent Builder requires a Mastra Enterprise License for production use.\n' +
        'Set the MASTRA_EE_LICENSE environment variable with your license key.\n' +
        'Learn more: https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE',
    );
  }
}
