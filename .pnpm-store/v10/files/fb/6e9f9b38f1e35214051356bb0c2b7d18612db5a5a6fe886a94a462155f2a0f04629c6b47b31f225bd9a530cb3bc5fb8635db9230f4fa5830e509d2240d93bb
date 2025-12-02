/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2017 Google Inc.
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
export interface MultiFactorInfoResponse {
    mfaEnrollmentId: string;
    displayName?: string;
    phoneInfo?: string;
    totpInfo?: TotpInfoResponse;
    enrolledAt?: string;
    [key: string]: unknown;
}
export interface TotpInfoResponse {
    [key: string]: unknown;
}
export interface ProviderUserInfoResponse {
    rawId: string;
    displayName?: string;
    email?: string;
    photoUrl?: string;
    phoneNumber?: string;
    providerId: string;
    federatedId?: string;
}
export interface GetAccountInfoUserResponse {
    localId: string;
    email?: string;
    emailVerified?: boolean;
    phoneNumber?: string;
    displayName?: string;
    photoUrl?: string;
    disabled?: boolean;
    passwordHash?: string;
    salt?: string;
    customAttributes?: string;
    validSince?: string;
    tenantId?: string;
    providerUserInfo?: ProviderUserInfoResponse[];
    mfaInfo?: MultiFactorInfoResponse[];
    createdAt?: string;
    lastLoginAt?: string;
    lastRefreshAt?: string;
    [key: string]: any;
}
/**
 * Interface representing the common properties of a user-enrolled second factor.
 */
export declare abstract class MultiFactorInfo {
    /**
     * The ID of the enrolled second factor. This ID is unique to the user.
     */
    readonly uid: string;
    /**
     * The optional display name of the enrolled second factor.
     */
    readonly displayName?: string;
    /**
     * The type identifier of the second factor.
     * For SMS second factors, this is `phone`.
     * For TOTP second factors, this is `totp`.
     */
    readonly factorId: string;
    /**
     * The optional date the second factor was enrolled, formatted as a UTC string.
     */
    readonly enrollmentTime?: string;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
    /**
     * Initializes the MultiFactorInfo object using the provided server response.
     *
     * @param response - The server side response.
     */
    private initFromServerResponse;
}
/**
 * Interface representing a phone specific user-enrolled second factor.
 */
export declare class PhoneMultiFactorInfo extends MultiFactorInfo {
    /**
     * The phone number associated with a phone second factor.
     */
    readonly phoneNumber: string;
    /**
     * {@inheritdoc MultiFactorInfo.toJSON}
     */
    toJSON(): object;
}
/**
 * `TotpInfo` struct associated with a second factor
 */
export declare class TotpInfo {
}
/**
 * Interface representing a TOTP specific user-enrolled second factor.
 */
export declare class TotpMultiFactorInfo extends MultiFactorInfo {
    /**
     * `TotpInfo` struct associated with a second factor
     */
    readonly totpInfo: TotpInfo;
    /**
     * {@inheritdoc MultiFactorInfo.toJSON}
     */
    toJSON(): object;
}
/**
 * The multi-factor related user settings.
 */
export declare class MultiFactorSettings {
    /**
     * List of second factors enrolled with the current user.
     * Currently only phone and TOTP second factors are supported.
     */
    enrolledFactors: MultiFactorInfo[];
    /**
     * Returns a JSON-serializable representation of this multi-factor object.
     *
     * @returns A JSON-serializable representation of this multi-factor object.
     */
    toJSON(): object;
}
/**
 * Represents a user's metadata.
 */
export declare class UserMetadata {
    /**
     * The date the user was created, formatted as a UTC string.
     */
    readonly creationTime: string;
    /**
     * The date the user last signed in, formatted as a UTC string.
     */
    readonly lastSignInTime: string;
    /**
     * The time at which the user was last active (ID token refreshed),
     * formatted as a UTC Date string (eg 'Sat, 03 Feb 2001 04:05:06 GMT').
     * Returns null if the user was never active.
     */
    readonly lastRefreshTime?: string | null;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
}
/**
 * Represents a user's info from a third-party identity provider
 * such as Google or Facebook.
 */
export declare class UserInfo {
    /**
     * The user identifier for the linked provider.
     */
    readonly uid: string;
    /**
     * The display name for the linked provider.
     */
    readonly displayName: string;
    /**
     * The email for the linked provider.
     */
    readonly email: string;
    /**
     * The photo URL for the linked provider.
     */
    readonly photoURL: string;
    /**
     * The linked provider ID (for example, "google.com" for the Google provider).
     */
    readonly providerId: string;
    /**
     * The phone number for the linked provider.
     */
    readonly phoneNumber: string;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
}
/**
 * Represents a user.
 */
export declare class UserRecord {
    /**
     * The user's `uid`.
     */
    readonly uid: string;
    /**
     * The user's primary email, if set.
     */
    readonly email?: string;
    /**
     * Whether or not the user's primary email is verified.
     */
    readonly emailVerified: boolean;
    /**
     * The user's display name.
     */
    readonly displayName?: string;
    /**
     * The user's photo URL.
     */
    readonly photoURL?: string;
    /**
     * The user's primary phone number, if set.
     */
    readonly phoneNumber?: string;
    /**
     * Whether or not the user is disabled: `true` for disabled; `false` for
     * enabled.
     */
    readonly disabled: boolean;
    /**
     * Additional metadata about the user.
     */
    readonly metadata: UserMetadata;
    /**
     * An array of providers (for example, Google, Facebook) linked to the user.
     */
    readonly providerData: UserInfo[];
    /**
     * The user's hashed password (base64-encoded), only if Firebase Auth hashing
     * algorithm (SCRYPT) is used. If a different hashing algorithm had been used
     * when uploading this user, as is typical when migrating from another Auth
     * system, this will be an empty string. If no password is set, this is
     * null. This is only available when the user is obtained from
     * {@link BaseAuth.listUsers}.
     */
    readonly passwordHash?: string;
    /**
     * The user's password salt (base64-encoded), only if Firebase Auth hashing
     * algorithm (SCRYPT) is used. If a different hashing algorithm had been used to
     * upload this user, typical when migrating from another Auth system, this will
     * be an empty string. If no password is set, this is null. This is only
     * available when the user is obtained from {@link BaseAuth.listUsers}.
     */
    readonly passwordSalt?: string;
    /**
     * The user's custom claims object if available, typically used to define
     * user roles and propagated to an authenticated user's ID token.
     * This is set via {@link BaseAuth.setCustomUserClaims}
     */
    readonly customClaims?: {
        [key: string]: any;
    };
    /**
     * The ID of the tenant the user belongs to, if available.
     */
    readonly tenantId?: string | null;
    /**
     * The date the user's tokens are valid after, formatted as a UTC string.
     * This is updated every time the user's refresh token are revoked either
     * from the {@link BaseAuth.revokeRefreshTokens}
     * API or from the Firebase Auth backend on big account changes (password
     * resets, password or email updates, etc).
     */
    readonly tokensValidAfterTime?: string;
    /**
     * The multi-factor related properties for the current user, if available.
     */
    readonly multiFactor?: MultiFactorSettings;
    /**
     * Returns a JSON-serializable representation of this object.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
}
