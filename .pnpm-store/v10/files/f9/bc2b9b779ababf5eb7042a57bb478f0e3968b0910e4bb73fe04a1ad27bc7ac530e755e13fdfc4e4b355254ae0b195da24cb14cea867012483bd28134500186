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
import { FirebaseError as FirebaseErrorInterface } from '../app';
import { BatchResponse } from '../messaging/messaging-api';
/**
 * Defines error info type. This includes a code and message string.
 */
export interface ErrorInfo {
    code: string;
    message: string;
}
/**
 * Firebase error code structure. This extends Error.
 */
export declare class FirebaseError extends Error implements FirebaseErrorInterface {
    private errorInfo;
    /** @returns The error code. */
    get code(): string;
    /** @returns The error message. */
    get message(): string;
    /** @returns The object representation of the error. */
    toJSON(): object;
}
/**
 * A FirebaseError with a prefix in front of the error code.
 */
export declare class PrefixedFirebaseError extends FirebaseError {
    private codePrefix;
    /**
     * Allows the error type to be checked without needing to know implementation details
     * of the code prefixing.
     *
     * @param code - The non-prefixed error code to test against.
     * @returns True if the code matches, false otherwise.
     */
    hasCode(code: string): boolean;
}
/**
 * Firebase App error code structure. This extends PrefixedFirebaseError.
 */
export declare class FirebaseAppError extends PrefixedFirebaseError {
}
/**
 * Firebase Auth error code structure. This extends PrefixedFirebaseError.
 */
export declare class FirebaseAuthError extends PrefixedFirebaseError {
}
/**
 * Firebase Database error code structure. This extends FirebaseError.
 */
export declare class FirebaseDatabaseError extends FirebaseError {
}
/**
 * Firebase Firestore error code structure. This extends FirebaseError.
 */
export declare class FirebaseFirestoreError extends FirebaseError {
}
/**
 * Firebase instance ID error code structure. This extends FirebaseError.
 */
export declare class FirebaseInstanceIdError extends FirebaseError {
}
/**
 * Firebase Installations service error code structure. This extends `FirebaseError`.
 */
export declare class FirebaseInstallationsError extends FirebaseError {
}
/**
 * Firebase Messaging error code structure. This extends PrefixedFirebaseError.
 */
export declare class FirebaseMessagingError extends PrefixedFirebaseError {
}
export declare class FirebaseMessagingSessionError extends FirebaseMessagingError {
    pendingBatchResponse?: Promise<BatchResponse>;
    /** @returns The object representation of the error. */
    toJSON(): object;
}
/**
 * Firebase project management error code structure. This extends PrefixedFirebaseError.
 */
export declare class FirebaseProjectManagementError extends PrefixedFirebaseError {
}
/**
 * App client error codes and their default messages.
 */
export declare class AppErrorCodes {
    static APP_DELETED: string;
    static DUPLICATE_APP: string;
    static INVALID_ARGUMENT: string;
    static INTERNAL_ERROR: string;
    static INVALID_APP_NAME: string;
    static INVALID_APP_OPTIONS: string;
    static INVALID_CREDENTIAL: string;
    static NETWORK_ERROR: string;
    static NETWORK_TIMEOUT: string;
    static NO_APP: string;
    static UNABLE_TO_PARSE_RESPONSE: string;
}
/**
 * Auth client error codes and their default messages.
 */
export declare class AuthClientErrorCode {
    static AUTH_BLOCKING_TOKEN_EXPIRED: {
        code: string;
        message: string;
    };
    static BILLING_NOT_ENABLED: {
        code: string;
        message: string;
    };
    static CLAIMS_TOO_LARGE: {
        code: string;
        message: string;
    };
    static CONFIGURATION_EXISTS: {
        code: string;
        message: string;
    };
    static CONFIGURATION_NOT_FOUND: {
        code: string;
        message: string;
    };
    static ID_TOKEN_EXPIRED: {
        code: string;
        message: string;
    };
    static INVALID_ARGUMENT: {
        code: string;
        message: string;
    };
    static INVALID_CONFIG: {
        code: string;
        message: string;
    };
    static EMAIL_ALREADY_EXISTS: {
        code: string;
        message: string;
    };
    static EMAIL_NOT_FOUND: {
        code: string;
        message: string;
    };
    static FORBIDDEN_CLAIM: {
        code: string;
        message: string;
    };
    static INVALID_ID_TOKEN: {
        code: string;
        message: string;
    };
    static ID_TOKEN_REVOKED: {
        code: string;
        message: string;
    };
    static INTERNAL_ERROR: {
        code: string;
        message: string;
    };
    static INVALID_CLAIMS: {
        code: string;
        message: string;
    };
    static INVALID_CONTINUE_URI: {
        code: string;
        message: string;
    };
    static INVALID_CREATION_TIME: {
        code: string;
        message: string;
    };
    static INVALID_CREDENTIAL: {
        code: string;
        message: string;
    };
    static INVALID_DISABLED_FIELD: {
        code: string;
        message: string;
    };
    static INVALID_DISPLAY_NAME: {
        code: string;
        message: string;
    };
    static INVALID_DYNAMIC_LINK_DOMAIN: {
        code: string;
        message: string;
    };
    static INVALID_HOSTING_LINK_DOMAIN: {
        code: string;
        message: string;
    };
    static INVALID_EMAIL_VERIFIED: {
        code: string;
        message: string;
    };
    static INVALID_EMAIL: {
        code: string;
        message: string;
    };
    static INVALID_NEW_EMAIL: {
        code: string;
        message: string;
    };
    static INVALID_ENROLLED_FACTORS: {
        code: string;
        message: string;
    };
    static INVALID_ENROLLMENT_TIME: {
        code: string;
        message: string;
    };
    static INVALID_HASH_ALGORITHM: {
        code: string;
        message: string;
    };
    static INVALID_HASH_BLOCK_SIZE: {
        code: string;
        message: string;
    };
    static INVALID_HASH_DERIVED_KEY_LENGTH: {
        code: string;
        message: string;
    };
    static INVALID_HASH_KEY: {
        code: string;
        message: string;
    };
    static INVALID_HASH_MEMORY_COST: {
        code: string;
        message: string;
    };
    static INVALID_HASH_PARALLELIZATION: {
        code: string;
        message: string;
    };
    static INVALID_HASH_ROUNDS: {
        code: string;
        message: string;
    };
    static INVALID_HASH_SALT_SEPARATOR: {
        code: string;
        message: string;
    };
    static INVALID_LAST_SIGN_IN_TIME: {
        code: string;
        message: string;
    };
    static INVALID_NAME: {
        code: string;
        message: string;
    };
    static INVALID_OAUTH_CLIENT_ID: {
        code: string;
        message: string;
    };
    static INVALID_PAGE_TOKEN: {
        code: string;
        message: string;
    };
    static INVALID_PASSWORD: {
        code: string;
        message: string;
    };
    static INVALID_PASSWORD_HASH: {
        code: string;
        message: string;
    };
    static INVALID_PASSWORD_SALT: {
        code: string;
        message: string;
    };
    static INVALID_PHONE_NUMBER: {
        code: string;
        message: string;
    };
    static INVALID_PHOTO_URL: {
        code: string;
        message: string;
    };
    static INVALID_PROJECT_ID: {
        code: string;
        message: string;
    };
    static INVALID_PROVIDER_DATA: {
        code: string;
        message: string;
    };
    static INVALID_PROVIDER_ID: {
        code: string;
        message: string;
    };
    static INVALID_PROVIDER_UID: {
        code: string;
        message: string;
    };
    static INVALID_OAUTH_RESPONSETYPE: {
        code: string;
        message: string;
    };
    static INVALID_SESSION_COOKIE_DURATION: {
        code: string;
        message: string;
    };
    static INVALID_TENANT_ID: {
        code: string;
        message: string;
    };
    static INVALID_TENANT_TYPE: {
        code: string;
        message: string;
    };
    static INVALID_TESTING_PHONE_NUMBER: {
        code: string;
        message: string;
    };
    static INVALID_UID: {
        code: string;
        message: string;
    };
    static INVALID_USER_IMPORT: {
        code: string;
        message: string;
    };
    static INVALID_TOKENS_VALID_AFTER_TIME: {
        code: string;
        message: string;
    };
    static MISMATCHING_TENANT_ID: {
        code: string;
        message: string;
    };
    static MISSING_ANDROID_PACKAGE_NAME: {
        code: string;
        message: string;
    };
    static MISSING_CONFIG: {
        code: string;
        message: string;
    };
    static MISSING_CONTINUE_URI: {
        code: string;
        message: string;
    };
    static MISSING_DISPLAY_NAME: {
        code: string;
        message: string;
    };
    static MISSING_EMAIL: {
        code: string;
        message: string;
    };
    static MISSING_IOS_BUNDLE_ID: {
        code: string;
        message: string;
    };
    static MISSING_ISSUER: {
        code: string;
        message: string;
    };
    static MISSING_HASH_ALGORITHM: {
        code: string;
        message: string;
    };
    static MISSING_OAUTH_CLIENT_ID: {
        code: string;
        message: string;
    };
    static MISSING_OAUTH_CLIENT_SECRET: {
        code: string;
        message: string;
    };
    static MISSING_PROVIDER_ID: {
        code: string;
        message: string;
    };
    static MISSING_SAML_RELYING_PARTY_CONFIG: {
        code: string;
        message: string;
    };
    static MAXIMUM_TEST_PHONE_NUMBER_EXCEEDED: {
        code: string;
        message: string;
    };
    static MAXIMUM_USER_COUNT_EXCEEDED: {
        code: string;
        message: string;
    };
    static MISSING_UID: {
        code: string;
        message: string;
    };
    static OPERATION_NOT_ALLOWED: {
        code: string;
        message: string;
    };
    static PHONE_NUMBER_ALREADY_EXISTS: {
        code: string;
        message: string;
    };
    static PROJECT_NOT_FOUND: {
        code: string;
        message: string;
    };
    static INSUFFICIENT_PERMISSION: {
        code: string;
        message: string;
    };
    static QUOTA_EXCEEDED: {
        code: string;
        message: string;
    };
    static SECOND_FACTOR_LIMIT_EXCEEDED: {
        code: string;
        message: string;
    };
    static SECOND_FACTOR_UID_ALREADY_EXISTS: {
        code: string;
        message: string;
    };
    static SESSION_COOKIE_EXPIRED: {
        code: string;
        message: string;
    };
    static SESSION_COOKIE_REVOKED: {
        code: string;
        message: string;
    };
    static TENANT_NOT_FOUND: {
        code: string;
        message: string;
    };
    static UID_ALREADY_EXISTS: {
        code: string;
        message: string;
    };
    static UNAUTHORIZED_DOMAIN: {
        code: string;
        message: string;
    };
    static UNSUPPORTED_FIRST_FACTOR: {
        code: string;
        message: string;
    };
    static UNSUPPORTED_SECOND_FACTOR: {
        code: string;
        message: string;
    };
    static UNSUPPORTED_TENANT_OPERATION: {
        code: string;
        message: string;
    };
    static UNVERIFIED_EMAIL: {
        code: string;
        message: string;
    };
    static USER_NOT_FOUND: {
        code: string;
        message: string;
    };
    static NOT_FOUND: {
        code: string;
        message: string;
    };
    static USER_DISABLED: {
        code: string;
        message: string;
    };
    static USER_NOT_DISABLED: {
        code: string;
        message: string;
    };
    static INVALID_RECAPTCHA_ACTION: {
        code: string;
        message: string;
    };
    static INVALID_RECAPTCHA_ENFORCEMENT_STATE: {
        code: string;
        message: string;
    };
    static RECAPTCHA_NOT_ENABLED: {
        code: string;
        message: string;
    };
}
/**
 * Messaging client error codes and their default messages.
 */
export declare class MessagingClientErrorCode {
    static INVALID_ARGUMENT: {
        code: string;
        message: string;
    };
    static INVALID_RECIPIENT: {
        code: string;
        message: string;
    };
    static INVALID_PAYLOAD: {
        code: string;
        message: string;
    };
    static INVALID_DATA_PAYLOAD_KEY: {
        code: string;
        message: string;
    };
    static PAYLOAD_SIZE_LIMIT_EXCEEDED: {
        code: string;
        message: string;
    };
    static INVALID_OPTIONS: {
        code: string;
        message: string;
    };
    static INVALID_REGISTRATION_TOKEN: {
        code: string;
        message: string;
    };
    static REGISTRATION_TOKEN_NOT_REGISTERED: {
        code: string;
        message: string;
    };
    static MISMATCHED_CREDENTIAL: {
        code: string;
        message: string;
    };
    static INVALID_PACKAGE_NAME: {
        code: string;
        message: string;
    };
    static DEVICE_MESSAGE_RATE_EXCEEDED: {
        code: string;
        message: string;
    };
    static TOPICS_MESSAGE_RATE_EXCEEDED: {
        code: string;
        message: string;
    };
    static MESSAGE_RATE_EXCEEDED: {
        code: string;
        message: string;
    };
    static THIRD_PARTY_AUTH_ERROR: {
        code: string;
        message: string;
    };
    static TOO_MANY_TOPICS: {
        code: string;
        message: string;
    };
    static AUTHENTICATION_ERROR: {
        code: string;
        message: string;
    };
    static SERVER_UNAVAILABLE: {
        code: string;
        message: string;
    };
    static INTERNAL_ERROR: {
        code: string;
        message: string;
    };
    static UNKNOWN_ERROR: {
        code: string;
        message: string;
    };
}
export declare class InstallationsClientErrorCode {
    static INVALID_ARGUMENT: {
        code: string;
        message: string;
    };
    static INVALID_PROJECT_ID: {
        code: string;
        message: string;
    };
    static INVALID_INSTALLATION_ID: {
        code: string;
        message: string;
    };
    static API_ERROR: {
        code: string;
        message: string;
    };
}
export declare class InstanceIdClientErrorCode extends InstallationsClientErrorCode {
    static INVALID_INSTANCE_ID: {
        code: string;
        message: string;
    };
}
export type ProjectManagementErrorCode = 'already-exists' | 'authentication-error' | 'internal-error' | 'invalid-argument' | 'invalid-project-id' | 'invalid-server-response' | 'not-found' | 'service-unavailable' | 'unknown-error';
