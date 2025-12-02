/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2020 Google Inc.
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
 * Firebase Authentication.
 *
 * @packageDocumentation
 */
import { App } from '../app/index';
import { Auth } from './auth';
/**
 * Gets the {@link Auth} service for the default app or a
 * given app.
 *
 * `getAuth()` can be called with no arguments to access the default app's
 * {@link Auth} service or as `getAuth(app)` to access the
 * {@link Auth} service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Auth service for the default app
 * const defaultAuth = getAuth();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Auth service for a given app
 * const otherAuth = getAuth(otherApp);
 * ```
 *
 */
export declare function getAuth(app?: App): Auth;
export { ActionCodeSettings } from './action-code-settings-builder';
export { Auth, } from './auth';
export { AllowByDefault, AllowByDefaultWrap, AllowlistOnly, AllowlistOnlyWrap, AuthFactorType, AuthProviderConfig, AuthProviderConfigFilter, BaseAuthProviderConfig, BaseCreateMultiFactorInfoRequest, BaseUpdateMultiFactorInfoRequest, CreateMultiFactorInfoRequest, CreatePhoneMultiFactorInfoRequest, CreateRequest, EmailSignInProviderConfig, ListProviderConfigResults, MultiFactorConfig, MultiFactorConfigState, MultiFactorCreateSettings, MultiFactorUpdateSettings, MultiFactorProviderConfig, OAuthResponseType, OIDCAuthProviderConfig, OIDCUpdateAuthProviderRequest, RecaptchaAction, RecaptchaConfig, RecaptchaKey, RecaptchaKeyClientType, RecaptchaManagedRule, RecaptchaTollFraudManagedRule, RecaptchaProviderEnforcementState, SAMLAuthProviderConfig, SAMLUpdateAuthProviderRequest, SmsRegionConfig, UserProvider, UpdateAuthProviderRequest, UpdateMultiFactorInfoRequest, UpdatePhoneMultiFactorInfoRequest, UpdateRequest, TotpMultiFactorProviderConfig, PasswordPolicyConfig, PasswordPolicyEnforcementState, CustomStrengthOptionsConfig, EmailPrivacyConfig, MobileLinksConfig, MobileLinksDomain, } from './auth-config';
export { BaseAuth, DeleteUsersResult, GetUsersResult, ListUsersResult, SessionCookieOptions, } from './base-auth';
export { EmailIdentifier, PhoneIdentifier, ProviderIdentifier, UidIdentifier, UserIdentifier, } from './identifier';
export { CreateTenantRequest, Tenant, UpdateTenantRequest, } from './tenant';
export { ListTenantsResult, TenantAwareAuth, TenantManager, } from './tenant-manager';
export { UpdateProjectConfigRequest, ProjectConfig, } from './project-config';
export { ProjectConfigManager, } from './project-config-manager';
export { DecodedIdToken, DecodedAuthBlockingToken } from './token-verifier';
export { HashAlgorithmType, UserImportOptions, UserImportRecord, UserImportResult, UserMetadataRequest, UserProviderRequest, } from './user-import-builder';
export { MultiFactorInfo, MultiFactorSettings, PhoneMultiFactorInfo, UserInfo, UserMetadata, UserRecord, } from './user-record';
export { FirebaseAuthError, AuthClientErrorCode, } from '../utils/error';
