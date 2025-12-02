/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2021 Google Inc.
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
import { App } from '../app/index';
import { ActionCodeSettings as TActionCodeSettings } from './action-code-settings-builder';
import { Auth as TAuth } from './auth';
import { AuthFactorType as TAuthFactorType, AuthProviderConfig as TAuthProviderConfig, AuthProviderConfigFilter as TAuthProviderConfigFilter, CreateRequest as TCreateRequest, CreateMultiFactorInfoRequest as TCreateMultiFactorInfoRequest, CreatePhoneMultiFactorInfoRequest as TCreatePhoneMultiFactorInfoRequest, EmailSignInProviderConfig as TEmailSignInProviderConfig, ListProviderConfigResults as TListProviderConfigResults, MultiFactorCreateSettings as TMultiFactorCreateSettings, MultiFactorConfig as TMultiFactorConfig, MultiFactorConfigState as TMultiFactorConfigState, MultiFactorUpdateSettings as TMultiFactorUpdateSettings, OIDCAuthProviderConfig as TOIDCAuthProviderConfig, OIDCUpdateAuthProviderRequest as TOIDCUpdateAuthProviderRequest, SAMLAuthProviderConfig as TSAMLAuthProviderConfig, SAMLUpdateAuthProviderRequest as TSAMLUpdateAuthProviderRequest, UpdateAuthProviderRequest as TUpdateAuthProviderRequest, UpdateMultiFactorInfoRequest as TUpdateMultiFactorInfoRequest, UpdatePhoneMultiFactorInfoRequest as TUpdatePhoneMultiFactorInfoRequest, UpdateRequest as TUpdateRequest } from './auth-config';
import { BaseAuth as TBaseAuth, DeleteUsersResult as TDeleteUsersResult, GetUsersResult as TGetUsersResult, ListUsersResult as TListUsersResult, SessionCookieOptions as TSessionCookieOptions } from './base-auth';
import { EmailIdentifier as TEmailIdentifier, PhoneIdentifier as TPhoneIdentifier, ProviderIdentifier as TProviderIdentifier, UserIdentifier as TUserIdentifier, UidIdentifier as TUidIdentifier } from './identifier';
import { CreateTenantRequest as TCreateTenantRequest, Tenant as TTenant, UpdateTenantRequest as TUpdateTenantRequest } from './tenant';
import { ListTenantsResult as TListTenantsResult, TenantAwareAuth as TTenantAwareAuth, TenantManager as TTenantManager } from './tenant-manager';
import { DecodedIdToken as TDecodedIdToken, DecodedAuthBlockingToken as TDecodedAuthBlockingToken } from './token-verifier';
import { HashAlgorithmType as THashAlgorithmType, UserImportOptions as TUserImportOptions, UserImportRecord as TUserImportRecord, UserImportResult as TUserImportResult, UserMetadataRequest as TUserMetadataRequest, UserProviderRequest as TUserProviderRequest } from './user-import-builder';
import { MultiFactorInfo as TMultiFactorInfo, MultiFactorSettings as TMultiFactorSettings, PhoneMultiFactorInfo as TPhoneMultiFactorInfo, UserInfo as TUserInfo, UserMetadata as TUserMetadata, UserRecord as TUserRecord } from './user-record';
/**
 * Gets the {@link firebase-admin.auth#Auth} service for the default app or a
 * given app.
 *
 * `admin.auth()` can be called with no arguments to access the default app's
 * {@link firebase-admin.auth#Auth} service or as `admin.auth(app)` to access the
 * {@link firebase-admin.auth#Auth} service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Auth service for the default app
 * var defaultAuth = admin.auth();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Auth service for a given app
 * var otherAuth = admin.auth(otherApp);
 * ```
 *
 */
export declare function auth(app?: App): auth.Auth;
export declare namespace auth {
    /**
     * Type alias to {@link firebase-admin.auth#ActionCodeSettings}.
     */
    type ActionCodeSettings = TActionCodeSettings;
    /**
     * Type alias to {@link firebase-admin.auth#Auth}.
     */
    type Auth = TAuth;
    /**
     * Type alias to {@link firebase-admin.auth#AuthFactorType}.
     */
    type AuthFactorType = TAuthFactorType;
    /**
     * Type alias to {@link firebase-admin.auth#AuthProviderConfig}.
     */
    type AuthProviderConfig = TAuthProviderConfig;
    /**
     * Type alias to {@link firebase-admin.auth#AuthProviderConfigFilter}.
     */
    type AuthProviderConfigFilter = TAuthProviderConfigFilter;
    /**
     * Type alias to {@link firebase-admin.auth#BaseAuth}.
     */
    type BaseAuth = TBaseAuth;
    /**
     * Type alias to {@link firebase-admin.auth#CreateMultiFactorInfoRequest}.
     */
    type CreateMultiFactorInfoRequest = TCreateMultiFactorInfoRequest;
    /**
     * Type alias to {@link firebase-admin.auth#CreatePhoneMultiFactorInfoRequest}.
     */
    type CreatePhoneMultiFactorInfoRequest = TCreatePhoneMultiFactorInfoRequest;
    /**
     * Type alias to {@link firebase-admin.auth#CreateRequest}.
     */
    type CreateRequest = TCreateRequest;
    /**
     * Type alias to {@link firebase-admin.auth#CreateTenantRequest}.
     */
    type CreateTenantRequest = TCreateTenantRequest;
    /**
     * Type alias to {@link firebase-admin.auth#DecodedIdToken}.
     */
    type DecodedIdToken = TDecodedIdToken;
    /** @alpha */
    type DecodedAuthBlockingToken = TDecodedAuthBlockingToken;
    /**
     * Type alias to {@link firebase-admin.auth#DeleteUsersResult}.
     */
    type DeleteUsersResult = TDeleteUsersResult;
    /**
     * Type alias to {@link firebase-admin.auth#EmailIdentifier}.
     */
    type EmailIdentifier = TEmailIdentifier;
    /**
     * Type alias to {@link firebase-admin.auth#EmailSignInProviderConfig}.
     */
    type EmailSignInProviderConfig = TEmailSignInProviderConfig;
    /**
     * Type alias to {@link firebase-admin.auth#GetUsersResult}.
     */
    type GetUsersResult = TGetUsersResult;
    /**
     * Type alias to {@link firebase-admin.auth#HashAlgorithmType}.
     */
    type HashAlgorithmType = THashAlgorithmType;
    /**
     * Type alias to {@link firebase-admin.auth#ListProviderConfigResults}.
     */
    type ListProviderConfigResults = TListProviderConfigResults;
    /**
     * Type alias to {@link firebase-admin.auth#ListTenantsResult}.
     */
    type ListTenantsResult = TListTenantsResult;
    /**
     * Type alias to {@link firebase-admin.auth#ListUsersResult}.
     */
    type ListUsersResult = TListUsersResult;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorCreateSettings}.
     */
    type MultiFactorCreateSettings = TMultiFactorCreateSettings;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorConfig}.
     */
    type MultiFactorConfig = TMultiFactorConfig;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorConfigState}.
     */
    type MultiFactorConfigState = TMultiFactorConfigState;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorInfo}.
     */
    type MultiFactorInfo = TMultiFactorInfo;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorUpdateSettings}.
     */
    type MultiFactorUpdateSettings = TMultiFactorUpdateSettings;
    /**
     * Type alias to {@link firebase-admin.auth#MultiFactorSettings}.
     */
    type MultiFactorSettings = TMultiFactorSettings;
    /**
     * Type alias to {@link firebase-admin.auth#OIDCAuthProviderConfig}.
     */
    type OIDCAuthProviderConfig = TOIDCAuthProviderConfig;
    /**
     * Type alias to {@link firebase-admin.auth#OIDCUpdateAuthProviderRequest}.
     */
    type OIDCUpdateAuthProviderRequest = TOIDCUpdateAuthProviderRequest;
    /**
     * Type alias to {@link firebase-admin.auth#PhoneIdentifier}.
     */
    type PhoneIdentifier = TPhoneIdentifier;
    /**
     * Type alias to {@link firebase-admin.auth#PhoneMultiFactorInfo}.
     */
    type PhoneMultiFactorInfo = TPhoneMultiFactorInfo;
    /**
     * Type alias to {@link firebase-admin.auth#ProviderIdentifier}.
     */
    type ProviderIdentifier = TProviderIdentifier;
    /**
     * Type alias to {@link firebase-admin.auth#SAMLAuthProviderConfig}.
     */
    type SAMLAuthProviderConfig = TSAMLAuthProviderConfig;
    /**
     * Type alias to {@link firebase-admin.auth#SAMLUpdateAuthProviderRequest}.
     */
    type SAMLUpdateAuthProviderRequest = TSAMLUpdateAuthProviderRequest;
    /**
     * Type alias to {@link firebase-admin.auth#SessionCookieOptions}.
     */
    type SessionCookieOptions = TSessionCookieOptions;
    /**
     * Type alias to {@link firebase-admin.auth#Tenant}.
     */
    type Tenant = TTenant;
    /**
     * Type alias to {@link firebase-admin.auth#TenantAwareAuth}.
     */
    type TenantAwareAuth = TTenantAwareAuth;
    /**
     * Type alias to {@link firebase-admin.auth#TenantManager}.
     */
    type TenantManager = TTenantManager;
    /**
     * Type alias to {@link firebase-admin.auth#UidIdentifier}.
     */
    type UidIdentifier = TUidIdentifier;
    /**
     * Type alias to {@link firebase-admin.auth#UpdateAuthProviderRequest}.
     */
    type UpdateAuthProviderRequest = TUpdateAuthProviderRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UpdateMultiFactorInfoRequest}.
     */
    type UpdateMultiFactorInfoRequest = TUpdateMultiFactorInfoRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UpdatePhoneMultiFactorInfoRequest}.
     */
    type UpdatePhoneMultiFactorInfoRequest = TUpdatePhoneMultiFactorInfoRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UpdateRequest}.
     */
    type UpdateRequest = TUpdateRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UpdateTenantRequest}.
     */
    type UpdateTenantRequest = TUpdateTenantRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UserIdentifier}.
     */
    type UserIdentifier = TUserIdentifier;
    /**
     * Type alias to {@link firebase-admin.auth#UserImportOptions}.
     */
    type UserImportOptions = TUserImportOptions;
    /**
     * Type alias to {@link firebase-admin.auth#UserImportRecord}.
     */
    type UserImportRecord = TUserImportRecord;
    /**
     * Type alias to {@link firebase-admin.auth#UserImportResult}.
     */
    type UserImportResult = TUserImportResult;
    /**
     * Type alias to {@link firebase-admin.auth#UserInfo}.
     */
    type UserInfo = TUserInfo;
    /**
     * Type alias to {@link firebase-admin.auth#UserMetadata}.
     */
    type UserMetadata = TUserMetadata;
    /**
     * Type alias to {@link firebase-admin.auth#UserMetadataRequest}.
     */
    type UserMetadataRequest = TUserMetadataRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UserProviderRequest}.
     */
    type UserProviderRequest = TUserProviderRequest;
    /**
     * Type alias to {@link firebase-admin.auth#UserRecord}.
     */
    type UserRecord = TUserRecord;
}
