/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2018 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Interface representing base properties of a user-enrolled second factor for a
 * `CreateRequest`.
 */
export interface BaseCreateMultiFactorInfoRequest {
    /**
     * The optional display name for an enrolled second factor.
     */
    displayName?: string;
    /**
     * The type identifier of the second factor. For SMS second factors, this is `phone`.
     */
    factorId: string;
}
/**
 * Interface representing a phone specific user-enrolled second factor for a
 * `CreateRequest`.
 */
export interface CreatePhoneMultiFactorInfoRequest extends BaseCreateMultiFactorInfoRequest {
    /**
     * The phone number associated with a phone second factor.
     */
    phoneNumber: string;
}
/**
 * Type representing the properties of a user-enrolled second factor
 * for a `CreateRequest`.
 */
export type CreateMultiFactorInfoRequest = CreatePhoneMultiFactorInfoRequest;
/**
 * Interface representing common properties of a user-enrolled second factor
 * for an `UpdateRequest`.
 */
export interface BaseUpdateMultiFactorInfoRequest {
    /**
     * The ID of the enrolled second factor. This ID is unique to the user. When not provided,
     * a new one is provisioned by the Auth server.
     */
    uid?: string;
    /**
     * The optional display name for an enrolled second factor.
     */
    displayName?: string;
    /**
     * The optional date the second factor was enrolled, formatted as a UTC string.
     */
    enrollmentTime?: string;
    /**
     * The type identifier of the second factor. For SMS second factors, this is `phone`.
     */
    factorId: string;
}
/**
 * Interface representing a phone specific user-enrolled second factor
 * for an `UpdateRequest`.
 */
export interface UpdatePhoneMultiFactorInfoRequest extends BaseUpdateMultiFactorInfoRequest {
    /**
     * The phone number associated with a phone second factor.
     */
    phoneNumber: string;
}
/**
 * Type representing the properties of a user-enrolled second factor
 * for an `UpdateRequest`.
 */
export type UpdateMultiFactorInfoRequest = UpdatePhoneMultiFactorInfoRequest;
/**
 * The multi-factor related user settings for create operations.
 */
export interface MultiFactorCreateSettings {
    /**
     * The created user's list of enrolled second factors.
     */
    enrolledFactors: CreateMultiFactorInfoRequest[];
}
/**
 * The multi-factor related user settings for update operations.
 */
export interface MultiFactorUpdateSettings {
    /**
     * The updated list of enrolled second factors. The provided list overwrites the user's
     * existing list of second factors.
     * When null is passed, all of the user's existing second factors are removed.
     */
    enrolledFactors: UpdateMultiFactorInfoRequest[] | null;
}
/**
 * Interface representing the properties to update on the provided user.
 */
export interface UpdateRequest {
    /**
     * Whether or not the user is disabled: `true` for disabled;
     * `false` for enabled.
     */
    disabled?: boolean;
    /**
     * The user's display name.
     */
    displayName?: string | null;
    /**
     * The user's primary email.
     */
    email?: string;
    /**
     * Whether or not the user's primary email is verified.
     */
    emailVerified?: boolean;
    /**
     * The user's unhashed password.
     */
    password?: string;
    /**
     * The user's primary phone number.
     */
    phoneNumber?: string | null;
    /**
     * The user's photo URL.
     */
    photoURL?: string | null;
    /**
     * The user's updated multi-factor related properties.
     */
    multiFactor?: MultiFactorUpdateSettings;
    /**
     * Links this user to the specified provider.
     *
     * Linking a provider to an existing user account does not invalidate the
     * refresh token of that account. In other words, the existing account
     * would continue to be able to access resources, despite not having used
     * the newly linked provider to log in. If you wish to force the user to
     * authenticate with this new provider, you need to (a) revoke their
     * refresh token (see
     * https://firebase.google.com/docs/auth/admin/manage-sessions#revoke_refresh_tokens),
     * and (b) ensure no other authentication methods are present on this
     * account.
     */
    providerToLink?: UserProvider;
    /**
     * Unlinks this user from the specified providers.
     */
    providersToUnlink?: string[];
}
/**
 * Represents a user identity provider that can be associated with a Firebase user.
 */
export interface UserProvider {
    /**
     * The user identifier for the linked provider.
     */
    uid?: string;
    /**
     * The display name for the linked provider.
     */
    displayName?: string;
    /**
     * The email for the linked provider.
     */
    email?: string;
    /**
     * The phone number for the linked provider.
     */
    phoneNumber?: string;
    /**
     * The photo URL for the linked provider.
     */
    photoURL?: string;
    /**
     * The linked provider ID (for example, "google.com" for the Google provider).
     */
    providerId?: string;
}
/**
 * Interface representing the properties to set on a new user record to be
 * created.
 */
export interface CreateRequest extends UpdateRequest {
    /**
     * The user's `uid`.
     */
    uid?: string;
    /**
     * The user's multi-factor related properties.
     */
    multiFactor?: MultiFactorCreateSettings;
}
/**
 * The response interface for listing provider configs. This is only available
 * when listing all identity providers' configurations via
 * {@link BaseAuth.listProviderConfigs}.
 */
export interface ListProviderConfigResults {
    /**
     * The list of providers for the specified type in the current page.
     */
    providerConfigs: AuthProviderConfig[];
    /**
     * The next page token, if available.
     */
    pageToken?: string;
}
/**
 * The filter interface used for listing provider configurations. This is used
 * when specifying how to list configured identity providers via
 * {@link BaseAuth.listProviderConfigs}.
 */
export interface AuthProviderConfigFilter {
    /**
     * The Auth provider configuration filter. This can be either `saml` or `oidc`.
     * The former is used to look up SAML providers only, while the latter is used
     * for OIDC providers.
     */
    type: 'saml' | 'oidc';
    /**
     * The maximum number of results to return per page. The default and maximum is
     * 100.
     */
    maxResults?: number;
    /**
     * The next page token. When not specified, the lookup starts from the beginning
     * of the list.
     */
    pageToken?: string;
}
/**
 * The request interface for updating a SAML Auth provider. This is used
 * when updating a SAML provider's configuration via
 * {@link BaseAuth.updateProviderConfig}.
 */
export interface SAMLUpdateAuthProviderRequest {
    /**
     * The SAML provider's updated display name. If not provided, the existing
     * configuration's value is not modified.
     */
    displayName?: string;
    /**
     * Whether the SAML provider is enabled or not. If not provided, the existing
     * configuration's setting is not modified.
     */
    enabled?: boolean;
    /**
     * The SAML provider's updated IdP entity ID. If not provided, the existing
     * configuration's value is not modified.
     */
    idpEntityId?: string;
    /**
     * The SAML provider's updated SSO URL. If not provided, the existing
     * configuration's value is not modified.
     */
    ssoURL?: string;
    /**
     * The SAML provider's updated list of X.509 certificated. If not provided, the
     * existing configuration list is not modified.
     */
    x509Certificates?: string[];
    /**
     * The SAML provider's updated RP entity ID. If not provided, the existing
     * configuration's value is not modified.
     */
    rpEntityId?: string;
    /**
     * The SAML provider's callback URL. If not provided, the existing
     * configuration's value is not modified.
     */
    callbackURL?: string;
}
/**
 * The request interface for updating an OIDC Auth provider. This is used
 * when updating an OIDC provider's configuration via
 * {@link BaseAuth.updateProviderConfig}.
 */
export interface OIDCUpdateAuthProviderRequest {
    /**
     * The OIDC provider's updated display name. If not provided, the existing
     * configuration's value is not modified.
     */
    displayName?: string;
    /**
     * Whether the OIDC provider is enabled or not. If not provided, the existing
     * configuration's setting is not modified.
     */
    enabled?: boolean;
    /**
     * The OIDC provider's updated client ID. If not provided, the existing
     * configuration's value is not modified.
     */
    clientId?: string;
    /**
     * The OIDC provider's updated issuer. If not provided, the existing
     * configuration's value is not modified.
     */
    issuer?: string;
    /**
     * The OIDC provider's client secret to enable OIDC code flow.
     * If not provided, the existing configuration's value is not modified.
     */
    clientSecret?: string;
    /**
     * The OIDC provider's response object for OAuth authorization flow.
     */
    responseType?: OAuthResponseType;
}
export type UpdateAuthProviderRequest = SAMLUpdateAuthProviderRequest | OIDCUpdateAuthProviderRequest;
/** A maximum of 10 test phone number / code pairs can be configured. */
export declare const MAXIMUM_TEST_PHONE_NUMBERS = 10;
/** The server side SAML configuration request interface. */
export interface SAMLConfigServerRequest {
    idpConfig?: {
        idpEntityId?: string;
        ssoUrl?: string;
        idpCertificates?: Array<{
            x509Certificate: string;
        }>;
        signRequest?: boolean;
    };
    spConfig?: {
        spEntityId?: string;
        callbackUri?: string;
    };
    displayName?: string;
    enabled?: boolean;
    [key: string]: any;
}
/** The server side SAML configuration response interface. */
export interface SAMLConfigServerResponse {
    name?: string;
    idpConfig?: {
        idpEntityId?: string;
        ssoUrl?: string;
        idpCertificates?: Array<{
            x509Certificate: string;
        }>;
        signRequest?: boolean;
    };
    spConfig?: {
        spEntityId?: string;
        callbackUri?: string;
    };
    displayName?: string;
    enabled?: boolean;
}
/** The server side OIDC configuration request interface. */
export interface OIDCConfigServerRequest {
    clientId?: string;
    issuer?: string;
    displayName?: string;
    enabled?: boolean;
    clientSecret?: string;
    responseType?: OAuthResponseType;
    [key: string]: any;
}
/** The server side OIDC configuration response interface. */
export interface OIDCConfigServerResponse {
    name?: string;
    clientId?: string;
    issuer?: string;
    displayName?: string;
    enabled?: boolean;
    clientSecret?: string;
    responseType?: OAuthResponseType;
}
/** The server side email configuration request interface. */
export interface EmailSignInConfigServerRequest {
    allowPasswordSignup?: boolean;
    enableEmailLinkSignin?: boolean;
}
/** Identifies the server side second factor type. */
type AuthFactorServerType = 'PHONE_SMS';
/** Server side multi-factor configuration. */
export interface MultiFactorAuthServerConfig {
    state?: MultiFactorConfigState;
    enabledProviders?: AuthFactorServerType[];
    providerConfigs?: MultiFactorProviderConfig[];
}
/**
 * Identifies a second factor type.
 */
export type AuthFactorType = 'phone';
/**
 * Identifies a multi-factor configuration state.
 */
export type MultiFactorConfigState = 'ENABLED' | 'DISABLED';
/**
 * Interface representing a multi-factor configuration.
 * This can be used to define whether multi-factor authentication is enabled
 * or disabled and the list of second factor challenges that are supported.
 */
export interface MultiFactorConfig {
    /**
     * The multi-factor config state.
     */
    state: MultiFactorConfigState;
    /**
     * The list of identifiers for enabled second factors.
     * Currently only ‘phone’ is supported.
     */
    factorIds?: AuthFactorType[];
    /**
     * A list of multi-factor provider configurations.
     * MFA providers (except phone) indicate whether they're enabled through this field.   */
    providerConfigs?: MultiFactorProviderConfig[];
}
/**
 * Interface representing a multi-factor auth provider configuration.
 * This interface is used for second factor auth providers other than SMS.
 * Currently, only TOTP is supported.
 */ export interface MultiFactorProviderConfig {
    /**
     * Indicates whether this multi-factor provider is enabled or disabled.    */
    state: MultiFactorConfigState;
    /**
     * TOTP multi-factor provider config.   */
    totpProviderConfig?: TotpMultiFactorProviderConfig;
}
/**
 * Interface representing configuration settings for TOTP second factor auth.
 */
export interface TotpMultiFactorProviderConfig {
    /**
      *  The allowed number of adjacent intervals that will be used for verification
      *  to compensate for clock skew.   */
    adjacentIntervals?: number;
}
/**
 * Validates the provided map of test phone number / code pairs.
 * @param testPhoneNumbers - The phone number / code pairs to validate.
 */
export declare function validateTestPhoneNumbers(testPhoneNumbers: {
    [phoneNumber: string]: string;
}): void;
/**
 * The email sign in provider configuration.
 */
export interface EmailSignInProviderConfig {
    /**
     * Whether email provider is enabled.
     */
    enabled: boolean;
    /**
     * Whether password is required for email sign-in. When not required,
     * email sign-in can be performed with password or via email link sign-in.
     */
    passwordRequired?: boolean;
}
/**
 * The base Auth provider configuration interface.
 */
export interface BaseAuthProviderConfig {
    /**
     * The provider ID defined by the developer.
     * For a SAML provider, this is always prefixed by `saml.`.
     * For an OIDC provider, this is always prefixed by `oidc.`.
     */
    providerId: string;
    /**
     * The user-friendly display name to the current configuration. This name is
     * also used as the provider label in the Cloud Console.
     */
    displayName?: string;
    /**
     * Whether the provider configuration is enabled or disabled. A user
     * cannot sign in using a disabled provider.
     */
    enabled: boolean;
}
/**
 * The
 * [SAML](http://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)
 * Auth provider configuration interface. A SAML provider can be created via
 * {@link BaseAuth.createProviderConfig}.
 */
export interface SAMLAuthProviderConfig extends BaseAuthProviderConfig {
    /**
     * The SAML IdP entity identifier.
     */
    idpEntityId: string;
    /**
     * The SAML IdP SSO URL. This must be a valid URL.
     */
    ssoURL: string;
    /**
     * The list of SAML IdP X.509 certificates issued by CA for this provider.
     * Multiple certificates are accepted to prevent outages during
     * IdP key rotation (for example ADFS rotates every 10 days). When the Auth
     * server receives a SAML response, it will match the SAML response with the
     * certificate on record. Otherwise the response is rejected.
     * Developers are expected to manage the certificate updates as keys are
     * rotated.
     */
    x509Certificates: string[];
    /**
     * The SAML relying party (service provider) entity ID.
     * This is defined by the developer but needs to be provided to the SAML IdP.
     */
    rpEntityId: string;
    /**
     * This is fixed and must always be the same as the OAuth redirect URL
     * provisioned by Firebase Auth,
     * `https://project-id.firebaseapp.com/__/auth/handler` unless a custom
     * `authDomain` is used.
     * The callback URL should also be provided to the SAML IdP during
     * configuration.
     */
    callbackURL?: string;
}
/**
 * The interface representing OIDC provider's response object for OAuth
 * authorization flow.
 * One of the following settings is required:
 * <ul>
 * <li>Set <code>code</code> to <code>true</code> for the code flow.</li>
 * <li>Set <code>idToken</code> to <code>true</code> for the ID token flow.</li>
 * </ul>
 */
export interface OAuthResponseType {
    /**
     * Whether ID token is returned from IdP's authorization endpoint.
     */
    idToken?: boolean;
    /**
     * Whether authorization code is returned from IdP's authorization endpoint.
     */
    code?: boolean;
}
/**
 * The [OIDC](https://openid.net/specs/openid-connect-core-1_0-final.html) Auth
 * provider configuration interface. An OIDC provider can be created via
 * {@link BaseAuth.createProviderConfig}.
 */
export interface OIDCAuthProviderConfig extends BaseAuthProviderConfig {
    /**
     * This is the required client ID used to confirm the audience of an OIDC
     * provider's
     * [ID token](https://openid.net/specs/openid-connect-core-1_0-final.html#IDToken).
     */
    clientId: string;
    /**
     * This is the required provider issuer used to match the provider issuer of
     * the ID token and to determine the corresponding OIDC discovery document, eg.
     * [`/.well-known/openid-configuration`](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig).
     * This is needed for the following:
     * <ul>
     * <li>To verify the provided issuer.</li>
     * <li>Determine the authentication/authorization endpoint during the OAuth
     *     `id_token` authentication flow.</li>
     * <li>To retrieve the public signing keys via `jwks_uri` to verify the OIDC
     *     provider's ID token's signature.</li>
     * <li>To determine the claims_supported to construct the user attributes to be
     *     returned in the additional user info response.</li>
     * </ul>
     * ID token validation will be performed as defined in the
     * [spec](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).
     */
    issuer: string;
    /**
     * The OIDC provider's client secret to enable OIDC code flow.
     */
    clientSecret?: string;
    /**
     * The OIDC provider's response object for OAuth authorization flow.
     */
    responseType?: OAuthResponseType;
}
/**
 * The Auth provider configuration type.
 * {@link BaseAuth.createProviderConfig}.
 */
export type AuthProviderConfig = SAMLAuthProviderConfig | OIDCAuthProviderConfig;
/**
 * The request interface for updating a SMS Region Config.
 * Configures the regions where users are allowed to send verification SMS.
 * This is based on the calling code of the destination phone number.
 */
export type SmsRegionConfig = AllowByDefaultWrap | AllowlistOnlyWrap;
/**
 * Mutual exclusive SMS Region Config of AllowByDefault interface
 */
export interface AllowByDefaultWrap {
    /**
     * Allow every region by default.
     */
    allowByDefault: AllowByDefault;
    /** @alpha */
    allowlistOnly?: never;
}
/**
 * Mutually exclusive SMS Region Config of AllowlistOnly interface
 */
export interface AllowlistOnlyWrap {
    /**
     * Only allowing regions by explicitly adding them to an
     * allowlist.
     */
    allowlistOnly: AllowlistOnly;
    /** @alpha */
    allowByDefault?: never;
}
/**
 * Defines a policy of allowing every region by default and adding disallowed
 * regions to a disallow list.
 */
export interface AllowByDefault {
    /**
     * Two letter unicode region codes to disallow as defined by
     * https://cldr.unicode.org/
     * The full list of these region codes is here:
     * https://github.com/unicode-cldr/cldr-localenames-full/blob/master/main/en/territories.json
     */
    disallowedRegions: string[];
}
/**
 * Defines a policy of only allowing regions by explicitly adding them to an
 * allowlist.
 */
export interface AllowlistOnly {
    /**
   * Two letter unicode region codes to allow as defined by
   * https://cldr.unicode.org/
   * The full list of these region codes is here:
   * https://github.com/unicode-cldr/cldr-localenames-full/blob/master/main/en/territories.json
   */
    allowedRegions: string[];
}
/**
* Enforcement state of reCAPTCHA protection.
*   - 'OFF': Unenforced.
*   - 'AUDIT': Create assessment but don't enforce the result.
*   - 'ENFORCE': Create assessment and enforce the result.
*/
export type RecaptchaProviderEnforcementState = 'OFF' | 'AUDIT' | 'ENFORCE';
/**
* The actions to take for reCAPTCHA-protected requests.
*   - 'BLOCK': The reCAPTCHA-protected request will be blocked.
*/
export type RecaptchaAction = 'BLOCK';
/**
 * The config for a reCAPTCHA action rule.
 */
export interface RecaptchaManagedRule {
    /**
     * The action will be enforced if the reCAPTCHA score of a request is larger than endScore.
     */
    endScore: number;
    /**
    * The action for reCAPTCHA-protected requests.
    */
    action?: RecaptchaAction;
}
/**
 * The managed rules for toll fraud provider, containing the enforcement status.
 * The toll fraud provider contains all SMS related user flows.
 */
export interface RecaptchaTollFraudManagedRule {
    /**
    * The action will be enforced if the reCAPTCHA score of a request is larger than startScore.
    */
    startScore: number;
    /**
     * The action for reCAPTCHA-protected requests.
     */
    action?: RecaptchaAction;
}
/**
 * The key's platform type.
 */
export type RecaptchaKeyClientType = 'WEB' | 'IOS' | 'ANDROID';
/**
 * The reCAPTCHA key config.
 */
export interface RecaptchaKey {
    /**
     * The key's client platform type.
     */
    type?: RecaptchaKeyClientType;
    /**
     * The reCAPTCHA site key.
     */
    key: string;
}
/**
 * The request interface for updating a reCAPTCHA Config.
 * By enabling reCAPTCHA Enterprise Integration you are
 * agreeing to reCAPTCHA Enterprise
 * {@link https://cloud.google.com/terms/service-terms | Term of Service}.
 */
export interface RecaptchaConfig {
    /**
    * The enforcement state of the email password provider.
    */
    emailPasswordEnforcementState?: RecaptchaProviderEnforcementState;
    /**
    * The enforcement state of the phone provider.
    */
    phoneEnforcementState?: RecaptchaProviderEnforcementState;
    /**
     *  The reCAPTCHA managed rules.
     */
    managedRules?: RecaptchaManagedRule[];
    /**
     * The reCAPTCHA keys.
     */
    recaptchaKeys?: RecaptchaKey[];
    /**
     * Whether to use account defender for reCAPTCHA assessment.
     * The default value is false.
     */
    useAccountDefender?: boolean;
    /**
     * Whether to use the rCE bot score for reCAPTCHA phone provider.
     * Can only be true when the phone_enforcement_state is AUDIT or ENFORCE.
     */
    useSmsBotScore?: boolean;
    /**
     * Whether to use the rCE SMS toll fraud protection risk score for reCAPTCHA phone provider.
     * Can only be true when the phone_enforcement_state is AUDIT or ENFORCE.
     */
    useSmsTollFraudProtection?: boolean;
    /**
     * The managed rules for toll fraud provider, containing the enforcement status.
     * The toll fraud provider contains all SMS related user flows.
     */
    smsTollFraudManagedRules?: RecaptchaTollFraudManagedRule[];
}
/**
 * Server side recaptcha configuration.
 */
export interface RecaptchaAuthServerConfig {
    emailPasswordEnforcementState?: RecaptchaProviderEnforcementState;
    phoneEnforcementState?: RecaptchaProviderEnforcementState;
    managedRules?: RecaptchaManagedRule[];
    recaptchaKeys?: RecaptchaKey[];
    useAccountDefender?: boolean;
    useSmsBotScore?: boolean;
    useSmsTollFraudProtection?: boolean;
    tollFraudManagedRules?: RecaptchaTollFraudManagedRule[];
}
/**
 * A password policy configuration for a project or tenant
*/
export interface PasswordPolicyConfig {
    /**
     * Enforcement state of the password policy
     */
    enforcementState?: PasswordPolicyEnforcementState;
    /**
     * Require users to have a policy-compliant password to sign in
     */
    forceUpgradeOnSignin?: boolean;
    /**
     * The constraints that make up the password strength policy
     */
    constraints?: CustomStrengthOptionsConfig;
}
/**
 * Configuration for settings related to univeral links (iOS)
 * and app links (Android).
 */
export interface MobileLinksConfig {
    /**
     * Use Firebase Hosting or dynamic link domain as the out-of-band code domain.
     */
    domain?: MobileLinksDomain;
}
/**
 * Open code in app domain to use for app links and universal links.
 */
export type MobileLinksDomain = 'HOSTING_DOMAIN' | 'FIREBASE_DYNAMIC_LINK_DOMAIN';
/**
 * A password policy's enforcement state.
 */
export type PasswordPolicyEnforcementState = 'ENFORCE' | 'OFF';
/**
 * Constraints to be enforced on the password policy
 */
export interface CustomStrengthOptionsConfig {
    /**
     * The password must contain an upper case character
     */
    requireUppercase?: boolean;
    /**
     *  The password must contain a lower case character
     */
    requireLowercase?: boolean;
    /**
     * The password must contain a non-alphanumeric character
     */
    requireNonAlphanumeric?: boolean;
    /**
     * The password must contain a number
     */
    requireNumeric?: boolean;
    /**
     * Minimum password length. Valid values are from 6 to 30
     */
    minLength?: number;
    /**
     * Maximum password length. No default max length
     */
    maxLength?: number;
}
/**
 * Server side password policy configuration.
 */
export interface PasswordPolicyAuthServerConfig {
    passwordPolicyEnforcementState?: PasswordPolicyEnforcementState;
    passwordPolicyVersions?: PasswordPolicyVersionsAuthServerConfig[];
    forceUpgradeOnSignin?: boolean;
}
/**
 * Server side password policy versions configuration.
 */
export interface PasswordPolicyVersionsAuthServerConfig {
    customStrengthOptions?: CustomStrengthOptionsAuthServerConfig;
}
/**
 * Server side password policy constraints configuration.
 */
export interface CustomStrengthOptionsAuthServerConfig {
    containsLowercaseCharacter?: boolean;
    containsUppercaseCharacter?: boolean;
    containsNumericCharacter?: boolean;
    containsNonAlphanumericCharacter?: boolean;
    minPasswordLength?: number;
    maxPasswordLength?: number;
}
/**
 * The email privacy configuration of a project or tenant.
 */
export interface EmailPrivacyConfig {
    /**
     * Whether enhanced email privacy is enabled.
     */
    enableImprovedEmailPrivacy?: boolean;
}
export {};
