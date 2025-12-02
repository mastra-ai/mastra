import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IdentityProvidersAPI from "./identity-providers.js";
import * as SCIMAPI from "./scim/scim.js";
import { SCIM } from "./scim/scim.js";
import { SinglePage } from "../../../pagination.js";
export declare class IdentityProviders extends APIResource {
    scim: SCIMAPI.SCIM;
    /**
     * Adds a new identity provider to Access.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.create({
     *     config: {},
     *     name: 'Widget Corps IDP',
     *     type: 'onetimepin',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    create(params: IdentityProviderCreateParams, options?: Core.RequestOptions): Core.APIPromise<IdentityProvider>;
    /**
     * Updates a configured identity provider.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       config: {},
     *       name: 'Widget Corps IDP',
     *       type: 'onetimepin',
     *       account_id: 'account_id',
     *     },
     *   );
     * ```
     */
    update(identityProviderId: string, params: IdentityProviderUpdateParams, options?: Core.RequestOptions): Core.APIPromise<IdentityProvider>;
    /**
     * Lists all configured identity providers.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const identityProviderListResponse of client.zeroTrust.identityProviders.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: IdentityProviderListParams, options?: Core.RequestOptions): Core.PagePromise<IdentityProviderListResponsesSinglePage, IdentityProviderListResponse>;
    list(options?: Core.RequestOptions): Core.PagePromise<IdentityProviderListResponsesSinglePage, IdentityProviderListResponse>;
    /**
     * Deletes an identity provider from Access.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(identityProviderId: string, params?: IdentityProviderDeleteParams, options?: Core.RequestOptions): Core.APIPromise<IdentityProviderDeleteResponse>;
    delete(identityProviderId: string, options?: Core.RequestOptions): Core.APIPromise<IdentityProviderDeleteResponse>;
    /**
     * Fetches a configured identity provider.
     *
     * @example
     * ```ts
     * const identityProvider =
     *   await client.zeroTrust.identityProviders.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(identityProviderId: string, params?: IdentityProviderGetParams, options?: Core.RequestOptions): Core.APIPromise<IdentityProvider>;
    get(identityProviderId: string, options?: Core.RequestOptions): Core.APIPromise<IdentityProvider>;
}
export declare class IdentityProviderListResponsesSinglePage extends SinglePage<IdentityProviderListResponse> {
}
export interface AzureAD {
    /**
     * The configuration parameters for the identity provider. To view the required
     * parameters for a specific provider, refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    config: AzureAD.Config;
    /**
     * The name of the identity provider, shown to users on the login page.
     */
    name: string;
    /**
     * The type of identity provider. To determine the value for a specific provider,
     * refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    type: IdentityProviderType;
    /**
     * UUID.
     */
    id?: string;
    /**
     * The configuration settings for enabling a System for Cross-Domain Identity
     * Management (SCIM) with the identity provider.
     */
    scim_config?: IdentityProviderSCIMConfig;
}
export declare namespace AzureAD {
    /**
     * The configuration parameters for the identity provider. To view the required
     * parameters for a specific provider, refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    interface Config {
        /**
         * Custom claims
         */
        claims?: Array<string>;
        /**
         * Your OAuth Client ID
         */
        client_id?: string;
        /**
         * Your OAuth Client Secret
         */
        client_secret?: string;
        /**
         * Should Cloudflare try to load authentication contexts from your account
         */
        conditional_access_enabled?: boolean;
        /**
         * Your Azure directory uuid
         */
        directory_id?: string;
        /**
         * The claim name for email in the id_token response.
         */
        email_claim_name?: string;
        /**
         * Indicates the type of user interaction that is required. prompt=login forces the
         * user to enter their credentials on that request, negating single-sign on.
         * prompt=none is the opposite. It ensures that the user isn't presented with any
         * interactive prompt. If the request can't be completed silently by using
         * single-sign on, the Microsoft identity platform returns an interaction_required
         * error. prompt=select_account interrupts single sign-on providing account
         * selection experience listing all the accounts either in session or any
         * remembered account or an option to choose to use a different account altogether.
         */
        prompt?: 'login' | 'select_account' | 'none';
        /**
         * Should Cloudflare try to load groups from your account
         */
        support_groups?: boolean;
    }
}
export interface AzureADParam {
    /**
     * The configuration parameters for the identity provider. To view the required
     * parameters for a specific provider, refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    config: AzureADParam.Config;
    /**
     * The name of the identity provider, shown to users on the login page.
     */
    name: string;
    /**
     * The type of identity provider. To determine the value for a specific provider,
     * refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    type: IdentityProviderTypeParam;
    /**
     * The configuration settings for enabling a System for Cross-Domain Identity
     * Management (SCIM) with the identity provider.
     */
    scim_config?: IdentityProviderSCIMConfigParam;
}
export declare namespace AzureADParam {
    /**
     * The configuration parameters for the identity provider. To view the required
     * parameters for a specific provider, refer to our
     * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
     */
    interface Config {
        /**
         * Custom claims
         */
        claims?: Array<string>;
        /**
         * Your OAuth Client ID
         */
        client_id?: string;
        /**
         * Your OAuth Client Secret
         */
        client_secret?: string;
        /**
         * Should Cloudflare try to load authentication contexts from your account
         */
        conditional_access_enabled?: boolean;
        /**
         * Your Azure directory uuid
         */
        directory_id?: string;
        /**
         * The claim name for email in the id_token response.
         */
        email_claim_name?: string;
        /**
         * Indicates the type of user interaction that is required. prompt=login forces the
         * user to enter their credentials on that request, negating single-sign on.
         * prompt=none is the opposite. It ensures that the user isn't presented with any
         * interactive prompt. If the request can't be completed silently by using
         * single-sign on, the Microsoft identity platform returns an interaction_required
         * error. prompt=select_account interrupts single sign-on providing account
         * selection experience listing all the accounts either in session or any
         * remembered account or an option to choose to use a different account altogether.
         */
        prompt?: 'login' | 'select_account' | 'none';
        /**
         * Should Cloudflare try to load groups from your account
         */
        support_groups?: boolean;
    }
}
export interface GenericOAuthConfig {
    /**
     * Your OAuth Client ID
     */
    client_id?: string;
    /**
     * Your OAuth Client Secret
     */
    client_secret?: string;
}
export interface GenericOAuthConfigParam {
    /**
     * Your OAuth Client ID
     */
    client_id?: string;
    /**
     * Your OAuth Client Secret
     */
    client_secret?: string;
}
export type IdentityProvider = AzureAD | IdentityProvider.AccessCentrify | IdentityProvider.AccessFacebook | IdentityProvider.AccessGitHub | IdentityProvider.AccessGoogle | IdentityProvider.AccessGoogleApps | IdentityProvider.AccessLinkedin | IdentityProvider.AccessOIDC | IdentityProvider.AccessOkta | IdentityProvider.AccessOnelogin | IdentityProvider.AccessPingone | IdentityProvider.AccessSAML | IdentityProvider.AccessYandex | IdentityProvider.AccessOnetimepin;
export declare namespace IdentityProvider {
    interface AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessCentrify.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your centrify account url
             */
            centrify_account?: string;
            /**
             * Your centrify app id
             */
            centrify_app_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessFacebook {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessGitHub {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogle.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogleApps.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your companies TLD
             */
            apps_domain?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessLinkedin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOIDC.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * The authorization_endpoint URL of your IdP
             */
            auth_url?: string;
            /**
             * The jwks_uri endpoint of your IdP to allow the IdP keys to sign the tokens
             */
            certs_url?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Enable Proof Key for Code Exchange (PKCE)
             */
            pkce_enabled?: boolean;
            /**
             * OAuth scopes
             */
            scopes?: Array<string>;
            /**
             * The token_endpoint URL of your IdP
             */
            token_url?: string;
        }
    }
    interface AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOkta.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your okta authorization server id
             */
            authorization_server_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your okta account url
             */
            okta_account?: string;
        }
    }
    interface AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnelogin.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your OneLogin account url
             */
            onelogin_account?: string;
        }
    }
    interface AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessPingone.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your PingOne environment identifier
             */
            ping_env_id?: string;
        }
    }
    interface AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessSAML.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * A list of SAML attribute names that will be added to your signed JWT token and
             * can be used in SAML policy rules.
             */
            attributes?: Array<string>;
            /**
             * The attribute name for email in the SAML response.
             */
            email_attribute_name?: string;
            /**
             * Add a list of attribute names that will be returned in the response header from
             * the Access callback.
             */
            header_attributes?: Array<Config.HeaderAttribute>;
            /**
             * X509 certificate to verify the signature in the SAML authentication response
             */
            idp_public_certs?: Array<string>;
            /**
             * IdP Entity ID or Issuer URL
             */
            issuer_url?: string;
            /**
             * Sign the SAML authentication request with Access credentials. To verify the
             * signature, use the public key from the Access certs endpoints.
             */
            sign_request?: boolean;
            /**
             * URL to send the SAML authentication requests to
             */
            sso_target_url?: string;
        }
        namespace Config {
            interface HeaderAttribute {
                /**
                 * attribute name from the IDP
                 */
                attribute_name?: string;
                /**
                 * header that will be added on the request to the origin
                 */
                header_name?: string;
            }
        }
    }
    interface AccessYandex {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnetimepin.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            redirect_url?: string;
        }
    }
}
export type IdentityProviderParam = AzureADParam | IdentityProviderParam.AccessCentrify | IdentityProviderParam.AccessFacebook | IdentityProviderParam.AccessGitHub | IdentityProviderParam.AccessGoogle | IdentityProviderParam.AccessGoogleApps | IdentityProviderParam.AccessLinkedin | IdentityProviderParam.AccessOIDC | IdentityProviderParam.AccessOkta | IdentityProviderParam.AccessOnelogin | IdentityProviderParam.AccessPingone | IdentityProviderParam.AccessSAML | IdentityProviderParam.AccessYandex | IdentityProviderParam.AccessOnetimepin;
export declare namespace IdentityProviderParam {
    interface AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessCentrify.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your centrify account url
             */
            centrify_account?: string;
            /**
             * Your centrify app id
             */
            centrify_app_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessFacebook {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfigParam;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    interface AccessGitHub {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfigParam;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    interface AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogle.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogleApps.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your companies TLD
             */
            apps_domain?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessLinkedin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfigParam;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    interface AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOIDC.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * The authorization_endpoint URL of your IdP
             */
            auth_url?: string;
            /**
             * The jwks_uri endpoint of your IdP to allow the IdP keys to sign the tokens
             */
            certs_url?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Enable Proof Key for Code Exchange (PKCE)
             */
            pkce_enabled?: boolean;
            /**
             * OAuth scopes
             */
            scopes?: Array<string>;
            /**
             * The token_endpoint URL of your IdP
             */
            token_url?: string;
        }
    }
    interface AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOkta.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your okta authorization server id
             */
            authorization_server_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your okta account url
             */
            okta_account?: string;
        }
    }
    interface AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnelogin.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your OneLogin account url
             */
            onelogin_account?: string;
        }
    }
    interface AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessPingone.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your PingOne environment identifier
             */
            ping_env_id?: string;
        }
    }
    interface AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessSAML.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * A list of SAML attribute names that will be added to your signed JWT token and
             * can be used in SAML policy rules.
             */
            attributes?: Array<string>;
            /**
             * The attribute name for email in the SAML response.
             */
            email_attribute_name?: string;
            /**
             * Add a list of attribute names that will be returned in the response header from
             * the Access callback.
             */
            header_attributes?: Array<Config.HeaderAttribute>;
            /**
             * X509 certificate to verify the signature in the SAML authentication response
             */
            idp_public_certs?: Array<string>;
            /**
             * IdP Entity ID or Issuer URL
             */
            issuer_url?: string;
            /**
             * Sign the SAML authentication request with Access credentials. To verify the
             * signature, use the public key from the Access certs endpoints.
             */
            sign_request?: boolean;
            /**
             * URL to send the SAML authentication requests to
             */
            sso_target_url?: string;
        }
        namespace Config {
            interface HeaderAttribute {
                /**
                 * attribute name from the IDP
                 */
                attribute_name?: string;
                /**
                 * header that will be added on the request to the origin
                 */
                header_name?: string;
            }
        }
    }
    interface AccessYandex {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfigParam;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    interface AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnetimepin.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderTypeParam;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
        }
    }
}
/**
 * The configuration settings for enabling a System for Cross-Domain Identity
 * Management (SCIM) with the identity provider.
 */
export interface IdentityProviderSCIMConfig {
    /**
     * A flag to enable or disable SCIM for the identity provider.
     */
    enabled?: boolean;
    /**
     * Indicates how a SCIM event updates a user identity used for policy evaluation.
     * Use "automatic" to automatically update a user's identity and augment it with
     * fields from the SCIM user resource. Use "reauth" to force re-authentication on
     * group membership updates, user identity update will only occur after successful
     * re-authentication. With "reauth" identities will not contain fields from the
     * SCIM user resource. With "no_action" identities will not be changed by SCIM
     * updates in any way and users will not be prompted to reauthenticate.
     */
    identity_update_behavior?: 'automatic' | 'reauth' | 'no_action';
    /**
     * The base URL of Cloudflare's SCIM V2.0 API endpoint.
     */
    scim_base_url?: string;
    /**
     * A flag to remove a user's seat in Zero Trust when they have been deprovisioned
     * in the Identity Provider. This cannot be enabled unless user_deprovision is also
     * enabled.
     */
    seat_deprovision?: boolean;
    /**
     * A read-only token generated when the SCIM integration is enabled for the first
     * time. It is redacted on subsequent requests. If you lose this you will need to
     * refresh it at /access/identity_providers/:idpID/refresh_scim_secret.
     */
    secret?: string;
    /**
     * A flag to enable revoking a user's session in Access and Gateway when they have
     * been deprovisioned in the Identity Provider.
     */
    user_deprovision?: boolean;
}
/**
 * The configuration settings for enabling a System for Cross-Domain Identity
 * Management (SCIM) with the identity provider.
 */
export interface IdentityProviderSCIMConfigParam {
    /**
     * A flag to enable or disable SCIM for the identity provider.
     */
    enabled?: boolean;
    /**
     * Indicates how a SCIM event updates a user identity used for policy evaluation.
     * Use "automatic" to automatically update a user's identity and augment it with
     * fields from the SCIM user resource. Use "reauth" to force re-authentication on
     * group membership updates, user identity update will only occur after successful
     * re-authentication. With "reauth" identities will not contain fields from the
     * SCIM user resource. With "no_action" identities will not be changed by SCIM
     * updates in any way and users will not be prompted to reauthenticate.
     */
    identity_update_behavior?: 'automatic' | 'reauth' | 'no_action';
    /**
     * A flag to remove a user's seat in Zero Trust when they have been deprovisioned
     * in the Identity Provider. This cannot be enabled unless user_deprovision is also
     * enabled.
     */
    seat_deprovision?: boolean;
    /**
     * A flag to enable revoking a user's session in Access and Gateway when they have
     * been deprovisioned in the Identity Provider.
     */
    user_deprovision?: boolean;
}
/**
 * The type of identity provider. To determine the value for a specific provider,
 * refer to our
 * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
 */
export type IdentityProviderType = 'onetimepin' | 'azureAD' | 'saml' | 'centrify' | 'facebook' | 'github' | 'google-apps' | 'google' | 'linkedin' | 'oidc' | 'okta' | 'onelogin' | 'pingone' | 'yandex';
/**
 * The type of identity provider. To determine the value for a specific provider,
 * refer to our
 * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
 */
export type IdentityProviderTypeParam = 'onetimepin' | 'azureAD' | 'saml' | 'centrify' | 'facebook' | 'github' | 'google-apps' | 'google' | 'linkedin' | 'oidc' | 'okta' | 'onelogin' | 'pingone' | 'yandex';
export type IdentityProviderListResponse = AzureAD | IdentityProviderListResponse.AccessCentrify | IdentityProviderListResponse.AccessFacebook | IdentityProviderListResponse.AccessGitHub | IdentityProviderListResponse.AccessGoogle | IdentityProviderListResponse.AccessGoogleApps | IdentityProviderListResponse.AccessLinkedin | IdentityProviderListResponse.AccessOIDC | IdentityProviderListResponse.AccessOkta | IdentityProviderListResponse.AccessOnelogin | IdentityProviderListResponse.AccessPingone | IdentityProviderListResponse.AccessSAML | IdentityProviderListResponse.AccessYandex;
export declare namespace IdentityProviderListResponse {
    interface AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessCentrify.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your centrify account url
             */
            centrify_account?: string;
            /**
             * Your centrify app id
             */
            centrify_app_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessFacebook {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessGitHub {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogle.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogleApps.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your companies TLD
             */
            apps_domain?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessLinkedin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    interface AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOIDC.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * The authorization_endpoint URL of your IdP
             */
            auth_url?: string;
            /**
             * The jwks_uri endpoint of your IdP to allow the IdP keys to sign the tokens
             */
            certs_url?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Enable Proof Key for Code Exchange (PKCE)
             */
            pkce_enabled?: boolean;
            /**
             * OAuth scopes
             */
            scopes?: Array<string>;
            /**
             * The token_endpoint URL of your IdP
             */
            token_url?: string;
        }
    }
    interface AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOkta.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your okta authorization server id
             */
            authorization_server_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your okta account url
             */
            okta_account?: string;
        }
    }
    interface AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnelogin.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your OneLogin account url
             */
            onelogin_account?: string;
        }
    }
    interface AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessPingone.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your PingOne environment identifier
             */
            ping_env_id?: string;
        }
    }
    interface AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessSAML.Config;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
    namespace AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * A list of SAML attribute names that will be added to your signed JWT token and
             * can be used in SAML policy rules.
             */
            attributes?: Array<string>;
            /**
             * The attribute name for email in the SAML response.
             */
            email_attribute_name?: string;
            /**
             * Add a list of attribute names that will be returned in the response header from
             * the Access callback.
             */
            header_attributes?: Array<Config.HeaderAttribute>;
            /**
             * X509 certificate to verify the signature in the SAML authentication response
             */
            idp_public_certs?: Array<string>;
            /**
             * IdP Entity ID or Issuer URL
             */
            issuer_url?: string;
            /**
             * Sign the SAML authentication request with Access credentials. To verify the
             * signature, use the public key from the Access certs endpoints.
             */
            sign_request?: boolean;
            /**
             * URL to send the SAML authentication requests to
             */
            sso_target_url?: string;
        }
        namespace Config {
            interface HeaderAttribute {
                /**
                 * attribute name from the IDP
                 */
                attribute_name?: string;
                /**
                 * header that will be added on the request to the origin
                 */
                header_name?: string;
            }
        }
    }
    interface AccessYandex {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: IdentityProvidersAPI.GenericOAuthConfig;
        /**
         * The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * The type of identity provider. To determine the value for a specific provider,
         * refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProvidersAPI.IdentityProviderType;
        /**
         * UUID.
         */
        id?: string;
        /**
         * The configuration settings for enabling a System for Cross-Domain Identity
         * Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProvidersAPI.IdentityProviderSCIMConfig;
    }
}
export interface IdentityProviderDeleteResponse {
    /**
     * UUID.
     */
    id?: string;
}
export type IdentityProviderCreateParams = IdentityProviderCreateParams.AzureAD | IdentityProviderCreateParams.AccessCentrify | IdentityProviderCreateParams.AccessFacebook | IdentityProviderCreateParams.AccessGitHub | IdentityProviderCreateParams.AccessGoogle | IdentityProviderCreateParams.AccessGoogleApps | IdentityProviderCreateParams.AccessLinkedin | IdentityProviderCreateParams.AccessOIDC | IdentityProviderCreateParams.AccessOkta | IdentityProviderCreateParams.AccessOnelogin | IdentityProviderCreateParams.AccessPingone | IdentityProviderCreateParams.AccessSAML | IdentityProviderCreateParams.AccessYandex | IdentityProviderCreateParams.AccessOnetimepin;
export declare namespace IdentityProviderCreateParams {
    interface AzureAD {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AzureAD.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AzureAD {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * Should Cloudflare try to load authentication contexts from your account
             */
            conditional_access_enabled?: boolean;
            /**
             * Your Azure directory uuid
             */
            directory_id?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Indicates the type of user interaction that is required. prompt=login forces the
             * user to enter their credentials on that request, negating single-sign on.
             * prompt=none is the opposite. It ensures that the user isn't presented with any
             * interactive prompt. If the request can't be completed silently by using
             * single-sign on, the Microsoft identity platform returns an interaction_required
             * error. prompt=select_account interrupts single sign-on providing account
             * selection experience listing all the accounts either in session or any
             * remembered account or an option to choose to use a different account altogether.
             */
            prompt?: 'login' | 'select_account' | 'none';
            /**
             * Should Cloudflare try to load groups from your account
             */
            support_groups?: boolean;
        }
    }
    interface AccessCentrify {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessCentrify.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your centrify account url
             */
            centrify_account?: string;
            /**
             * Your centrify app id
             */
            centrify_app_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessFacebook {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessGitHub {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessGoogle {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogle.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessGoogleApps {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogleApps.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your companies TLD
             */
            apps_domain?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessLinkedin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessOIDC {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOIDC.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * The authorization_endpoint URL of your IdP
             */
            auth_url?: string;
            /**
             * The jwks_uri endpoint of your IdP to allow the IdP keys to sign the tokens
             */
            certs_url?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Enable Proof Key for Code Exchange (PKCE)
             */
            pkce_enabled?: boolean;
            /**
             * OAuth scopes
             */
            scopes?: Array<string>;
            /**
             * The token_endpoint URL of your IdP
             */
            token_url?: string;
        }
    }
    interface AccessOkta {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOkta.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your okta authorization server id
             */
            authorization_server_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your okta account url
             */
            okta_account?: string;
        }
    }
    interface AccessOnelogin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnelogin.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your OneLogin account url
             */
            onelogin_account?: string;
        }
    }
    interface AccessPingone {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessPingone.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your PingOne environment identifier
             */
            ping_env_id?: string;
        }
    }
    interface AccessSAML {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessSAML.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * A list of SAML attribute names that will be added to your signed JWT token and
             * can be used in SAML policy rules.
             */
            attributes?: Array<string>;
            /**
             * The attribute name for email in the SAML response.
             */
            email_attribute_name?: string;
            /**
             * Add a list of attribute names that will be returned in the response header from
             * the Access callback.
             */
            header_attributes?: Array<Config.HeaderAttribute>;
            /**
             * X509 certificate to verify the signature in the SAML authentication response
             */
            idp_public_certs?: Array<string>;
            /**
             * IdP Entity ID or Issuer URL
             */
            issuer_url?: string;
            /**
             * Sign the SAML authentication request with Access credentials. To verify the
             * signature, use the public key from the Access certs endpoints.
             */
            sign_request?: boolean;
            /**
             * URL to send the SAML authentication requests to
             */
            sso_target_url?: string;
        }
        namespace Config {
            interface HeaderAttribute {
                /**
                 * attribute name from the IDP
                 */
                attribute_name?: string;
                /**
                 * header that will be added on the request to the origin
                 */
                header_name?: string;
            }
        }
    }
    interface AccessYandex {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessOnetimepin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnetimepin.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
        }
    }
}
export type IdentityProviderUpdateParams = IdentityProviderUpdateParams.AzureAD | IdentityProviderUpdateParams.AccessCentrify | IdentityProviderUpdateParams.AccessFacebook | IdentityProviderUpdateParams.AccessGitHub | IdentityProviderUpdateParams.AccessGoogle | IdentityProviderUpdateParams.AccessGoogleApps | IdentityProviderUpdateParams.AccessLinkedin | IdentityProviderUpdateParams.AccessOIDC | IdentityProviderUpdateParams.AccessOkta | IdentityProviderUpdateParams.AccessOnelogin | IdentityProviderUpdateParams.AccessPingone | IdentityProviderUpdateParams.AccessSAML | IdentityProviderUpdateParams.AccessYandex | IdentityProviderUpdateParams.AccessOnetimepin;
export declare namespace IdentityProviderUpdateParams {
    interface AzureAD {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AzureAD.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AzureAD {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * Should Cloudflare try to load authentication contexts from your account
             */
            conditional_access_enabled?: boolean;
            /**
             * Your Azure directory uuid
             */
            directory_id?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Indicates the type of user interaction that is required. prompt=login forces the
             * user to enter their credentials on that request, negating single-sign on.
             * prompt=none is the opposite. It ensures that the user isn't presented with any
             * interactive prompt. If the request can't be completed silently by using
             * single-sign on, the Microsoft identity platform returns an interaction_required
             * error. prompt=select_account interrupts single sign-on providing account
             * selection experience listing all the accounts either in session or any
             * remembered account or an option to choose to use a different account altogether.
             */
            prompt?: 'login' | 'select_account' | 'none';
            /**
             * Should Cloudflare try to load groups from your account
             */
            support_groups?: boolean;
        }
    }
    interface AccessCentrify {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessCentrify.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessCentrify {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your centrify account url
             */
            centrify_account?: string;
            /**
             * Your centrify app id
             */
            centrify_app_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessFacebook {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessGitHub {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessGoogle {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogle.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogle {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessGoogleApps {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessGoogleApps.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessGoogleApps {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your companies TLD
             */
            apps_domain?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
        }
    }
    interface AccessLinkedin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessOIDC {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOIDC.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOIDC {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * The authorization_endpoint URL of your IdP
             */
            auth_url?: string;
            /**
             * The jwks_uri endpoint of your IdP to allow the IdP keys to sign the tokens
             */
            certs_url?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Enable Proof Key for Code Exchange (PKCE)
             */
            pkce_enabled?: boolean;
            /**
             * OAuth scopes
             */
            scopes?: Array<string>;
            /**
             * The token_endpoint URL of your IdP
             */
            token_url?: string;
        }
    }
    interface AccessOkta {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOkta.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOkta {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Your okta authorization server id
             */
            authorization_server_id?: string;
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your okta account url
             */
            okta_account?: string;
        }
    }
    interface AccessOnelogin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnelogin.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnelogin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your OneLogin account url
             */
            onelogin_account?: string;
        }
    }
    interface AccessPingone {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessPingone.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessPingone {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * Custom claims
             */
            claims?: Array<string>;
            /**
             * Your OAuth Client ID
             */
            client_id?: string;
            /**
             * Your OAuth Client Secret
             */
            client_secret?: string;
            /**
             * The claim name for email in the id_token response.
             */
            email_claim_name?: string;
            /**
             * Your PingOne environment identifier
             */
            ping_env_id?: string;
        }
    }
    interface AccessSAML {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessSAML.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessSAML {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
            /**
             * A list of SAML attribute names that will be added to your signed JWT token and
             * can be used in SAML policy rules.
             */
            attributes?: Array<string>;
            /**
             * The attribute name for email in the SAML response.
             */
            email_attribute_name?: string;
            /**
             * Add a list of attribute names that will be returned in the response header from
             * the Access callback.
             */
            header_attributes?: Array<Config.HeaderAttribute>;
            /**
             * X509 certificate to verify the signature in the SAML authentication response
             */
            idp_public_certs?: Array<string>;
            /**
             * IdP Entity ID or Issuer URL
             */
            issuer_url?: string;
            /**
             * Sign the SAML authentication request with Access credentials. To verify the
             * signature, use the public key from the Access certs endpoints.
             */
            sign_request?: boolean;
            /**
             * URL to send the SAML authentication requests to
             */
            sso_target_url?: string;
        }
        namespace Config {
            interface HeaderAttribute {
                /**
                 * attribute name from the IDP
                 */
                attribute_name?: string;
                /**
                 * header that will be added on the request to the origin
                 */
                header_name?: string;
            }
        }
    }
    interface AccessYandex {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: GenericOAuthConfigParam;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    interface AccessOnetimepin {
        /**
         * Body param: The configuration parameters for the identity provider. To view the
         * required parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        config: AccessOnetimepin.Config;
        /**
         * Body param: The name of the identity provider, shown to users on the login page.
         */
        name: string;
        /**
         * Body param: The type of identity provider. To determine the value for a specific
         * provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        type: IdentityProviderTypeParam;
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
         * Body param: The configuration settings for enabling a System for Cross-Domain
         * Identity Management (SCIM) with the identity provider.
         */
        scim_config?: IdentityProviderSCIMConfigParam;
    }
    namespace AccessOnetimepin {
        /**
         * The configuration parameters for the identity provider. To view the required
         * parameters for a specific provider, refer to our
         * [developer documentation](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/).
         */
        interface Config {
        }
    }
}
export interface IdentityProviderListParams {
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
     * Query param: Indicates to Access to only retrieve identity providers that have
     * the System for Cross-Domain Identity Management (SCIM) enabled.
     */
    scim_enabled?: string;
}
export interface IdentityProviderDeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface IdentityProviderGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace IdentityProviders {
    export { type AzureAD as AzureAD, type GenericOAuthConfig as GenericOAuthConfig, type IdentityProvider as IdentityProvider, type IdentityProviderSCIMConfig as IdentityProviderSCIMConfig, type IdentityProviderType as IdentityProviderType, type IdentityProviderListResponse as IdentityProviderListResponse, type IdentityProviderDeleteResponse as IdentityProviderDeleteResponse, IdentityProviderListResponsesSinglePage as IdentityProviderListResponsesSinglePage, type IdentityProviderCreateParams as IdentityProviderCreateParams, type IdentityProviderUpdateParams as IdentityProviderUpdateParams, type IdentityProviderListParams as IdentityProviderListParams, type IdentityProviderDeleteParams as IdentityProviderDeleteParams, type IdentityProviderGetParams as IdentityProviderGetParams, };
    export { SCIM as SCIM };
}
//# sourceMappingURL=identity-providers.d.ts.map