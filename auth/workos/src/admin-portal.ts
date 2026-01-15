/**
 * WorkOS Admin Portal integration for customer self-service configuration.
 *
 * The Admin Portal allows enterprise customers to configure their own:
 * - SSO connections (SAML, OIDC)
 * - Directory Sync (SCIM)
 * - Audit log viewing and export
 * - Log streaming to SIEM systems
 *
 * @module
 */

import { type WorkOS, GeneratePortalLinkIntent } from '@workos-inc/node';

import type { AdminPortalIntent, WorkOSAdminPortalOptions } from './types.js';

/**
 * Maps our AdminPortalIntent type to WorkOS GeneratePortalLinkIntent enum.
 */
const INTENT_MAP: Record<AdminPortalIntent, GeneratePortalLinkIntent> = {
  sso: GeneratePortalLinkIntent.SSO,
  dsync: GeneratePortalLinkIntent.DSync,
  audit_logs: GeneratePortalLinkIntent.AuditLogs,
  log_streams: GeneratePortalLinkIntent.LogStreams,
};

/**
 * Generates links to the WorkOS Admin Portal for customer self-service configuration.
 *
 * The Admin Portal provides a pre-built UI where enterprise customers can manage
 * their own identity configuration without developer intervention.
 *
 * @example
 * ```typescript
 * import { WorkOS } from '@workos-inc/node';
 * import { WorkOSAdminPortal } from '@mastra/workos';
 *
 * const workos = new WorkOS(process.env.WORKOS_API_KEY);
 * const adminPortal = new WorkOSAdminPortal(workos, {
 *   returnUrl: 'https://app.example.com/settings',
 * });
 *
 * // Generate a link for SSO configuration
 * const ssoLink = await adminPortal.getPortalLink('org_01H...', 'sso');
 *
 * // Generate a link for Directory Sync configuration
 * const dsyncLink = await adminPortal.getPortalLink('org_01H...', 'dsync');
 *
 * // Redirect the user to the generated link
 * ```
 */
export class WorkOSAdminPortal {
  private workos: WorkOS;
  private returnUrl: string;

  /**
   * Creates a new WorkOSAdminPortal instance.
   *
   * @param workos - The WorkOS client instance
   * @param options - Configuration options for the Admin Portal
   */
  constructor(workos: WorkOS, options?: WorkOSAdminPortalOptions) {
    this.workos = workos;
    this.returnUrl = options?.returnUrl ?? '/';
  }

  /**
   * Generates a link to the WorkOS Admin Portal for a specific organization.
   *
   * The generated link is a one-time use URL that expires after a short period.
   * Users should be redirected to this link immediately after generation.
   *
   * @param organizationId - The WorkOS organization ID (e.g., 'org_01H...')
   * @param intent - The portal section to open. Determines what the user can configure:
   *   - `'sso'`: Configure SSO connections (SAML, OIDC providers)
   *   - `'dsync'`: Configure Directory Sync (SCIM provisioning)
   *   - `'audit_logs'`: View and export audit logs
   *   - `'log_streams'`: Configure log streaming to external SIEM systems
   * @returns A promise that resolves to the Admin Portal URL
   *
   * @example
   * ```typescript
   * // SSO configuration (default)
   * const link = await adminPortal.getPortalLink('org_01H...');
   *
   * // Directory Sync configuration
   * const link = await adminPortal.getPortalLink('org_01H...', 'dsync');
   *
   * // Audit logs viewing
   * const link = await adminPortal.getPortalLink('org_01H...', 'audit_logs');
   * ```
   */
  async getPortalLink(organizationId: string, intent?: AdminPortalIntent): Promise<string> {
    const result = await this.workos.portal.generateLink({
      organization: organizationId,
      intent: INTENT_MAP[intent ?? 'sso'],
      returnUrl: this.returnUrl,
    });

    return result.link;
  }
}
