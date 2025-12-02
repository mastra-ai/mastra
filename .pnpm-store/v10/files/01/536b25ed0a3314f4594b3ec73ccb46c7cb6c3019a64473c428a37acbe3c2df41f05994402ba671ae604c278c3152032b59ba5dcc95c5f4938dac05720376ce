import type { Instance } from '../resources/Instance';
import type { InstanceRestrictions } from '../resources/InstanceRestrictions';
import type { OrganizationSettings } from '../resources/OrganizationSettings';
import { AbstractAPI } from './AbstractApi';
type UpdateParams = {
    /**
     * Toggles test mode for this instance, allowing the use of test email addresses and phone numbers.
     *
     * @remarks Defaults to true for development instances.
     */
    testMode?: boolean | null | undefined;
    /**
     * Whether the instance should be using the HIBP service to check passwords for breaches
     */
    hibp?: boolean | null | undefined;
    /**
     * The "enhanced_email_deliverability" feature will send emails from "verifications@clerk.dev" instead of your domain.
     *
     * @remarks This can be helpful if you do not have a high domain reputation.
     */
    enhancedEmailDeliverability?: boolean | null | undefined;
    supportEmail?: string | null | undefined;
    clerkJsVersion?: string | null | undefined;
    developmentOrigin?: string | null | undefined;
    /**
     * For browser-like stacks such as browser extensions, Electron, or Capacitor.js the instance allowed origins need to be updated with the request origin value.
     *
     * @remarks For Chrome extensions popup, background, or service worker pages the origin is chrome-extension://extension_uiid. For Electron apps the default origin is http://localhost:3000. For Capacitor, the origin is capacitor://localhost.
     */
    allowedOrigins?: Array<string> | undefined;
    /**
     * Whether the instance should use URL-based session syncing in development mode (i.e. without third-party cookies).
     */
    urlBasedSessionSyncing?: boolean | null | undefined;
};
type UpdateRestrictionsParams = {
    allowlist?: boolean | null | undefined;
    blocklist?: boolean | null | undefined;
    blockEmailSubaddresses?: boolean | null | undefined;
    blockDisposableEmailDomains?: boolean | null | undefined;
    ignoreDotsForGmailAddresses?: boolean | null | undefined;
};
type UpdateOrganizationSettingsParams = {
    enabled?: boolean | null | undefined;
    maxAllowedMemberships?: number | null | undefined;
    adminDeleteEnabled?: boolean | null | undefined;
    domainsEnabled?: boolean | null | undefined;
    /**
     * Specifies which [enrollment modes](https://clerk.com/docs/organizations/verified-domains#enrollment-mode) to enable for your Organization Domains.
     *
     * @remarks Supported modes are 'automatic_invitation' & 'automatic_suggestion'.
     */
    domainsEnrollmentModes?: Array<string> | undefined;
    /**
     * Specifies what the default organization role is for an organization creator.
     */
    creatorRoleId?: string | null | undefined;
    /**
     * Specifies what the default organization role is for the organization domains.
     */
    domainsDefaultRoleId?: string | null | undefined;
};
export declare class InstanceAPI extends AbstractAPI {
    get(): Promise<Instance>;
    update(params: UpdateParams): Promise<void>;
    updateRestrictions(params: UpdateRestrictionsParams): Promise<InstanceRestrictions>;
    updateOrganizationSettings(params: UpdateOrganizationSettingsParams): Promise<OrganizationSettings>;
}
export {};
//# sourceMappingURL=InstanceApi.d.ts.map