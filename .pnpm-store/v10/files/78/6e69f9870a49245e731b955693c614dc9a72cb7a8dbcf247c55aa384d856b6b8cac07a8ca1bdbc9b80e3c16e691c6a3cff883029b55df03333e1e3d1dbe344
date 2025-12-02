import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as PoliciesAPI from "../policies.js";
import * as ApplicationsAPI from "./applications.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Policies extends APIResource {
    /**
     * Creates a policy applying exclusive to a single application that defines the
     * users or groups who can reach it. We recommend creating a reusable policy
     * instead and subsequently referencing its ID in the application's 'policies'
     * array.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.create(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    create(appId: string, params: PolicyCreateParams, options?: Core.RequestOptions): Core.APIPromise<PolicyCreateResponse>;
    /**
     * Updates an Access policy specific to an application. To update a reusable
     * policy, use the /account or zones/{account or zone_id}/policies/{uid} endpoint.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(appId: string, policyId: string, params: PolicyUpdateParams, options?: Core.RequestOptions): Core.APIPromise<PolicyUpdateResponse>;
    /**
     * Lists Access policies configured for an application. Returns both exclusively
     * scoped and reusable policies used by the application.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const policyListResponse of client.zeroTrust.access.applications.policies.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(appId: string, params?: PolicyListParams, options?: Core.RequestOptions): Core.PagePromise<PolicyListResponsesSinglePage, PolicyListResponse>;
    list(appId: string, options?: Core.RequestOptions): Core.PagePromise<PolicyListResponsesSinglePage, PolicyListResponse>;
    /**
     * Deletes an Access policy specific to an application. To delete a reusable
     * policy, use the /account or zones/{account or zone_id}/policies/{uid} endpoint.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(appId: string, policyId: string, params?: PolicyDeleteParams, options?: Core.RequestOptions): Core.APIPromise<PolicyDeleteResponse>;
    delete(appId: string, policyId: string, options?: Core.RequestOptions): Core.APIPromise<PolicyDeleteResponse>;
    /**
     * Fetches a single Access policy configured for an application. Returns both
     * exclusively owned and reusable policies used by the application.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(appId: string, policyId: string, params?: PolicyGetParams, options?: Core.RequestOptions): Core.APIPromise<PolicyGetResponse>;
    get(appId: string, policyId: string, options?: Core.RequestOptions): Core.APIPromise<PolicyGetResponse>;
}
export declare class PolicyListResponsesSinglePage extends SinglePage<PolicyListResponse> {
}
/**
 * Enforces a device posture rule has run successfully
 */
export interface AccessDevicePostureRule {
    device_posture: AccessDevicePostureRule.DevicePosture;
}
export declare namespace AccessDevicePostureRule {
    interface DevicePosture {
        /**
         * The ID of a device posture integration.
         */
        integration_uid: string;
    }
}
/**
 * Enforces a device posture rule has run successfully
 */
export interface AccessDevicePostureRuleParam {
    device_posture: AccessDevicePostureRuleParam.DevicePosture;
}
export declare namespace AccessDevicePostureRuleParam {
    interface DevicePosture {
        /**
         * The ID of a device posture integration.
         */
        integration_uid: string;
    }
}
/**
 * Matches an Access group.
 */
export type AccessRule = GroupRule | AnyValidServiceTokenRule | AccessRule.AccessAuthContextRule | AuthenticationMethodRule | AzureGroupRule | CertificateRule | AccessRule.AccessCommonNameRule | CountryRule | AccessDevicePostureRule | DomainRule | EmailListRule | EmailRule | EveryoneRule | ExternalEvaluationRule | GitHubOrganizationRule | GSuiteGroupRule | AccessRule.AccessLoginMethodRule | IPListRule | IPRule | OktaGroupRule | SAMLGroupRule | AccessRule.AccessOIDCClaimRule | ServiceTokenRule;
export declare namespace AccessRule {
    /**
     * Matches an Azure Authentication Context. Requires an Azure identity provider.
     */
    interface AccessAuthContextRule {
        auth_context: AccessAuthContextRule.AuthContext;
    }
    namespace AccessAuthContextRule {
        interface AuthContext {
            /**
             * The ID of an Authentication context.
             */
            id: string;
            /**
             * The ACID of an Authentication context.
             */
            ac_id: string;
            /**
             * The ID of your Azure identity provider.
             */
            identity_provider_id: string;
        }
    }
    /**
     * Matches a specific common name.
     */
    interface AccessCommonNameRule {
        common_name: AccessCommonNameRule.CommonName;
    }
    namespace AccessCommonNameRule {
        interface CommonName {
            /**
             * The common name to match.
             */
            common_name: string;
        }
    }
    /**
     * Matches a specific identity provider id.
     */
    interface AccessLoginMethodRule {
        login_method: AccessLoginMethodRule.LoginMethod;
    }
    namespace AccessLoginMethodRule {
        interface LoginMethod {
            /**
             * The ID of an identity provider.
             */
            id: string;
        }
    }
    /**
     * Matches an OIDC claim. Requires an OIDC identity provider.
     */
    interface AccessOIDCClaimRule {
        oidc: AccessOIDCClaimRule.OIDC;
    }
    namespace AccessOIDCClaimRule {
        interface OIDC {
            /**
             * The name of the OIDC claim.
             */
            claim_name: string;
            /**
             * The OIDC claim value to look for.
             */
            claim_value: string;
            /**
             * The ID of your OIDC identity provider.
             */
            identity_provider_id: string;
        }
    }
}
/**
 * Matches an Access group.
 */
export type AccessRuleParam = GroupRuleParam | AnyValidServiceTokenRuleParam | AccessRuleParam.AccessAuthContextRule | AuthenticationMethodRuleParam | AzureGroupRuleParam | CertificateRuleParam | AccessRuleParam.AccessCommonNameRule | CountryRuleParam | AccessDevicePostureRuleParam | DomainRuleParam | EmailListRuleParam | EmailRuleParam | EveryoneRuleParam | ExternalEvaluationRuleParam | GitHubOrganizationRuleParam | GSuiteGroupRuleParam | AccessRuleParam.AccessLoginMethodRule | IPListRuleParam | IPRuleParam | OktaGroupRuleParam | SAMLGroupRuleParam | AccessRuleParam.AccessOIDCClaimRule | ServiceTokenRuleParam;
export declare namespace AccessRuleParam {
    /**
     * Matches an Azure Authentication Context. Requires an Azure identity provider.
     */
    interface AccessAuthContextRule {
        auth_context: AccessAuthContextRule.AuthContext;
    }
    namespace AccessAuthContextRule {
        interface AuthContext {
            /**
             * The ID of an Authentication context.
             */
            id: string;
            /**
             * The ACID of an Authentication context.
             */
            ac_id: string;
            /**
             * The ID of your Azure identity provider.
             */
            identity_provider_id: string;
        }
    }
    /**
     * Matches a specific common name.
     */
    interface AccessCommonNameRule {
        common_name: AccessCommonNameRule.CommonName;
    }
    namespace AccessCommonNameRule {
        interface CommonName {
            /**
             * The common name to match.
             */
            common_name: string;
        }
    }
    /**
     * Matches a specific identity provider id.
     */
    interface AccessLoginMethodRule {
        login_method: AccessLoginMethodRule.LoginMethod;
    }
    namespace AccessLoginMethodRule {
        interface LoginMethod {
            /**
             * The ID of an identity provider.
             */
            id: string;
        }
    }
    /**
     * Matches an OIDC claim. Requires an OIDC identity provider.
     */
    interface AccessOIDCClaimRule {
        oidc: AccessOIDCClaimRule.OIDC;
    }
    namespace AccessOIDCClaimRule {
        interface OIDC {
            /**
             * The name of the OIDC claim.
             */
            claim_name: string;
            /**
             * The OIDC claim value to look for.
             */
            claim_value: string;
            /**
             * The ID of your OIDC identity provider.
             */
            identity_provider_id: string;
        }
    }
}
/**
 * Matches any valid Access Service Token
 */
export interface AnyValidServiceTokenRule {
    /**
     * An empty object which matches on all service tokens.
     */
    any_valid_service_token: AnyValidServiceTokenRule.AnyValidServiceToken;
}
export declare namespace AnyValidServiceTokenRule {
    /**
     * An empty object which matches on all service tokens.
     */
    interface AnyValidServiceToken {
    }
}
/**
 * Matches any valid Access Service Token
 */
export interface AnyValidServiceTokenRuleParam {
    /**
     * An empty object which matches on all service tokens.
     */
    any_valid_service_token: AnyValidServiceTokenRuleParam.AnyValidServiceToken;
}
export declare namespace AnyValidServiceTokenRuleParam {
    /**
     * An empty object which matches on all service tokens.
     */
    interface AnyValidServiceToken {
    }
}
/**
 * Enforce different MFA options
 */
export interface AuthenticationMethodRule {
    auth_method: AuthenticationMethodRule.AuthMethod;
}
export declare namespace AuthenticationMethodRule {
    interface AuthMethod {
        /**
         * The type of authentication method
         * https://datatracker.ietf.org/doc/html/rfc8176#section-2.
         */
        auth_method: string;
    }
}
/**
 * Enforce different MFA options
 */
export interface AuthenticationMethodRuleParam {
    auth_method: AuthenticationMethodRuleParam.AuthMethod;
}
export declare namespace AuthenticationMethodRuleParam {
    interface AuthMethod {
        /**
         * The type of authentication method
         * https://datatracker.ietf.org/doc/html/rfc8176#section-2.
         */
        auth_method: string;
    }
}
/**
 * Matches an Azure group. Requires an Azure identity provider.
 */
export interface AzureGroupRule {
    azureAD: AzureGroupRule.AzureAD;
}
export declare namespace AzureGroupRule {
    interface AzureAD {
        /**
         * The ID of an Azure group.
         */
        id: string;
        /**
         * The ID of your Azure identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches an Azure group. Requires an Azure identity provider.
 */
export interface AzureGroupRuleParam {
    azureAD: AzureGroupRuleParam.AzureAD;
}
export declare namespace AzureGroupRuleParam {
    interface AzureAD {
        /**
         * The ID of an Azure group.
         */
        id: string;
        /**
         * The ID of your Azure identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches any valid client certificate.
 */
export interface CertificateRule {
    certificate: CertificateRule.Certificate;
}
export declare namespace CertificateRule {
    interface Certificate {
    }
}
/**
 * Matches any valid client certificate.
 */
export interface CertificateRuleParam {
    certificate: CertificateRuleParam.Certificate;
}
export declare namespace CertificateRuleParam {
    interface Certificate {
    }
}
/**
 * Matches a specific country
 */
export interface CountryRule {
    geo: CountryRule.Geo;
}
export declare namespace CountryRule {
    interface Geo {
        /**
         * The country code that should be matched.
         */
        country_code: string;
    }
}
/**
 * Matches a specific country
 */
export interface CountryRuleParam {
    geo: CountryRuleParam.Geo;
}
export declare namespace CountryRuleParam {
    interface Geo {
        /**
         * The country code that should be matched.
         */
        country_code: string;
    }
}
/**
 * Match an entire email domain.
 */
export interface DomainRule {
    email_domain: DomainRule.EmailDomain;
}
export declare namespace DomainRule {
    interface EmailDomain {
        /**
         * The email domain to match.
         */
        domain: string;
    }
}
/**
 * Match an entire email domain.
 */
export interface DomainRuleParam {
    email_domain: DomainRuleParam.EmailDomain;
}
export declare namespace DomainRuleParam {
    interface EmailDomain {
        /**
         * The email domain to match.
         */
        domain: string;
    }
}
/**
 * Matches an email address from a list.
 */
export interface EmailListRule {
    email_list: EmailListRule.EmailList;
}
export declare namespace EmailListRule {
    interface EmailList {
        /**
         * The ID of a previously created email list.
         */
        id: string;
    }
}
/**
 * Matches an email address from a list.
 */
export interface EmailListRuleParam {
    email_list: EmailListRuleParam.EmailList;
}
export declare namespace EmailListRuleParam {
    interface EmailList {
        /**
         * The ID of a previously created email list.
         */
        id: string;
    }
}
/**
 * Matches a specific email.
 */
export interface EmailRule {
    email: EmailRule.Email;
}
export declare namespace EmailRule {
    interface Email {
        /**
         * The email of the user.
         */
        email: string;
    }
}
/**
 * Matches a specific email.
 */
export interface EmailRuleParam {
    email: EmailRuleParam.Email;
}
export declare namespace EmailRuleParam {
    interface Email {
        /**
         * The email of the user.
         */
        email: string;
    }
}
/**
 * Matches everyone.
 */
export interface EveryoneRule {
    /**
     * An empty object which matches on all users.
     */
    everyone: EveryoneRule.Everyone;
}
export declare namespace EveryoneRule {
    /**
     * An empty object which matches on all users.
     */
    interface Everyone {
    }
}
/**
 * Matches everyone.
 */
export interface EveryoneRuleParam {
    /**
     * An empty object which matches on all users.
     */
    everyone: EveryoneRuleParam.Everyone;
}
export declare namespace EveryoneRuleParam {
    /**
     * An empty object which matches on all users.
     */
    interface Everyone {
    }
}
/**
 * Create Allow or Block policies which evaluate the user based on custom criteria.
 */
export interface ExternalEvaluationRule {
    external_evaluation: ExternalEvaluationRule.ExternalEvaluation;
}
export declare namespace ExternalEvaluationRule {
    interface ExternalEvaluation {
        /**
         * The API endpoint containing your business logic.
         */
        evaluate_url: string;
        /**
         * The API endpoint containing the key that Access uses to verify that the response
         * came from your API.
         */
        keys_url: string;
    }
}
/**
 * Create Allow or Block policies which evaluate the user based on custom criteria.
 */
export interface ExternalEvaluationRuleParam {
    external_evaluation: ExternalEvaluationRuleParam.ExternalEvaluation;
}
export declare namespace ExternalEvaluationRuleParam {
    interface ExternalEvaluation {
        /**
         * The API endpoint containing your business logic.
         */
        evaluate_url: string;
        /**
         * The API endpoint containing the key that Access uses to verify that the response
         * came from your API.
         */
        keys_url: string;
    }
}
/**
 * Matches a Github organization. Requires a Github identity provider.
 */
export interface GitHubOrganizationRule {
    'github-organization': GitHubOrganizationRule.GitHubOrganization;
}
export declare namespace GitHubOrganizationRule {
    interface GitHubOrganization {
        /**
         * The ID of your Github identity provider.
         */
        identity_provider_id: string;
        /**
         * The name of the organization.
         */
        name: string;
        /**
         * The name of the team
         */
        team?: string;
    }
}
/**
 * Matches a Github organization. Requires a Github identity provider.
 */
export interface GitHubOrganizationRuleParam {
    'github-organization': GitHubOrganizationRuleParam.GitHubOrganization;
}
export declare namespace GitHubOrganizationRuleParam {
    interface GitHubOrganization {
        /**
         * The ID of your Github identity provider.
         */
        identity_provider_id: string;
        /**
         * The name of the organization.
         */
        name: string;
        /**
         * The name of the team
         */
        team?: string;
    }
}
/**
 * Matches an Access group.
 */
export interface GroupRule {
    group: GroupRule.Group;
}
export declare namespace GroupRule {
    interface Group {
        /**
         * The ID of a previously created Access group.
         */
        id: string;
    }
}
/**
 * Matches an Access group.
 */
export interface GroupRuleParam {
    group: GroupRuleParam.Group;
}
export declare namespace GroupRuleParam {
    interface Group {
        /**
         * The ID of a previously created Access group.
         */
        id: string;
    }
}
/**
 * Matches a group in Google Workspace. Requires a Google Workspace identity
 * provider.
 */
export interface GSuiteGroupRule {
    gsuite: GSuiteGroupRule.GSuite;
}
export declare namespace GSuiteGroupRule {
    interface GSuite {
        /**
         * The email of the Google Workspace group.
         */
        email: string;
        /**
         * The ID of your Google Workspace identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches a group in Google Workspace. Requires a Google Workspace identity
 * provider.
 */
export interface GSuiteGroupRuleParam {
    gsuite: GSuiteGroupRuleParam.GSuite;
}
export declare namespace GSuiteGroupRuleParam {
    interface GSuite {
        /**
         * The email of the Google Workspace group.
         */
        email: string;
        /**
         * The ID of your Google Workspace identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches an IP address from a list.
 */
export interface IPListRule {
    ip_list: IPListRule.IPList;
}
export declare namespace IPListRule {
    interface IPList {
        /**
         * The ID of a previously created IP list.
         */
        id: string;
    }
}
/**
 * Matches an IP address from a list.
 */
export interface IPListRuleParam {
    ip_list: IPListRuleParam.IPList;
}
export declare namespace IPListRuleParam {
    interface IPList {
        /**
         * The ID of a previously created IP list.
         */
        id: string;
    }
}
/**
 * Matches an IP address block.
 */
export interface IPRule {
    ip: IPRule.IP;
}
export declare namespace IPRule {
    interface IP {
        /**
         * An IPv4 or IPv6 CIDR block.
         */
        ip: string;
    }
}
/**
 * Matches an IP address block.
 */
export interface IPRuleParam {
    ip: IPRuleParam.IP;
}
export declare namespace IPRuleParam {
    interface IP {
        /**
         * An IPv4 or IPv6 CIDR block.
         */
        ip: string;
    }
}
/**
 * Matches an Okta group. Requires an Okta identity provider.
 */
export interface OktaGroupRule {
    okta: OktaGroupRule.Okta;
}
export declare namespace OktaGroupRule {
    interface Okta {
        /**
         * The ID of your Okta identity provider.
         */
        identity_provider_id: string;
        /**
         * The name of the Okta group.
         */
        name: string;
    }
}
/**
 * Matches an Okta group. Requires an Okta identity provider.
 */
export interface OktaGroupRuleParam {
    okta: OktaGroupRuleParam.Okta;
}
export declare namespace OktaGroupRuleParam {
    interface Okta {
        /**
         * The ID of your Okta identity provider.
         */
        identity_provider_id: string;
        /**
         * The name of the Okta group.
         */
        name: string;
    }
}
/**
 * Matches a SAML group. Requires a SAML identity provider.
 */
export interface SAMLGroupRule {
    saml: SAMLGroupRule.SAML;
}
export declare namespace SAMLGroupRule {
    interface SAML {
        /**
         * The name of the SAML attribute.
         */
        attribute_name: string;
        /**
         * The SAML attribute value to look for.
         */
        attribute_value: string;
        /**
         * The ID of your SAML identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches a SAML group. Requires a SAML identity provider.
 */
export interface SAMLGroupRuleParam {
    saml: SAMLGroupRuleParam.SAML;
}
export declare namespace SAMLGroupRuleParam {
    interface SAML {
        /**
         * The name of the SAML attribute.
         */
        attribute_name: string;
        /**
         * The SAML attribute value to look for.
         */
        attribute_value: string;
        /**
         * The ID of your SAML identity provider.
         */
        identity_provider_id: string;
    }
}
/**
 * Matches a specific Access Service Token
 */
export interface ServiceTokenRule {
    service_token: ServiceTokenRule.ServiceToken;
}
export declare namespace ServiceTokenRule {
    interface ServiceToken {
        /**
         * The ID of a Service Token.
         */
        token_id: string;
    }
}
/**
 * Matches a specific Access Service Token
 */
export interface ServiceTokenRuleParam {
    service_token: ServiceTokenRuleParam.ServiceToken;
}
export declare namespace ServiceTokenRuleParam {
    interface ServiceToken {
        /**
         * The ID of a Service Token.
         */
        token_id: string;
    }
}
export interface PolicyCreateResponse {
    /**
     * The UUID of the policy
     */
    id?: string;
    /**
     * Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroup>;
    /**
     * Requires the user to request access from an administrator at the start of each
     * session.
     */
    approval_required?: boolean;
    created_at?: string;
    /**
     * The action Access will take if a user matches this policy. Infrastructure
     * application policies can only use the Allow action.
     */
    decision?: ApplicationsAPI.Decision;
    /**
     * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<AccessRule>;
    /**
     * Require this application to be served in an isolated browser for users matching
     * this policy. 'Client Web Isolation' must be on for the account in order to use
     * this feature.
     */
    isolation_required?: boolean;
    /**
     * The name of the Access policy.
     */
    name?: string;
    /**
     * The order of execution for this policy. Must be unique for each policy within an
     * app.
     */
    precedence?: number;
    /**
     * A custom message that will appear on the purpose justification screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Require users to enter a justification when they log in to the application.
     */
    purpose_justification_required?: boolean;
    /**
     * Rules evaluated with an AND logical operator. To match the policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<AccessRule>;
    /**
     * The amount of time that tokens issued for the application will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h.
     */
    session_duration?: string;
    updated_at?: string;
}
export interface PolicyUpdateResponse {
    /**
     * The UUID of the policy
     */
    id?: string;
    /**
     * Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroup>;
    /**
     * Requires the user to request access from an administrator at the start of each
     * session.
     */
    approval_required?: boolean;
    created_at?: string;
    /**
     * The action Access will take if a user matches this policy. Infrastructure
     * application policies can only use the Allow action.
     */
    decision?: ApplicationsAPI.Decision;
    /**
     * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<AccessRule>;
    /**
     * Require this application to be served in an isolated browser for users matching
     * this policy. 'Client Web Isolation' must be on for the account in order to use
     * this feature.
     */
    isolation_required?: boolean;
    /**
     * The name of the Access policy.
     */
    name?: string;
    /**
     * The order of execution for this policy. Must be unique for each policy within an
     * app.
     */
    precedence?: number;
    /**
     * A custom message that will appear on the purpose justification screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Require users to enter a justification when they log in to the application.
     */
    purpose_justification_required?: boolean;
    /**
     * Rules evaluated with an AND logical operator. To match the policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<AccessRule>;
    /**
     * The amount of time that tokens issued for the application will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h.
     */
    session_duration?: string;
    updated_at?: string;
}
export interface PolicyListResponse {
    /**
     * The UUID of the policy
     */
    id?: string;
    /**
     * Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroup>;
    /**
     * Requires the user to request access from an administrator at the start of each
     * session.
     */
    approval_required?: boolean;
    created_at?: string;
    /**
     * The action Access will take if a user matches this policy. Infrastructure
     * application policies can only use the Allow action.
     */
    decision?: ApplicationsAPI.Decision;
    /**
     * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<AccessRule>;
    /**
     * Require this application to be served in an isolated browser for users matching
     * this policy. 'Client Web Isolation' must be on for the account in order to use
     * this feature.
     */
    isolation_required?: boolean;
    /**
     * The name of the Access policy.
     */
    name?: string;
    /**
     * The order of execution for this policy. Must be unique for each policy within an
     * app.
     */
    precedence?: number;
    /**
     * A custom message that will appear on the purpose justification screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Require users to enter a justification when they log in to the application.
     */
    purpose_justification_required?: boolean;
    /**
     * Rules evaluated with an AND logical operator. To match the policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<AccessRule>;
    /**
     * The amount of time that tokens issued for the application will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h.
     */
    session_duration?: string;
    updated_at?: string;
}
export interface PolicyDeleteResponse {
    /**
     * UUID.
     */
    id?: string;
}
export interface PolicyGetResponse {
    /**
     * The UUID of the policy
     */
    id?: string;
    /**
     * Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroup>;
    /**
     * Requires the user to request access from an administrator at the start of each
     * session.
     */
    approval_required?: boolean;
    created_at?: string;
    /**
     * The action Access will take if a user matches this policy. Infrastructure
     * application policies can only use the Allow action.
     */
    decision?: ApplicationsAPI.Decision;
    /**
     * Rules evaluated with a NOT logical operator. To match the policy, a user cannot
     * meet any of the Exclude rules.
     */
    exclude?: Array<AccessRule>;
    /**
     * Rules evaluated with an OR logical operator. A user needs to meet only one of
     * the Include rules.
     */
    include?: Array<AccessRule>;
    /**
     * Require this application to be served in an isolated browser for users matching
     * this policy. 'Client Web Isolation' must be on for the account in order to use
     * this feature.
     */
    isolation_required?: boolean;
    /**
     * The name of the Access policy.
     */
    name?: string;
    /**
     * The order of execution for this policy. Must be unique for each policy within an
     * app.
     */
    precedence?: number;
    /**
     * A custom message that will appear on the purpose justification screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Require users to enter a justification when they log in to the application.
     */
    purpose_justification_required?: boolean;
    /**
     * Rules evaluated with an AND logical operator. To match the policy, a user must
     * meet all of the Require rules.
     */
    require?: Array<AccessRule>;
    /**
     * The amount of time that tokens issued for the application will be valid. Must be
     * in the format `300ms` or `2h45m`. Valid time units are: ns, us (or µs), ms, s,
     * m, h.
     */
    session_duration?: string;
    updated_at?: string;
}
export interface PolicyCreateParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroupParam>;
    /**
     * Body param: Requires the user to request access from an administrator at the
     * start of each session.
     */
    approval_required?: boolean;
    /**
     * Body param: Require this application to be served in an isolated browser for
     * users matching this policy. 'Client Web Isolation' must be on for the account in
     * order to use this feature.
     */
    isolation_required?: boolean;
    /**
     * Body param: The order of execution for this policy. Must be unique for each
     * policy within an app.
     */
    precedence?: number;
    /**
     * Body param: A custom message that will appear on the purpose justification
     * screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Body param: Require users to enter a justification when they log in to the
     * application.
     */
    purpose_justification_required?: boolean;
    /**
     * Body param: The amount of time that tokens issued for the application will be
     * valid. Must be in the format `300ms` or `2h45m`. Valid time units are: ns, us
     * (or µs), ms, s, m, h.
     */
    session_duration?: string;
}
export interface PolicyUpdateParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Body param: Administrators who can approve a temporary authentication request.
     */
    approval_groups?: Array<PoliciesAPI.ApprovalGroupParam>;
    /**
     * Body param: Requires the user to request access from an administrator at the
     * start of each session.
     */
    approval_required?: boolean;
    /**
     * Body param: Require this application to be served in an isolated browser for
     * users matching this policy. 'Client Web Isolation' must be on for the account in
     * order to use this feature.
     */
    isolation_required?: boolean;
    /**
     * Body param: The order of execution for this policy. Must be unique for each
     * policy within an app.
     */
    precedence?: number;
    /**
     * Body param: A custom message that will appear on the purpose justification
     * screen.
     */
    purpose_justification_prompt?: string;
    /**
     * Body param: Require users to enter a justification when they log in to the
     * application.
     */
    purpose_justification_required?: boolean;
    /**
     * Body param: The amount of time that tokens issued for the application will be
     * valid. Must be in the format `300ms` or `2h45m`. Valid time units are: ns, us
     * (or µs), ms, s, m, h.
     */
    session_duration?: string;
}
export interface PolicyListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface PolicyDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface PolicyGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace Policies {
    export { type AccessDevicePostureRule as AccessDevicePostureRule, type AccessRule as AccessRule, type AnyValidServiceTokenRule as AnyValidServiceTokenRule, type AuthenticationMethodRule as AuthenticationMethodRule, type AzureGroupRule as AzureGroupRule, type CertificateRule as CertificateRule, type CountryRule as CountryRule, type DomainRule as DomainRule, type EmailListRule as EmailListRule, type EmailRule as EmailRule, type EveryoneRule as EveryoneRule, type ExternalEvaluationRule as ExternalEvaluationRule, type GitHubOrganizationRule as GitHubOrganizationRule, type GroupRule as GroupRule, type GSuiteGroupRule as GSuiteGroupRule, type IPListRule as IPListRule, type IPRule as IPRule, type OktaGroupRule as OktaGroupRule, type SAMLGroupRule as SAMLGroupRule, type ServiceTokenRule as ServiceTokenRule, type PolicyCreateResponse as PolicyCreateResponse, type PolicyUpdateResponse as PolicyUpdateResponse, type PolicyListResponse as PolicyListResponse, type PolicyDeleteResponse as PolicyDeleteResponse, type PolicyGetResponse as PolicyGetResponse, PolicyListResponsesSinglePage as PolicyListResponsesSinglePage, type PolicyCreateParams as PolicyCreateParams, type PolicyUpdateParams as PolicyUpdateParams, type PolicyListParams as PolicyListParams, type PolicyDeleteParams as PolicyDeleteParams, type PolicyGetParams as PolicyGetParams, };
}
//# sourceMappingURL=policies.d.ts.map