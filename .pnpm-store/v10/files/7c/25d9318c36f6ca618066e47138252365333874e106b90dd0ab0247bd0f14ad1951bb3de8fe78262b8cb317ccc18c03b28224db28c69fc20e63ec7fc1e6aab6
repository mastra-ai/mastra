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
import { FirebaseArrayIndexError } from '../app/index';
import { UpdateMultiFactorInfoRequest, MultiFactorUpdateSettings } from './auth-config';
export type HashAlgorithmType = 'SCRYPT' | 'STANDARD_SCRYPT' | 'HMAC_SHA512' | 'HMAC_SHA256' | 'HMAC_SHA1' | 'HMAC_MD5' | 'MD5' | 'PBKDF_SHA1' | 'BCRYPT' | 'PBKDF2_SHA256' | 'SHA512' | 'SHA256' | 'SHA1';
/**
   * Interface representing the user import options needed for
   * {@link BaseAuth.importUsers} method. This is used to
   * provide the password hashing algorithm information.
   */
export interface UserImportOptions {
    /**
     * The password hashing information.
     */
    hash: {
        /**
         * The password hashing algorithm identifier. The following algorithm
         * identifiers are supported:
         * `SCRYPT`, `STANDARD_SCRYPT`, `HMAC_SHA512`, `HMAC_SHA256`, `HMAC_SHA1`,
         * `HMAC_MD5`, `MD5`, `PBKDF_SHA1`, `BCRYPT`, `PBKDF2_SHA256`, `SHA512`,
         * `SHA256` and `SHA1`.
         */
        algorithm: HashAlgorithmType;
        /**
         * The signing key used in the hash algorithm in buffer bytes.
         * Required by hashing algorithms `SCRYPT`, `HMAC_SHA512`, `HMAC_SHA256`,
         * `HAMC_SHA1` and `HMAC_MD5`.
         */
        key?: Buffer;
        /**
         * The salt separator in buffer bytes which is appended to salt when
         * verifying a password. This is only used by the `SCRYPT` algorithm.
         */
        saltSeparator?: Buffer;
        /**
         * The number of rounds for hashing calculation.
         * Required for `SCRYPT`, `MD5`, `SHA512`, `SHA256`, `SHA1`, `PBKDF_SHA1` and
         * `PBKDF2_SHA256`.
         */
        rounds?: number;
        /**
         * The memory cost required for `SCRYPT` algorithm, or the CPU/memory cost.
         * Required for `STANDARD_SCRYPT` algorithm.
         */
        memoryCost?: number;
        /**
         * The parallelization of the hashing algorithm. Required for the
         * `STANDARD_SCRYPT` algorithm.
         */
        parallelization?: number;
        /**
         * The block size (normally 8) of the hashing algorithm. Required for the
         * `STANDARD_SCRYPT` algorithm.
         */
        blockSize?: number;
        /**
         * The derived key length of the hashing algorithm. Required for the
         * `STANDARD_SCRYPT` algorithm.
         */
        derivedKeyLength?: number;
    };
}
/**
 * Interface representing a user to import to Firebase Auth via the
 * {@link BaseAuth.importUsers} method.
 */
export interface UserImportRecord {
    /**
     * The user's `uid`.
     */
    uid: string;
    /**
     * The user's primary email, if set.
     */
    email?: string;
    /**
     * Whether or not the user's primary email is verified.
     */
    emailVerified?: boolean;
    /**
     * The user's display name.
     */
    displayName?: string;
    /**
     * The user's primary phone number, if set.
     */
    phoneNumber?: string;
    /**
     * The user's photo URL.
     */
    photoURL?: string;
    /**
     * Whether or not the user is disabled: `true` for disabled; `false` for
     * enabled.
     */
    disabled?: boolean;
    /**
     * Additional metadata about the user.
     */
    metadata?: UserMetadataRequest;
    /**
     * An array of providers (for example, Google, Facebook) linked to the user.
     */
    providerData?: UserProviderRequest[];
    /**
     * The user's custom claims object if available, typically used to define
     * user roles and propagated to an authenticated user's ID token.
     */
    customClaims?: {
        [key: string]: any;
    };
    /**
     * The buffer of bytes representing the user's hashed password.
     * When a user is to be imported with a password hash,
     * {@link UserImportOptions} are required to be
     * specified to identify the hashing algorithm used to generate this hash.
     */
    passwordHash?: Buffer;
    /**
     * The buffer of bytes representing the user's password salt.
     */
    passwordSalt?: Buffer;
    /**
     * The identifier of the tenant where user is to be imported to.
     * When not provided in an `admin.auth.Auth` context, the user is uploaded to
     * the default parent project.
     * When not provided in an `admin.auth.TenantAwareAuth` context, the user is uploaded
     * to the tenant corresponding to that `TenantAwareAuth` instance's tenant ID.
     */
    tenantId?: string;
    /**
     * The user's multi-factor related properties.
     */
    multiFactor?: MultiFactorUpdateSettings;
}
/**
 * User metadata to include when importing a user.
 */
export interface UserMetadataRequest {
    /**
     * The date the user last signed in, formatted as a UTC string.
     */
    lastSignInTime?: string;
    /**
     * The date the user was created, formatted as a UTC string.
     */
    creationTime?: string;
}
/**
 * User provider data to include when importing a user.
 */
export interface UserProviderRequest {
    /**
     * The user identifier for the linked provider.
     */
    uid: string;
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
    providerId: string;
}
/**
   * Interface representing the response from the
   * {@link BaseAuth.importUsers} method for batch
   * importing users to Firebase Auth.
   */
export interface UserImportResult {
    /**
     * The number of user records that failed to import to Firebase Auth.
     */
    failureCount: number;
    /**
     * The number of user records that successfully imported to Firebase Auth.
     */
    successCount: number;
    /**
     * An array of errors corresponding to the provided users to import. The
     * length of this array is equal to [`failureCount`](#failureCount).
     */
    errors: FirebaseArrayIndexError[];
}
/** Interface representing an Auth second factor in Auth server format. */
export interface AuthFactorInfo {
    mfaEnrollmentId?: string;
    displayName?: string;
    phoneInfo?: string;
    enrolledAt?: string;
    [key: string]: any;
}
/** UploadAccount endpoint request user interface. */
interface UploadAccountUser {
    localId: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    disabled?: boolean;
    photoUrl?: string;
    phoneNumber?: string;
    providerUserInfo?: Array<{
        rawId: string;
        providerId: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
    }>;
    mfaInfo?: AuthFactorInfo[];
    passwordHash?: string;
    salt?: string;
    lastLoginAt?: number;
    createdAt?: number;
    customAttributes?: string;
    tenantId?: string;
}
/** UploadAccount endpoint request hash options. */
export interface UploadAccountOptions {
    hashAlgorithm?: string;
    signerKey?: string;
    rounds?: number;
    memoryCost?: number;
    saltSeparator?: string;
    cpuMemCost?: number;
    parallelization?: number;
    blockSize?: number;
    dkLen?: number;
}
/** UploadAccount endpoint complete request interface. */
export interface UploadAccountRequest extends UploadAccountOptions {
    users?: UploadAccountUser[];
}
/** Callback function to validate an UploadAccountUser object. */
export type ValidatorFunction = (data: UploadAccountUser) => void;
/**
 * Converts a client format second factor object to server format.
 * @param multiFactorInfo - The client format second factor.
 * @returns The corresponding AuthFactorInfo server request format.
 */
export declare function convertMultiFactorInfoToServerFormat(multiFactorInfo: UpdateMultiFactorInfoRequest): AuthFactorInfo;
/**
 * Class that provides a helper for building/validating uploadAccount requests and
 * UserImportResult responses.
 */
export declare class UserImportBuilder {
    private requiresHashOptions;
    private validatedUsers;
    private validatedOptions;
    private indexMap;
    private userImportResultErrors;
    /**
     * @param {UserImportRecord[]} users The list of user records to import.
     * @param {UserImportOptions=} options The import options which includes hashing
     *     algorithm details.
     * @param {ValidatorFunction=} userRequestValidator The user request validator function.
     * @constructor
     */
    constructor(users: UserImportRecord[], options?: UserImportOptions, userRequestValidator?: ValidatorFunction);
    /**
     * Returns the corresponding constructed uploadAccount request.
     * @returns {UploadAccountRequest} The constructed uploadAccount request.
     */
    buildRequest(): UploadAccountRequest;
    /**
     * Populates the UserImportResult using the client side detected errors and the server
     * side returned errors.
     * @returns {UserImportResult} The user import result based on the returned failed
     *     uploadAccount response.
     */
    buildResponse(failedUploads: Array<{
        index: number;
        message: string;
    }>): UserImportResult;
    /**
     * Validates and returns the hashing options of the uploadAccount request.
     * Throws an error whenever an invalid or missing options is detected.
     * @param {UserImportOptions} options The UserImportOptions.
     * @param {boolean} requiresHashOptions Whether to require hash options.
     * @returns {UploadAccountOptions} The populated UploadAccount options.
     */
    private populateOptions;
    /**
     * Validates and returns the users list of the uploadAccount request.
     * Whenever a user with an error is detected, the error is cached and will later be
     * merged into the user import result. This allows the processing of valid users without
     * failing early on the first error detected.
     * @param {UserImportRecord[]} users The UserImportRecords to convert to UnploadAccountUser
     *     objects.
     * @param {ValidatorFunction=} userValidator The user validator function.
     * @returns {UploadAccountUser[]} The populated uploadAccount users.
     */
    private populateUsers;
}
export {};
