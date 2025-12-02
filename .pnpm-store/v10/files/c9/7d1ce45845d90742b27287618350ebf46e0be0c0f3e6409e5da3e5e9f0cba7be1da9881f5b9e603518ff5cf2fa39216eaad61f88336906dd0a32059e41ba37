/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantAwareAuthRequestHandler = exports.AuthRequestHandler = exports.AbstractAuthRequestHandler = exports.FIREBASE_AUTH_SIGN_UP_NEW_USER = exports.FIREBASE_AUTH_SET_ACCOUNT_INFO = exports.FIREBASE_AUTH_BATCH_DELETE_ACCOUNTS = exports.FIREBASE_AUTH_DELETE_ACCOUNT = exports.FIREBASE_AUTH_GET_ACCOUNTS_INFO = exports.FIREBASE_AUTH_GET_ACCOUNT_INFO = exports.FIREBASE_AUTH_DOWNLOAD_ACCOUNT = exports.FIREBASE_AUTH_UPLOAD_ACCOUNT = exports.FIREBASE_AUTH_CREATE_SESSION_COOKIE = exports.EMAIL_ACTION_REQUEST_TYPES = exports.RESERVED_CLAIMS = void 0;
exports.useEmulator = useEmulator;
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
const error_1 = require("../utils/error");
const api_request_1 = require("../utils/api-request");
const utils = require("../utils/index");
const user_import_builder_1 = require("./user-import-builder");
const action_code_settings_builder_1 = require("./action-code-settings-builder");
const tenant_1 = require("./tenant");
const identifier_1 = require("./identifier");
const auth_config_1 = require("./auth-config");
const project_config_1 = require("./project-config");
/** Firebase Auth request header. */
const FIREBASE_AUTH_HEADERS = {
    'X-Client-Version': `Node/Admin/${utils.getSdkVersion()}`,
};
/** Firebase Auth request timeout duration in milliseconds. */
const FIREBASE_AUTH_TIMEOUT = 25000;
/** List of reserved claims which cannot be provided when creating a custom token. */
exports.RESERVED_CLAIMS = [
    'acr', 'amr', 'at_hash', 'aud', 'auth_time', 'azp', 'cnf', 'c_hash', 'exp', 'iat',
    'iss', 'jti', 'nbf', 'nonce', 'sub', 'firebase',
];
/** List of supported email action request types. */
exports.EMAIL_ACTION_REQUEST_TYPES = [
    'PASSWORD_RESET', 'VERIFY_EMAIL', 'EMAIL_SIGNIN', 'VERIFY_AND_CHANGE_EMAIL',
];
/** Maximum allowed number of characters in the custom claims payload. */
const MAX_CLAIMS_PAYLOAD_SIZE = 1000;
/** Maximum allowed number of users to batch download at one time. */
const MAX_DOWNLOAD_ACCOUNT_PAGE_SIZE = 1000;
/** Maximum allowed number of users to batch upload at one time. */
const MAX_UPLOAD_ACCOUNT_BATCH_SIZE = 1000;
/** Maximum allowed number of users to batch get at one time. */
const MAX_GET_ACCOUNTS_BATCH_SIZE = 100;
/** Maximum allowed number of users to batch delete at one time. */
const MAX_DELETE_ACCOUNTS_BATCH_SIZE = 1000;
/** Minimum allowed session cookie duration in seconds (5 minutes). */
const MIN_SESSION_COOKIE_DURATION_SECS = 5 * 60;
/** Maximum allowed session cookie duration in seconds (2 weeks). */
const MAX_SESSION_COOKIE_DURATION_SECS = 14 * 24 * 60 * 60;
/** Maximum allowed number of provider configurations to batch download at one time. */
const MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE = 100;
/** The Firebase Auth backend base URL format. */
const FIREBASE_AUTH_BASE_URL_FORMAT = 'https://identitytoolkit.googleapis.com/{version}/projects/{projectId}{api}';
/** Firebase Auth base URlLformat when using the auth emultor. */
const FIREBASE_AUTH_EMULATOR_BASE_URL_FORMAT = 'http://{host}/identitytoolkit.googleapis.com/{version}/projects/{projectId}{api}';
/** The Firebase Auth backend multi-tenancy base URL format. */
const FIREBASE_AUTH_TENANT_URL_FORMAT = FIREBASE_AUTH_BASE_URL_FORMAT.replace('projects/{projectId}', 'projects/{projectId}/tenants/{tenantId}');
/** Firebase Auth base URL format when using the auth emultor with multi-tenancy. */
const FIREBASE_AUTH_EMULATOR_TENANT_URL_FORMAT = FIREBASE_AUTH_EMULATOR_BASE_URL_FORMAT.replace('projects/{projectId}', 'projects/{projectId}/tenants/{tenantId}');
/** Maximum allowed number of tenants to download at one time. */
const MAX_LIST_TENANT_PAGE_SIZE = 1000;
/**
 * Enum for the user write operation type.
 */
var WriteOperationType;
(function (WriteOperationType) {
    WriteOperationType["Create"] = "create";
    WriteOperationType["Update"] = "update";
    WriteOperationType["Upload"] = "upload";
})(WriteOperationType || (WriteOperationType = {}));
/** Defines a base utility to help with resource URL construction. */
class AuthResourceUrlBuilder {
    /**
     * The resource URL builder constructor.
     *
     * @param projectId - The resource project ID.
     * @param version - The endpoint API version.
     * @constructor
     */
    constructor(app, version = 'v1') {
        this.app = app;
        this.version = version;
        if (useEmulator()) {
            this.urlFormat = utils.formatString(FIREBASE_AUTH_EMULATOR_BASE_URL_FORMAT, {
                host: emulatorHost()
            });
        }
        else {
            this.urlFormat = FIREBASE_AUTH_BASE_URL_FORMAT;
        }
    }
    /**
     * Returns the resource URL corresponding to the provided parameters.
     *
     * @param api - The backend API name.
     * @param params - The optional additional parameters to substitute in the
     *     URL path.
     * @returns The corresponding resource URL.
     */
    getUrl(api, params) {
        return this.getProjectId()
            .then((projectId) => {
            const baseParams = {
                version: this.version,
                projectId,
                api: api || '',
            };
            const baseUrl = utils.formatString(this.urlFormat, baseParams);
            // Substitute additional api related parameters.
            return utils.formatString(baseUrl, params || {});
        });
    }
    getProjectId() {
        if (this.projectId) {
            return Promise.resolve(this.projectId);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CREDENTIAL, 'Failed to determine project ID for Auth. Initialize the '
                    + 'SDK with service account credentials or set project ID as an app option. '
                    + 'Alternatively set the GOOGLE_CLOUD_PROJECT environment variable.');
            }
            this.projectId = projectId;
            return projectId;
        });
    }
}
/** Tenant aware resource builder utility. */
class TenantAwareAuthResourceUrlBuilder extends AuthResourceUrlBuilder {
    /**
     * The tenant aware resource URL builder constructor.
     *
     * @param projectId - The resource project ID.
     * @param version - The endpoint API version.
     * @param tenantId - The tenant ID.
     * @constructor
     */
    constructor(app, version, tenantId) {
        super(app, version);
        this.app = app;
        this.version = version;
        this.tenantId = tenantId;
        if (useEmulator()) {
            this.urlFormat = utils.formatString(FIREBASE_AUTH_EMULATOR_TENANT_URL_FORMAT, {
                host: emulatorHost()
            });
        }
        else {
            this.urlFormat = FIREBASE_AUTH_TENANT_URL_FORMAT;
        }
    }
    /**
     * Returns the resource URL corresponding to the provided parameters.
     *
     * @param api - The backend API name.
     * @param params - The optional additional parameters to substitute in the
     *     URL path.
     * @returns The corresponding resource URL.
     */
    getUrl(api, params) {
        return super.getUrl(api, params)
            .then((url) => {
            return utils.formatString(url, { tenantId: this.tenantId });
        });
    }
}
/**
 * Auth-specific HTTP client which uses the special "owner" token
 * when communicating with the Auth Emulator.
 */
class AuthHttpClient extends api_request_1.AuthorizedHttpClient {
    getToken() {
        if (useEmulator()) {
            return Promise.resolve('owner');
        }
        return super.getToken();
    }
}
/**
 * Validates an AuthFactorInfo object. All unsupported parameters
 * are removed from the original request. If an invalid field is passed
 * an error is thrown.
 *
 * @param request - The AuthFactorInfo request object.
 */
function validateAuthFactorInfo(request) {
    const validKeys = {
        mfaEnrollmentId: true,
        displayName: true,
        phoneInfo: true,
        enrolledAt: true,
    };
    // Remove unsupported keys from the original request.
    for (const key in request) {
        if (!(key in validKeys)) {
            delete request[key];
        }
    }
    // No enrollment ID is available for signupNewUser. Use another identifier.
    const authFactorInfoIdentifier = request.mfaEnrollmentId || request.phoneInfo || JSON.stringify(request);
    // Enrollment uid may or may not be specified for update operations.
    if (typeof request.mfaEnrollmentId !== 'undefined' &&
        !validator.isNonEmptyString(request.mfaEnrollmentId)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID, 'The second factor "uid" must be a valid non-empty string.');
    }
    if (typeof request.displayName !== 'undefined' &&
        !validator.isString(request.displayName)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DISPLAY_NAME, `The second factor "displayName" for "${authFactorInfoIdentifier}" must be a valid string.`);
    }
    // enrolledAt must be a valid UTC date string.
    if (typeof request.enrolledAt !== 'undefined' &&
        !validator.isISODateString(request.enrolledAt)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ENROLLMENT_TIME, `The second factor "enrollmentTime" for "${authFactorInfoIdentifier}" must be a valid ` +
            'UTC date string.');
    }
    // Validate required fields depending on second factor type.
    if (typeof request.phoneInfo !== 'undefined') {
        // phoneNumber should be a string and a valid phone number.
        if (!validator.isPhoneNumber(request.phoneInfo)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHONE_NUMBER, `The second factor "phoneNumber" for "${authFactorInfoIdentifier}" must be a non-empty ` +
                'E.164 standard compliant identifier string.');
        }
    }
    else {
        // Invalid second factor. For example, a phone second factor may have been provided without
        // a phone number. A TOTP based second factor may require a secret key, etc.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ENROLLED_FACTORS, 'MFAInfo object provided is invalid.');
    }
}
/**
 * Validates a providerUserInfo object. All unsupported parameters
 * are removed from the original request. If an invalid field is passed
 * an error is thrown.
 *
 * @param request - The providerUserInfo request object.
 */
function validateProviderUserInfo(request) {
    const validKeys = {
        rawId: true,
        providerId: true,
        email: true,
        displayName: true,
        photoUrl: true,
    };
    // Remove invalid keys from original request.
    for (const key in request) {
        if (!(key in validKeys)) {
            delete request[key];
        }
    }
    if (!validator.isNonEmptyString(request.providerId)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID);
    }
    if (typeof request.displayName !== 'undefined' &&
        typeof request.displayName !== 'string') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DISPLAY_NAME, `The provider "displayName" for "${request.providerId}" must be a valid string.`);
    }
    if (!validator.isNonEmptyString(request.rawId)) {
        // This is called localId on the backend but the developer specifies this as
        // uid externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID, `The provider "uid" for "${request.providerId}" must be a valid non-empty string.`);
    }
    // email should be a string and a valid email.
    if (typeof request.email !== 'undefined' && !validator.isEmail(request.email)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL, `The provider "email" for "${request.providerId}" must be a valid email string.`);
    }
    // photoUrl should be a URL.
    if (typeof request.photoUrl !== 'undefined' &&
        !validator.isURL(request.photoUrl)) {
        // This is called photoUrl on the backend but the developer specifies this as
        // photoURL externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHOTO_URL, `The provider "photoURL" for "${request.providerId}" must be a valid URL string.`);
    }
}
/**
 * Validates a create/edit request object. All unsupported parameters
 * are removed from the original request. If an invalid field is passed
 * an error is thrown.
 *
 * @param request - The create/edit request object.
 * @param writeOperationType - The write operation type.
 */
function validateCreateEditRequest(request, writeOperationType) {
    const uploadAccountRequest = writeOperationType === WriteOperationType.Upload;
    // Hash set of whitelisted parameters.
    const validKeys = {
        displayName: true,
        localId: true,
        email: true,
        password: true,
        rawPassword: true,
        emailVerified: true,
        photoUrl: true,
        disabled: true,
        disableUser: true,
        deleteAttribute: true,
        deleteProvider: true,
        sanityCheck: true,
        phoneNumber: true,
        customAttributes: true,
        validSince: true,
        // Pass linkProviderUserInfo only for updates (i.e. not for uploads.)
        linkProviderUserInfo: !uploadAccountRequest,
        // Pass tenantId only for uploadAccount requests.
        tenantId: uploadAccountRequest,
        passwordHash: uploadAccountRequest,
        salt: uploadAccountRequest,
        createdAt: uploadAccountRequest,
        lastLoginAt: uploadAccountRequest,
        providerUserInfo: uploadAccountRequest,
        mfaInfo: uploadAccountRequest,
        // Only for non-uploadAccount requests.
        mfa: !uploadAccountRequest,
    };
    // Remove invalid keys from original request.
    for (const key in request) {
        if (!(key in validKeys)) {
            delete request[key];
        }
    }
    if (typeof request.tenantId !== 'undefined' &&
        !validator.isNonEmptyString(request.tenantId)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TENANT_ID);
    }
    // For any invalid parameter, use the external key name in the error description.
    // displayName should be a string.
    if (typeof request.displayName !== 'undefined' &&
        !validator.isString(request.displayName)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DISPLAY_NAME);
    }
    if ((typeof request.localId !== 'undefined' || uploadAccountRequest) &&
        !validator.isUid(request.localId)) {
        // This is called localId on the backend but the developer specifies this as
        // uid externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID);
    }
    // email should be a string and a valid email.
    if (typeof request.email !== 'undefined' && !validator.isEmail(request.email)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL);
    }
    // phoneNumber should be a string and a valid phone number.
    if (typeof request.phoneNumber !== 'undefined' &&
        !validator.isPhoneNumber(request.phoneNumber)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHONE_NUMBER);
    }
    // password should be a string and a minimum of 6 chars.
    if (typeof request.password !== 'undefined' &&
        !validator.isPassword(request.password)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD);
    }
    // rawPassword should be a string and a minimum of 6 chars.
    if (typeof request.rawPassword !== 'undefined' &&
        !validator.isPassword(request.rawPassword)) {
        // This is called rawPassword on the backend but the developer specifies this as
        // password externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD);
    }
    // emailVerified should be a boolean.
    if (typeof request.emailVerified !== 'undefined' &&
        typeof request.emailVerified !== 'boolean') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL_VERIFIED);
    }
    // photoUrl should be a URL.
    if (typeof request.photoUrl !== 'undefined' &&
        !validator.isURL(request.photoUrl)) {
        // This is called photoUrl on the backend but the developer specifies this as
        // photoURL externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHOTO_URL);
    }
    // disabled should be a boolean.
    if (typeof request.disabled !== 'undefined' &&
        typeof request.disabled !== 'boolean') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DISABLED_FIELD);
    }
    // validSince should be a number.
    if (typeof request.validSince !== 'undefined' &&
        !validator.isNumber(request.validSince)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TOKENS_VALID_AFTER_TIME);
    }
    // createdAt should be a number.
    if (typeof request.createdAt !== 'undefined' &&
        !validator.isNumber(request.createdAt)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CREATION_TIME);
    }
    // lastSignInAt should be a number.
    if (typeof request.lastLoginAt !== 'undefined' &&
        !validator.isNumber(request.lastLoginAt)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_LAST_SIGN_IN_TIME);
    }
    // disableUser should be a boolean.
    if (typeof request.disableUser !== 'undefined' &&
        typeof request.disableUser !== 'boolean') {
        // This is called disableUser on the backend but the developer specifies this as
        // disabled externally. So the error message should use the client facing name.
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_DISABLED_FIELD);
    }
    // customAttributes should be stringified JSON with no blacklisted claims.
    // The payload should not exceed 1KB.
    if (typeof request.customAttributes !== 'undefined') {
        let developerClaims;
        try {
            developerClaims = JSON.parse(request.customAttributes);
        }
        catch (error) {
            // JSON parsing error. This should never happen as we stringify the claims internally.
            // However, we still need to check since setAccountInfo via edit requests could pass
            // this field.
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CLAIMS, error.message);
        }
        const invalidClaims = [];
        // Check for any invalid claims.
        exports.RESERVED_CLAIMS.forEach((blacklistedClaim) => {
            if (Object.prototype.hasOwnProperty.call(developerClaims, blacklistedClaim)) {
                invalidClaims.push(blacklistedClaim);
            }
        });
        // Throw an error if an invalid claim is detected.
        if (invalidClaims.length > 0) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.FORBIDDEN_CLAIM, invalidClaims.length > 1 ?
                `Developer claims "${invalidClaims.join('", "')}" are reserved and cannot be specified.` :
                `Developer claim "${invalidClaims[0]}" is reserved and cannot be specified.`);
        }
        // Check claims payload does not exceed maxmimum size.
        if (request.customAttributes.length > MAX_CLAIMS_PAYLOAD_SIZE) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.CLAIMS_TOO_LARGE, `Developer claims payload should not exceed ${MAX_CLAIMS_PAYLOAD_SIZE} characters.`);
        }
    }
    // passwordHash has to be a base64 encoded string.
    if (typeof request.passwordHash !== 'undefined' &&
        !validator.isString(request.passwordHash)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD_HASH);
    }
    // salt has to be a base64 encoded string.
    if (typeof request.salt !== 'undefined' &&
        !validator.isString(request.salt)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PASSWORD_SALT);
    }
    // providerUserInfo has to be an array of valid UserInfo requests.
    if (typeof request.providerUserInfo !== 'undefined' &&
        !validator.isArray(request.providerUserInfo)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_DATA);
    }
    else if (validator.isArray(request.providerUserInfo)) {
        request.providerUserInfo.forEach((providerUserInfoEntry) => {
            validateProviderUserInfo(providerUserInfoEntry);
        });
    }
    // linkProviderUserInfo must be a (single) UserProvider value.
    if (typeof request.linkProviderUserInfo !== 'undefined') {
        validateProviderUserInfo(request.linkProviderUserInfo);
    }
    // mfaInfo is used for importUsers.
    // mfa.enrollments is used for setAccountInfo.
    // enrollments has to be an array of valid AuthFactorInfo requests.
    let enrollments = null;
    if (request.mfaInfo) {
        enrollments = request.mfaInfo;
    }
    else if (request.mfa && request.mfa.enrollments) {
        enrollments = request.mfa.enrollments;
    }
    if (enrollments) {
        if (!validator.isArray(enrollments)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ENROLLED_FACTORS);
        }
        enrollments.forEach((authFactorInfoEntry) => {
            validateAuthFactorInfo(authFactorInfoEntry);
        });
    }
}
/**
 * Instantiates the createSessionCookie endpoint settings.
 *
 * @internal
 */
exports.FIREBASE_AUTH_CREATE_SESSION_COOKIE = new api_request_1.ApiSettings(':createSessionCookie', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    // Validate the ID token is a non-empty string.
    if (!validator.isNonEmptyString(request.idToken)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ID_TOKEN);
    }
    // Validate the custom session cookie duration.
    if (!validator.isNumber(request.validDuration) ||
        request.validDuration < MIN_SESSION_COOKIE_DURATION_SECS ||
        request.validDuration > MAX_SESSION_COOKIE_DURATION_SECS) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_SESSION_COOKIE_DURATION);
    }
})
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the session cookie.
    if (!validator.isNonEmptyString(response.sessionCookie)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR);
    }
});
/**
 * Instantiates the uploadAccount endpoint settings.
 *
 * @internal
 */
exports.FIREBASE_AUTH_UPLOAD_ACCOUNT = new api_request_1.ApiSettings('/accounts:batchCreate', 'POST');
/**
 * Instantiates the downloadAccount endpoint settings.
 *
 * @internal
 */
exports.FIREBASE_AUTH_DOWNLOAD_ACCOUNT = new api_request_1.ApiSettings('/accounts:batchGet', 'GET')
    // Set request validator.
    .setRequestValidator((request) => {
    // Validate next page token.
    if (typeof request.nextPageToken !== 'undefined' &&
        !validator.isNonEmptyString(request.nextPageToken)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PAGE_TOKEN);
    }
    // Validate max results.
    if (!validator.isNumber(request.maxResults) ||
        request.maxResults <= 0 ||
        request.maxResults > MAX_DOWNLOAD_ACCOUNT_PAGE_SIZE) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Required "maxResults" must be a positive integer that does not exceed ' +
            `${MAX_DOWNLOAD_ACCOUNT_PAGE_SIZE}.`);
    }
});
/**
 * Instantiates the getAccountInfo endpoint settings.
 *
 * @internal
 */
exports.FIREBASE_AUTH_GET_ACCOUNT_INFO = new api_request_1.ApiSettings('/accounts:lookup', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    if (!request.localId && !request.email && !request.phoneNumber && !request.federatedUserId) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing user identifier');
    }
})
    // Set response validator.
    .setResponseValidator((response) => {
    if (!response.users || !response.users.length) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.USER_NOT_FOUND);
    }
});
/**
 * Instantiates the getAccountInfo endpoint settings for use when fetching info
 * for multiple accounts.
 *
 * @internal
 */
exports.FIREBASE_AUTH_GET_ACCOUNTS_INFO = new api_request_1.ApiSettings('/accounts:lookup', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    if (!request.localId && !request.email && !request.phoneNumber && !request.federatedUserId) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing user identifier');
    }
});
/**
 * Instantiates the deleteAccount endpoint settings.
 *
 * @internal
 */
exports.FIREBASE_AUTH_DELETE_ACCOUNT = new api_request_1.ApiSettings('/accounts:delete', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    if (!request.localId) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing user identifier');
    }
});
/**
 * @internal
 */
exports.FIREBASE_AUTH_BATCH_DELETE_ACCOUNTS = new api_request_1.ApiSettings('/accounts:batchDelete', 'POST')
    .setRequestValidator((request) => {
    if (!request.localIds) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing user identifiers');
    }
    if (typeof request.force === 'undefined' || request.force !== true) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing force=true field');
    }
})
    .setResponseValidator((response) => {
    const errors = response.errors || [];
    errors.forEach((batchDeleteErrorInfo) => {
        if (typeof batchDeleteErrorInfo.index === 'undefined') {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server BatchDeleteAccountResponse is missing an errors.index field');
        }
        if (!batchDeleteErrorInfo.localId) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server BatchDeleteAccountResponse is missing an errors.localId field');
        }
        // Allow the (error) message to be missing/undef.
    });
});
/**
 * Instantiates the setAccountInfo endpoint settings for updating existing accounts.
 *
 * @internal
 */
exports.FIREBASE_AUTH_SET_ACCOUNT_INFO = new api_request_1.ApiSettings('/accounts:update', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    // localId is a required parameter.
    if (typeof request.localId === 'undefined') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Server request is missing user identifier');
    }
    // Throw error when tenantId is passed in POST body.
    if (typeof request.tenantId !== 'undefined') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"tenantId" is an invalid "UpdateRequest" property.');
    }
    validateCreateEditRequest(request, WriteOperationType.Update);
})
    // Set response validator.
    .setResponseValidator((response) => {
    // If the localId is not returned, then the request failed.
    if (!response.localId) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.USER_NOT_FOUND);
    }
});
/**
 * Instantiates the signupNewUser endpoint settings for creating a new user with or without
 * uid being specified. The backend will create a new one if not provided and return it.
 *
 * @internal
 */
exports.FIREBASE_AUTH_SIGN_UP_NEW_USER = new api_request_1.ApiSettings('/accounts', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    // signupNewUser does not support customAttributes.
    if (typeof request.customAttributes !== 'undefined') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"customAttributes" cannot be set when creating a new user.');
    }
    // signupNewUser does not support validSince.
    if (typeof request.validSince !== 'undefined') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"validSince" cannot be set when creating a new user.');
    }
    // Throw error when tenantId is passed in POST body.
    if (typeof request.tenantId !== 'undefined') {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"tenantId" is an invalid "CreateRequest" property.');
    }
    validateCreateEditRequest(request, WriteOperationType.Create);
})
    // Set response validator.
    .setResponseValidator((response) => {
    // If the localId is not returned, then the request failed.
    if (!response.localId) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new user');
    }
});
const FIREBASE_AUTH_GET_OOB_CODE = new api_request_1.ApiSettings('/accounts:sendOobCode', 'POST')
    // Set request validator.
    .setRequestValidator((request) => {
    if (!validator.isEmail(request.email)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL);
    }
    if (typeof request.newEmail !== 'undefined' && !validator.isEmail(request.newEmail)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_NEW_EMAIL);
    }
    if (exports.EMAIL_ACTION_REQUEST_TYPES.indexOf(request.requestType) === -1) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, `"${request.requestType}" is not a supported email action request type.`);
    }
})
    // Set response validator.
    .setResponseValidator((response) => {
    // If the oobLink is not returned, then the request failed.
    if (!response.oobLink) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create the email action link');
    }
});
/**
 * Instantiates the retrieve OIDC configuration endpoint settings.
 *
 * @internal
 */
const GET_OAUTH_IDP_CONFIG = new api_request_1.ApiSettings('/oauthIdpConfigs/{providerId}', 'GET')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the OIDC provider resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to get OIDC configuration');
    }
});
/**
 * Instantiates the delete OIDC configuration endpoint settings.
 *
 * @internal
 */
const DELETE_OAUTH_IDP_CONFIG = new api_request_1.ApiSettings('/oauthIdpConfigs/{providerId}', 'DELETE');
/**
 * Instantiates the create OIDC configuration endpoint settings.
 *
 * @internal
 */
const CREATE_OAUTH_IDP_CONFIG = new api_request_1.ApiSettings('/oauthIdpConfigs?oauthIdpConfigId={providerId}', 'POST')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the OIDC provider resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new OIDC configuration');
    }
});
/**
 * Instantiates the update OIDC configuration endpoint settings.
 *
 * @internal
 */
const UPDATE_OAUTH_IDP_CONFIG = new api_request_1.ApiSettings('/oauthIdpConfigs/{providerId}?updateMask={updateMask}', 'PATCH')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the configuration resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update OIDC configuration');
    }
});
/**
 * Instantiates the list OIDC configuration endpoint settings.
 *
 * @internal
 */
const LIST_OAUTH_IDP_CONFIGS = new api_request_1.ApiSettings('/oauthIdpConfigs', 'GET')
    // Set request validator.
    .setRequestValidator((request) => {
    // Validate next page token.
    if (typeof request.pageToken !== 'undefined' &&
        !validator.isNonEmptyString(request.pageToken)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PAGE_TOKEN);
    }
    // Validate max results.
    if (!validator.isNumber(request.pageSize) ||
        request.pageSize <= 0 ||
        request.pageSize > MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Required "maxResults" must be a positive integer that does not exceed ' +
            `${MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE}.`);
    }
});
/**
 * Instantiates the retrieve SAML configuration endpoint settings.
 *
 * @internal
 */
const GET_INBOUND_SAML_CONFIG = new api_request_1.ApiSettings('/inboundSamlConfigs/{providerId}', 'GET')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the SAML provider resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to get SAML configuration');
    }
});
/**
 * Instantiates the delete SAML configuration endpoint settings.
 *
 * @internal
 */
const DELETE_INBOUND_SAML_CONFIG = new api_request_1.ApiSettings('/inboundSamlConfigs/{providerId}', 'DELETE');
/**
 * Instantiates the create SAML configuration endpoint settings.
 *
 * @internal
 */
const CREATE_INBOUND_SAML_CONFIG = new api_request_1.ApiSettings('/inboundSamlConfigs?inboundSamlConfigId={providerId}', 'POST')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the SAML provider resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new SAML configuration');
    }
});
/**
 * Instantiates the update SAML configuration endpoint settings.
 *
 * @internal
 */
const UPDATE_INBOUND_SAML_CONFIG = new api_request_1.ApiSettings('/inboundSamlConfigs/{providerId}?updateMask={updateMask}', 'PATCH')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain the configuration resource name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update SAML configuration');
    }
});
/**
 * Instantiates the list SAML configuration endpoint settings.
 *
 * @internal
 */
const LIST_INBOUND_SAML_CONFIGS = new api_request_1.ApiSettings('/inboundSamlConfigs', 'GET')
    // Set request validator.
    .setRequestValidator((request) => {
    // Validate next page token.
    if (typeof request.pageToken !== 'undefined' &&
        !validator.isNonEmptyString(request.pageToken)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PAGE_TOKEN);
    }
    // Validate max results.
    if (!validator.isNumber(request.pageSize) ||
        request.pageSize <= 0 ||
        request.pageSize > MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Required "maxResults" must be a positive integer that does not exceed ' +
            `${MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE}.`);
    }
});
/**
 * Class that provides the mechanism to send requests to the Firebase Auth backend endpoints.
 *
 * @internal
 */
class AbstractAuthRequestHandler {
    /**
     * @param response - The response to check for errors.
     * @returns The error code if present; null otherwise.
     */
    static getErrorCode(response) {
        return (validator.isNonNullObject(response) && response.error && response.error.message) || null;
    }
    static addUidToRequest(id, request) {
        if (!validator.isUid(id.uid)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID);
        }
        request.localId ? request.localId.push(id.uid) : request.localId = [id.uid];
        return request;
    }
    static addEmailToRequest(id, request) {
        if (!validator.isEmail(id.email)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL);
        }
        request.email ? request.email.push(id.email) : request.email = [id.email];
        return request;
    }
    static addPhoneToRequest(id, request) {
        if (!validator.isPhoneNumber(id.phoneNumber)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHONE_NUMBER);
        }
        request.phoneNumber ? request.phoneNumber.push(id.phoneNumber) : request.phoneNumber = [id.phoneNumber];
        return request;
    }
    static addProviderToRequest(id, request) {
        if (!validator.isNonEmptyString(id.providerId)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID);
        }
        if (!validator.isNonEmptyString(id.providerUid)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_UID);
        }
        const federatedUserId = {
            providerId: id.providerId,
            rawId: id.providerUid,
        };
        request.federatedUserId
            ? request.federatedUserId.push(federatedUserId)
            : request.federatedUserId = [federatedUserId];
        return request;
    }
    /**
     * @param app - The app used to fetch access tokens to sign API requests.
     * @constructor
     */
    constructor(app) {
        this.app = app;
        if (typeof app !== 'object' || app === null || !('options' in app)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'First argument passed to admin.auth() must be a valid Firebase app instance.');
        }
        this.httpClient = new AuthHttpClient(app);
    }
    /**
     * Creates a new Firebase session cookie with the specified duration that can be used for
     * session management (set as a server side session cookie with custom cookie policy).
     * The session cookie JWT will have the same payload claims as the provided ID token.
     *
     * @param idToken - The Firebase ID token to exchange for a session cookie.
     * @param expiresIn - The session cookie duration in milliseconds.
     *
     * @returns A promise that resolves on success with the created session cookie.
     */
    createSessionCookie(idToken, expiresIn) {
        const request = {
            idToken,
            // Convert to seconds.
            validDuration: Math.floor(expiresIn / 1000),
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_CREATE_SESSION_COOKIE, request)
            .then((response) => response.sessionCookie);
    }
    /**
     * Looks up a user by uid.
     *
     * @param uid - The uid of the user to lookup.
     * @returns A promise that resolves with the user information.
     */
    getAccountInfoByUid(uid) {
        if (!validator.isUid(uid)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID));
        }
        const request = {
            localId: [uid],
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_GET_ACCOUNT_INFO, request);
    }
    /**
     * Looks up a user by email.
     *
     * @param email - The email of the user to lookup.
     * @returns A promise that resolves with the user information.
     */
    getAccountInfoByEmail(email) {
        if (!validator.isEmail(email)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_EMAIL));
        }
        const request = {
            email: [email],
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_GET_ACCOUNT_INFO, request);
    }
    /**
     * Looks up a user by phone number.
     *
     * @param phoneNumber - The phone number of the user to lookup.
     * @returns A promise that resolves with the user information.
     */
    getAccountInfoByPhoneNumber(phoneNumber) {
        if (!validator.isPhoneNumber(phoneNumber)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PHONE_NUMBER));
        }
        const request = {
            phoneNumber: [phoneNumber],
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_GET_ACCOUNT_INFO, request);
    }
    getAccountInfoByFederatedUid(providerId, rawId) {
        if (!validator.isNonEmptyString(providerId) || !validator.isNonEmptyString(rawId)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID);
        }
        const request = {
            federatedUserId: [{
                    providerId,
                    rawId,
                }],
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_GET_ACCOUNT_INFO, request);
    }
    /**
     * Looks up multiple users by their identifiers (uid, email, etc).
     *
     * @param identifiers - The identifiers indicating the users
     *     to be looked up. Must have <= 100 entries.
     * @param A - promise that resolves with the set of successfully
     *     looked up users. Possibly empty if no users were looked up.
     */
    getAccountInfoByIdentifiers(identifiers) {
        if (identifiers.length === 0) {
            return Promise.resolve({ users: [] });
        }
        else if (identifiers.length > MAX_GET_ACCOUNTS_BATCH_SIZE) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MAXIMUM_USER_COUNT_EXCEEDED, '`identifiers` parameter must have <= ' + MAX_GET_ACCOUNTS_BATCH_SIZE + ' entries.');
        }
        let request = {};
        for (const id of identifiers) {
            if ((0, identifier_1.isUidIdentifier)(id)) {
                request = AbstractAuthRequestHandler.addUidToRequest(id, request);
            }
            else if ((0, identifier_1.isEmailIdentifier)(id)) {
                request = AbstractAuthRequestHandler.addEmailToRequest(id, request);
            }
            else if ((0, identifier_1.isPhoneIdentifier)(id)) {
                request = AbstractAuthRequestHandler.addPhoneToRequest(id, request);
            }
            else if ((0, identifier_1.isProviderIdentifier)(id)) {
                request = AbstractAuthRequestHandler.addProviderToRequest(id, request);
            }
            else {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Unrecognized identifier: ' + id);
            }
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_GET_ACCOUNTS_INFO, request);
    }
    /**
     * Exports the users (single batch only) with a size of maxResults and starting from
     * the offset as specified by pageToken.
     *
     * @param maxResults - The page size, 1000 if undefined. This is also the maximum
     *     allowed limit.
     * @param pageToken - The next page token. If not specified, returns users starting
     *     without any offset. Users are returned in the order they were created from oldest to
     *     newest, relative to the page token offset.
     * @returns A promise that resolves with the current batch of downloaded
     *     users and the next page token if available. For the last page, an empty list of users
     *     and no page token are returned.
     */
    downloadAccount(maxResults = MAX_DOWNLOAD_ACCOUNT_PAGE_SIZE, pageToken) {
        // Construct request.
        const request = {
            maxResults,
            nextPageToken: pageToken,
        };
        // Remove next page token if not provided.
        if (typeof request.nextPageToken === 'undefined') {
            delete request.nextPageToken;
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_DOWNLOAD_ACCOUNT, request)
            .then((response) => {
            // No more users available.
            if (!response.users) {
                response.users = [];
            }
            return response;
        });
    }
    /**
     * Imports the list of users provided to Firebase Auth. This is useful when
     * migrating from an external authentication system without having to use the Firebase CLI SDK.
     * At most, 1000 users are allowed to be imported one at a time.
     * When importing a list of password users, UserImportOptions are required to be specified.
     *
     * @param users - The list of user records to import to Firebase Auth.
     * @param options - The user import options, required when the users provided
     *     include password credentials.
     * @returns A promise that resolves when the operation completes
     *     with the result of the import. This includes the number of successful imports, the number
     *     of failed uploads and their corresponding errors.
     */
    uploadAccount(users, options) {
        // This will throw if any error is detected in the hash options.
        // For errors in the list of users, this will not throw and will report the errors and the
        // corresponding user index in the user import generated response below.
        // No need to validate raw request or raw response as this is done in UserImportBuilder.
        const userImportBuilder = new user_import_builder_1.UserImportBuilder(users, options, (userRequest) => {
            // Pass true to validate the uploadAccount specific fields.
            validateCreateEditRequest(userRequest, WriteOperationType.Upload);
        });
        const request = userImportBuilder.buildRequest();
        // Fail quickly if more users than allowed are to be imported.
        if (validator.isArray(users) && users.length > MAX_UPLOAD_ACCOUNT_BATCH_SIZE) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MAXIMUM_USER_COUNT_EXCEEDED, `A maximum of ${MAX_UPLOAD_ACCOUNT_BATCH_SIZE} users can be imported at once.`);
        }
        // If no remaining user in request after client side processing, there is no need
        // to send the request to the server.
        if (!request.users || request.users.length === 0) {
            return Promise.resolve(userImportBuilder.buildResponse([]));
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_UPLOAD_ACCOUNT, request)
            .then((response) => {
            // No error object is returned if no error encountered.
            const failedUploads = (response.error || []);
            // Rewrite response as UserImportResult and re-insert client previously detected errors.
            return userImportBuilder.buildResponse(failedUploads);
        });
    }
    /**
     * Deletes an account identified by a uid.
     *
     * @param uid - The uid of the user to delete.
     * @returns A promise that resolves when the user is deleted.
     */
    deleteAccount(uid) {
        if (!validator.isUid(uid)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID));
        }
        const request = {
            localId: uid,
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_DELETE_ACCOUNT, request);
    }
    deleteAccounts(uids, force) {
        if (uids.length === 0) {
            return Promise.resolve({});
        }
        else if (uids.length > MAX_DELETE_ACCOUNTS_BATCH_SIZE) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MAXIMUM_USER_COUNT_EXCEEDED, '`uids` parameter must have <= ' + MAX_DELETE_ACCOUNTS_BATCH_SIZE + ' entries.');
        }
        const request = {
            localIds: [],
            force,
        };
        uids.forEach((uid) => {
            if (!validator.isUid(uid)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID);
            }
            request.localIds.push(uid);
        });
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_BATCH_DELETE_ACCOUNTS, request);
    }
    /**
     * Sets additional developer claims on an existing user identified by provided UID.
     *
     * @param uid - The user to edit.
     * @param customUserClaims - The developer claims to set.
     * @returns A promise that resolves when the operation completes
     *     with the user id that was edited.
     */
    setCustomUserClaims(uid, customUserClaims) {
        // Validate user UID.
        if (!validator.isUid(uid)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID));
        }
        else if (!validator.isObject(customUserClaims)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'CustomUserClaims argument must be an object or null.'));
        }
        // Delete operation. Replace null with an empty object.
        if (customUserClaims === null) {
            customUserClaims = {};
        }
        // Construct custom user attribute editting request.
        const request = {
            localId: uid,
            customAttributes: JSON.stringify(customUserClaims),
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_SET_ACCOUNT_INFO, request)
            .then((response) => {
            return response.localId;
        });
    }
    /**
     * Edits an existing user.
     *
     * @param uid - The user to edit.
     * @param properties - The properties to set on the user.
     * @returns A promise that resolves when the operation completes
     *     with the user id that was edited.
     */
    updateExistingAccount(uid, properties) {
        if (!validator.isUid(uid)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID));
        }
        else if (!validator.isNonNullObject(properties)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Properties argument must be a non-null object.'));
        }
        else if (validator.isNonNullObject(properties.providerToLink)) {
            // TODO(rsgowman): These checks overlap somewhat with
            // validateProviderUserInfo. It may be possible to refactor a bit.
            if (!validator.isNonEmptyString(properties.providerToLink.providerId)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'providerToLink.providerId of properties argument must be a non-empty string.');
            }
            if (!validator.isNonEmptyString(properties.providerToLink.uid)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'providerToLink.uid of properties argument must be a non-empty string.');
            }
        }
        else if (typeof properties.providersToUnlink !== 'undefined') {
            if (!validator.isArray(properties.providersToUnlink)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'providersToUnlink of properties argument must be an array of strings.');
            }
            properties.providersToUnlink.forEach((providerId) => {
                if (!validator.isNonEmptyString(providerId)) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'providersToUnlink of properties argument must be an array of strings.');
                }
            });
        }
        // Build the setAccountInfo request.
        const request = (0, deep_copy_1.deepCopy)(properties);
        request.localId = uid;
        // For deleting displayName or photoURL, these values must be passed as null.
        // They will be removed from the backend request and an additional parameter
        // deleteAttribute: ['PHOTO_URL', 'DISPLAY_NAME']
        // with an array of the parameter names to delete will be passed.
        // Parameters that are deletable and their deleteAttribute names.
        // Use client facing names, photoURL instead of photoUrl.
        const deletableParams = {
            displayName: 'DISPLAY_NAME',
            photoURL: 'PHOTO_URL',
        };
        // Properties to delete if available.
        request.deleteAttribute = [];
        for (const key in deletableParams) {
            if (request[key] === null) {
                // Add property identifier to list of attributes to delete.
                request.deleteAttribute.push(deletableParams[key]);
                // Remove property from request.
                delete request[key];
            }
        }
        if (request.deleteAttribute.length === 0) {
            delete request.deleteAttribute;
        }
        // For deleting phoneNumber, this value must be passed as null.
        // It will be removed from the backend request and an additional parameter
        // deleteProvider: ['phone'] with an array of providerIds (phone in this case),
        // will be passed.
        if (request.phoneNumber === null) {
            request.deleteProvider ? request.deleteProvider.push('phone') : request.deleteProvider = ['phone'];
            delete request.phoneNumber;
        }
        if (typeof (request.providerToLink) !== 'undefined') {
            request.linkProviderUserInfo = (0, deep_copy_1.deepCopy)(request.providerToLink);
            delete request.providerToLink;
            request.linkProviderUserInfo.rawId = request.linkProviderUserInfo.uid;
            delete request.linkProviderUserInfo.uid;
        }
        if (typeof (request.providersToUnlink) !== 'undefined') {
            if (!validator.isArray(request.deleteProvider)) {
                request.deleteProvider = [];
            }
            request.deleteProvider = request.deleteProvider.concat(request.providersToUnlink);
            delete request.providersToUnlink;
        }
        // Rewrite photoURL to photoUrl.
        if (typeof request.photoURL !== 'undefined') {
            request.photoUrl = request.photoURL;
            delete request.photoURL;
        }
        // Rewrite disabled to disableUser.
        if (typeof request.disabled !== 'undefined') {
            request.disableUser = request.disabled;
            delete request.disabled;
        }
        // Construct mfa related user data.
        if (validator.isNonNullObject(request.multiFactor)) {
            if (request.multiFactor.enrolledFactors === null) {
                // Remove all second factors.
                request.mfa = {};
            }
            else if (validator.isArray(request.multiFactor.enrolledFactors)) {
                request.mfa = {
                    enrollments: [],
                };
                try {
                    request.multiFactor.enrolledFactors.forEach((multiFactorInfo) => {
                        request.mfa.enrollments.push((0, user_import_builder_1.convertMultiFactorInfoToServerFormat)(multiFactorInfo));
                    });
                }
                catch (e) {
                    return Promise.reject(e);
                }
                if (request.mfa.enrollments.length === 0) {
                    delete request.mfa.enrollments;
                }
            }
            delete request.multiFactor;
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_SET_ACCOUNT_INFO, request)
            .then((response) => {
            return response.localId;
        });
    }
    /**
     * Revokes all refresh tokens for the specified user identified by the uid provided.
     * In addition to revoking all refresh tokens for a user, all ID tokens issued
     * before revocation will also be revoked on the Auth backend. Any request with an
     * ID token generated before revocation will be rejected with a token expired error.
     * Note that due to the fact that the timestamp is stored in seconds, any tokens minted in
     * the same second as the revocation will still be valid. If there is a chance that a token
     * was minted in the last second, delay for 1 second before revoking.
     *
     * @param uid - The user whose tokens are to be revoked.
     * @returns A promise that resolves when the operation completes
     *     successfully with the user id of the corresponding user.
     */
    revokeRefreshTokens(uid) {
        // Validate user UID.
        if (!validator.isUid(uid)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_UID));
        }
        const request = {
            localId: uid,
            // validSince is in UTC seconds.
            validSince: Math.floor(new Date().getTime() / 1000),
        };
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_SET_ACCOUNT_INFO, request)
            .then((response) => {
            return response.localId;
        });
    }
    /**
     * Create a new user with the properties supplied.
     *
     * @param properties - The properties to set on the user.
     * @returns A promise that resolves when the operation completes
     *     with the user id that was created.
     */
    createNewAccount(properties) {
        if (!validator.isNonNullObject(properties)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Properties argument must be a non-null object.'));
        }
        const request = (0, deep_copy_1.deepCopy)(properties);
        // Rewrite photoURL to photoUrl.
        if (typeof request.photoURL !== 'undefined') {
            request.photoUrl = request.photoURL;
            delete request.photoURL;
        }
        // Rewrite uid to localId if it exists.
        if (typeof request.uid !== 'undefined') {
            request.localId = request.uid;
            delete request.uid;
        }
        // Construct mfa related user data.
        if (validator.isNonNullObject(request.multiFactor)) {
            if (validator.isNonEmptyArray(request.multiFactor.enrolledFactors)) {
                const mfaInfo = [];
                try {
                    request.multiFactor.enrolledFactors.forEach((multiFactorInfo) => {
                        // Enrollment time and uid are not allowed for signupNewUser endpoint.
                        // They will automatically be provisioned server side.
                        if ('enrollmentTime' in multiFactorInfo) {
                            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"enrollmentTime" is not supported when adding second factors via "createUser()"');
                        }
                        else if ('uid' in multiFactorInfo) {
                            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"uid" is not supported when adding second factors via "createUser()"');
                        }
                        mfaInfo.push((0, user_import_builder_1.convertMultiFactorInfoToServerFormat)(multiFactorInfo));
                    });
                }
                catch (e) {
                    return Promise.reject(e);
                }
                request.mfaInfo = mfaInfo;
            }
            delete request.multiFactor;
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), exports.FIREBASE_AUTH_SIGN_UP_NEW_USER, request)
            .then((response) => {
            // Return the user id.
            return response.localId;
        });
    }
    /**
     * Generates the out of band email action link for the email specified using the action code settings provided.
     * Returns a promise that resolves with the generated link.
     *
     * @param requestType - The request type. This could be either used for password reset,
     *     email verification, email link sign-in.
     * @param email - The email of the user the link is being sent to.
     * @param actionCodeSettings - The optional action code setings which defines whether
     *     the link is to be handled by a mobile app and the additional state information to be passed in the
     *     deep link, etc. Required when requestType === 'EMAIL_SIGNIN'
     * @param newEmail - The email address the account is being updated to.
     *     Required only for VERIFY_AND_CHANGE_EMAIL requests.
     * @returns A promise that resolves with the email action link.
     */
    getEmailActionLink(requestType, email, actionCodeSettings, newEmail) {
        let request = {
            requestType,
            email,
            returnOobLink: true,
            ...(typeof newEmail !== 'undefined') && { newEmail },
        };
        // ActionCodeSettings required for email link sign-in to determine the url where the sign-in will
        // be completed.
        if (typeof actionCodeSettings === 'undefined' && requestType === 'EMAIL_SIGNIN') {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, "`actionCodeSettings` is required when `requestType` === 'EMAIL_SIGNIN'"));
        }
        if (typeof actionCodeSettings !== 'undefined' || requestType === 'EMAIL_SIGNIN') {
            try {
                const builder = new action_code_settings_builder_1.ActionCodeSettingsBuilder(actionCodeSettings);
                request = (0, deep_copy_1.deepExtend)(request, builder.buildRequest());
            }
            catch (e) {
                return Promise.reject(e);
            }
        }
        if (requestType === 'VERIFY_AND_CHANGE_EMAIL' && typeof newEmail === 'undefined') {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, "`newEmail` is required when `requestType` === 'VERIFY_AND_CHANGE_EMAIL'"));
        }
        return this.invokeRequestHandler(this.getAuthUrlBuilder(), FIREBASE_AUTH_GET_OOB_CODE, request)
            .then((response) => {
            // Return the link.
            return response.oobLink;
        });
    }
    /**
     * Looks up an OIDC provider configuration by provider ID.
     *
     * @param providerId - The provider identifier of the configuration to lookup.
     * @returns A promise that resolves with the provider configuration information.
     */
    getOAuthIdpConfig(providerId) {
        if (!auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), GET_OAUTH_IDP_CONFIG, {}, { providerId });
    }
    /**
     * Lists the OIDC configurations (single batch only) with a size of maxResults and starting from
     * the offset as specified by pageToken.
     *
     * @param maxResults - The page size, 100 if undefined. This is also the maximum
     *     allowed limit.
     * @param pageToken - The next page token. If not specified, returns OIDC configurations
     *     without any offset. Configurations are returned in the order they were created from oldest to
     *     newest, relative to the page token offset.
     * @returns A promise that resolves with the current batch of downloaded
     *     OIDC configurations and the next page token if available. For the last page, an empty list of provider
     *     configuration and no page token are returned.
     */
    listOAuthIdpConfigs(maxResults = MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE, pageToken) {
        const request = {
            pageSize: maxResults,
        };
        // Add next page token if provided.
        if (typeof pageToken !== 'undefined') {
            request.pageToken = pageToken;
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), LIST_OAUTH_IDP_CONFIGS, request)
            .then((response) => {
            if (!response.oauthIdpConfigs) {
                response.oauthIdpConfigs = [];
                delete response.nextPageToken;
            }
            return response;
        });
    }
    /**
     * Deletes an OIDC configuration identified by a providerId.
     *
     * @param providerId - The identifier of the OIDC configuration to delete.
     * @returns A promise that resolves when the OIDC provider is deleted.
     */
    deleteOAuthIdpConfig(providerId) {
        if (!auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), DELETE_OAUTH_IDP_CONFIG, {}, { providerId })
            .then(() => {
            // Return nothing.
        });
    }
    /**
     * Creates a new OIDC provider configuration with the properties provided.
     *
     * @param options - The properties to set on the new OIDC provider configuration to be created.
     * @returns A promise that resolves with the newly created OIDC
     *     configuration.
     */
    createOAuthIdpConfig(options) {
        // Construct backend request.
        let request;
        try {
            request = auth_config_1.OIDCConfig.buildServerRequest(options) || {};
        }
        catch (e) {
            return Promise.reject(e);
        }
        const providerId = options.providerId;
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), CREATE_OAUTH_IDP_CONFIG, request, { providerId })
            .then((response) => {
            if (!auth_config_1.OIDCConfig.getProviderIdFromResourceName(response.name)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new OIDC provider configuration');
            }
            return response;
        });
    }
    /**
     * Updates an existing OIDC provider configuration with the properties provided.
     *
     * @param providerId - The provider identifier of the OIDC configuration to update.
     * @param options - The properties to update on the existing configuration.
     * @returns A promise that resolves with the modified provider
     *     configuration.
     */
    updateOAuthIdpConfig(providerId, options) {
        if (!auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        // Construct backend request.
        let request;
        try {
            request = auth_config_1.OIDCConfig.buildServerRequest(options, true) || {};
        }
        catch (e) {
            return Promise.reject(e);
        }
        const updateMask = utils.generateUpdateMask(request);
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), UPDATE_OAUTH_IDP_CONFIG, request, { providerId, updateMask: updateMask.join(',') })
            .then((response) => {
            if (!auth_config_1.OIDCConfig.getProviderIdFromResourceName(response.name)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update OIDC provider configuration');
            }
            return response;
        });
    }
    /**
     * Looks up an SAML provider configuration by provider ID.
     *
     * @param providerId - The provider identifier of the configuration to lookup.
     * @returns A promise that resolves with the provider configuration information.
     */
    getInboundSamlConfig(providerId) {
        if (!auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), GET_INBOUND_SAML_CONFIG, {}, { providerId });
    }
    /**
     * Lists the SAML configurations (single batch only) with a size of maxResults and starting from
     * the offset as specified by pageToken.
     *
     * @param maxResults - The page size, 100 if undefined. This is also the maximum
     *     allowed limit.
     * @param pageToken - The next page token. If not specified, returns SAML configurations starting
     *     without any offset. Configurations are returned in the order they were created from oldest to
     *     newest, relative to the page token offset.
     * @returns A promise that resolves with the current batch of downloaded
     *     SAML configurations and the next page token if available. For the last page, an empty list of provider
     *     configuration and no page token are returned.
     */
    listInboundSamlConfigs(maxResults = MAX_LIST_PROVIDER_CONFIGURATION_PAGE_SIZE, pageToken) {
        const request = {
            pageSize: maxResults,
        };
        // Add next page token if provided.
        if (typeof pageToken !== 'undefined') {
            request.pageToken = pageToken;
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), LIST_INBOUND_SAML_CONFIGS, request)
            .then((response) => {
            if (!response.inboundSamlConfigs) {
                response.inboundSamlConfigs = [];
                delete response.nextPageToken;
            }
            return response;
        });
    }
    /**
     * Deletes a SAML configuration identified by a providerId.
     *
     * @param providerId - The identifier of the SAML configuration to delete.
     * @returns A promise that resolves when the SAML provider is deleted.
     */
    deleteInboundSamlConfig(providerId) {
        if (!auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), DELETE_INBOUND_SAML_CONFIG, {}, { providerId })
            .then(() => {
            // Return nothing.
        });
    }
    /**
     * Creates a new SAML provider configuration with the properties provided.
     *
     * @param options - The properties to set on the new SAML provider configuration to be created.
     * @returns A promise that resolves with the newly created SAML
     *     configuration.
     */
    createInboundSamlConfig(options) {
        // Construct backend request.
        let request;
        try {
            request = auth_config_1.SAMLConfig.buildServerRequest(options) || {};
        }
        catch (e) {
            return Promise.reject(e);
        }
        const providerId = options.providerId;
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), CREATE_INBOUND_SAML_CONFIG, request, { providerId })
            .then((response) => {
            if (!auth_config_1.SAMLConfig.getProviderIdFromResourceName(response.name)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new SAML provider configuration');
            }
            return response;
        });
    }
    /**
     * Updates an existing SAML provider configuration with the properties provided.
     *
     * @param providerId - The provider identifier of the SAML configuration to update.
     * @param options - The properties to update on the existing configuration.
     * @returns A promise that resolves with the modified provider
     *     configuration.
     */
    updateInboundSamlConfig(providerId, options) {
        if (!auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
        }
        // Construct backend request.
        let request;
        try {
            request = auth_config_1.SAMLConfig.buildServerRequest(options, true) || {};
        }
        catch (e) {
            return Promise.reject(e);
        }
        const updateMask = utils.generateUpdateMask(request);
        return this.invokeRequestHandler(this.getProjectConfigUrlBuilder(), UPDATE_INBOUND_SAML_CONFIG, request, { providerId, updateMask: updateMask.join(',') })
            .then((response) => {
            if (!auth_config_1.SAMLConfig.getProviderIdFromResourceName(response.name)) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update SAML provider configuration');
            }
            return response;
        });
    }
    /**
     * Invokes the request handler based on the API settings object passed.
     *
     * @param urlBuilder - The URL builder for Auth endpoints.
     * @param apiSettings - The API endpoint settings to apply to request and response.
     * @param requestData - The request data.
     * @param additionalResourceParams - Additional resource related params if needed.
     * @returns A promise that resolves with the response.
     */
    invokeRequestHandler(urlBuilder, apiSettings, requestData, additionalResourceParams) {
        return urlBuilder.getUrl(apiSettings.getEndpoint(), additionalResourceParams)
            .then((url) => {
            // Validate request.
            if (requestData) {
                const requestValidator = apiSettings.getRequestValidator();
                requestValidator(requestData);
            }
            // Process request.
            const req = {
                method: apiSettings.getHttpMethod(),
                url,
                headers: FIREBASE_AUTH_HEADERS,
                data: requestData,
                timeout: FIREBASE_AUTH_TIMEOUT,
            };
            return this.httpClient.send(req);
        })
            .then((response) => {
            // Validate response.
            const responseValidator = apiSettings.getResponseValidator();
            responseValidator(response.data);
            // Return entire response.
            return response.data;
        })
            .catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                const error = err.response.data;
                const errorCode = AbstractAuthRequestHandler.getErrorCode(error);
                if (!errorCode) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'Error returned from server: ' + error + '. Additionally, an ' +
                        'internal error occurred while attempting to extract the ' +
                        'errorcode from the error.');
                }
                throw error_1.FirebaseAuthError.fromServerError(errorCode, /* message */ undefined, error);
            }
            throw err;
        });
    }
    /**
     * @returns The current Auth user management resource URL builder.
     */
    getAuthUrlBuilder() {
        if (!this.authUrlBuilder) {
            this.authUrlBuilder = this.newAuthUrlBuilder();
        }
        return this.authUrlBuilder;
    }
    /**
     * @returns The current project config resource URL builder.
     */
    getProjectConfigUrlBuilder() {
        if (!this.projectConfigUrlBuilder) {
            this.projectConfigUrlBuilder = this.newProjectConfigUrlBuilder();
        }
        return this.projectConfigUrlBuilder;
    }
}
exports.AbstractAuthRequestHandler = AbstractAuthRequestHandler;
/** Instantiates the getConfig endpoint settings. */
const GET_PROJECT_CONFIG = new api_request_1.ApiSettings('/config', 'GET')
    .setResponseValidator((response) => {
    // Response should always contain at least the config name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to get project config');
    }
});
/** Instantiates the updateConfig endpoint settings. */
const UPDATE_PROJECT_CONFIG = new api_request_1.ApiSettings('/config?updateMask={updateMask}', 'PATCH')
    .setResponseValidator((response) => {
    // Response should always contain at least the config name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update project config');
    }
});
/** Instantiates the getTenant endpoint settings. */
const GET_TENANT = new api_request_1.ApiSettings('/tenants/{tenantId}', 'GET')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain at least the tenant name.
    if (!validator.isNonEmptyString(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to get tenant');
    }
});
/** Instantiates the deleteTenant endpoint settings. */
const DELETE_TENANT = new api_request_1.ApiSettings('/tenants/{tenantId}', 'DELETE');
/** Instantiates the updateTenant endpoint settings. */
const UPDATE_TENANT = new api_request_1.ApiSettings('/tenants/{tenantId}?updateMask={updateMask}', 'PATCH')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain at least the tenant name.
    if (!validator.isNonEmptyString(response.name) ||
        !tenant_1.Tenant.getTenantIdFromResourceName(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to update tenant');
    }
});
/** Instantiates the listTenants endpoint settings. */
const LIST_TENANTS = new api_request_1.ApiSettings('/tenants', 'GET')
    // Set request validator.
    .setRequestValidator((request) => {
    // Validate next page token.
    if (typeof request.pageToken !== 'undefined' &&
        !validator.isNonEmptyString(request.pageToken)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PAGE_TOKEN);
    }
    // Validate max results.
    if (!validator.isNumber(request.pageSize) ||
        request.pageSize <= 0 ||
        request.pageSize > MAX_LIST_TENANT_PAGE_SIZE) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, 'Required "maxResults" must be a positive non-zero number that does not exceed ' +
            `the allowed ${MAX_LIST_TENANT_PAGE_SIZE}.`);
    }
});
/** Instantiates the createTenant endpoint settings. */
const CREATE_TENANT = new api_request_1.ApiSettings('/tenants', 'POST')
    // Set response validator.
    .setResponseValidator((response) => {
    // Response should always contain at least the tenant name.
    if (!validator.isNonEmptyString(response.name) ||
        !tenant_1.Tenant.getTenantIdFromResourceName(response.name)) {
        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'INTERNAL ASSERT FAILED: Unable to create new tenant');
    }
});
/**
 * Utility for sending requests to Auth server that are Auth instance related. This includes user, tenant,
 * and project config management related APIs. This extends the BaseFirebaseAuthRequestHandler class and defines
 * additional tenant management related APIs.
 */
class AuthRequestHandler extends AbstractAuthRequestHandler {
    /**
     * The FirebaseAuthRequestHandler constructor used to initialize an instance using a FirebaseApp.
     *
     * @param app - The app used to fetch access tokens to sign API requests.
     * @constructor
     */
    constructor(app) {
        super(app);
        this.authResourceUrlBuilder = new AuthResourceUrlBuilder(app, 'v2');
    }
    /**
     * @returns A new Auth user management resource URL builder instance.
     */
    newAuthUrlBuilder() {
        return new AuthResourceUrlBuilder(this.app, 'v1');
    }
    /**
     * @returns A new project config resource URL builder instance.
     */
    newProjectConfigUrlBuilder() {
        return new AuthResourceUrlBuilder(this.app, 'v2');
    }
    /**
     * Get the current project's config
     * @returns A promise that resolves with the project config information.
     */
    getProjectConfig() {
        return this.invokeRequestHandler(this.authResourceUrlBuilder, GET_PROJECT_CONFIG, {}, {})
            .then((response) => {
            return response;
        });
    }
    /**
     * Update the current project's config.
     * @returns A promise that resolves with the project config information.
     */
    updateProjectConfig(options) {
        try {
            const request = project_config_1.ProjectConfig.buildServerRequest(options);
            const updateMask = utils.generateUpdateMask(request);
            return this.invokeRequestHandler(this.authResourceUrlBuilder, UPDATE_PROJECT_CONFIG, request, { updateMask: updateMask.join(',') })
                .then((response) => {
                return response;
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    /**
     * Looks up a tenant by tenant ID.
     *
     * @param tenantId - The tenant identifier of the tenant to lookup.
     * @returns A promise that resolves with the tenant information.
     */
    getTenant(tenantId) {
        if (!validator.isNonEmptyString(tenantId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TENANT_ID));
        }
        return this.invokeRequestHandler(this.authResourceUrlBuilder, GET_TENANT, {}, { tenantId })
            .then((response) => {
            return response;
        });
    }
    /**
     * Exports the tenants (single batch only) with a size of maxResults and starting from
     * the offset as specified by pageToken.
     *
     * @param maxResults - The page size, 1000 if undefined. This is also the maximum
     *     allowed limit.
     * @param pageToken - The next page token. If not specified, returns tenants starting
     *     without any offset. Tenants are returned in the order they were created from oldest to
     *     newest, relative to the page token offset.
     * @returns A promise that resolves with the current batch of downloaded
     *     tenants and the next page token if available. For the last page, an empty list of tenants
     *     and no page token are returned.
     */
    listTenants(maxResults = MAX_LIST_TENANT_PAGE_SIZE, pageToken) {
        const request = {
            pageSize: maxResults,
            pageToken,
        };
        // Remove next page token if not provided.
        if (typeof request.pageToken === 'undefined') {
            delete request.pageToken;
        }
        return this.invokeRequestHandler(this.authResourceUrlBuilder, LIST_TENANTS, request)
            .then((response) => {
            if (!response.tenants) {
                response.tenants = [];
                delete response.nextPageToken;
            }
            return response;
        });
    }
    /**
     * Deletes a tenant identified by a tenantId.
     *
     * @param tenantId - The identifier of the tenant to delete.
     * @returns A promise that resolves when the tenant is deleted.
     */
    deleteTenant(tenantId) {
        if (!validator.isNonEmptyString(tenantId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TENANT_ID));
        }
        return this.invokeRequestHandler(this.authResourceUrlBuilder, DELETE_TENANT, undefined, { tenantId })
            .then(() => {
            // Return nothing.
        });
    }
    /**
     * Creates a new tenant with the properties provided.
     *
     * @param tenantOptions - The properties to set on the new tenant to be created.
     * @returns A promise that resolves with the newly created tenant object.
     */
    createTenant(tenantOptions) {
        try {
            // Construct backend request.
            const request = tenant_1.Tenant.buildServerRequest(tenantOptions, true);
            return this.invokeRequestHandler(this.authResourceUrlBuilder, CREATE_TENANT, request)
                .then((response) => {
                return response;
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    /**
     * Updates an existing tenant with the properties provided.
     *
     * @param tenantId - The tenant identifier of the tenant to update.
     * @param tenantOptions - The properties to update on the existing tenant.
     * @returns A promise that resolves with the modified tenant object.
     */
    updateTenant(tenantId, tenantOptions) {
        if (!validator.isNonEmptyString(tenantId)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_TENANT_ID));
        }
        try {
            // Construct backend request.
            const request = tenant_1.Tenant.buildServerRequest(tenantOptions, false);
            // Do not traverse deep into testPhoneNumbers. The entire content should be replaced
            // and not just specific phone numbers.
            const updateMask = utils.generateUpdateMask(request, ['testPhoneNumbers']);
            return this.invokeRequestHandler(this.authResourceUrlBuilder, UPDATE_TENANT, request, { tenantId, updateMask: updateMask.join(',') })
                .then((response) => {
                return response;
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
}
exports.AuthRequestHandler = AuthRequestHandler;
/**
 * Utility for sending requests to Auth server that are tenant Auth instance related. This includes user
 * management related APIs for specified tenants.
 * This extends the BaseFirebaseAuthRequestHandler class.
 */
class TenantAwareAuthRequestHandler extends AbstractAuthRequestHandler {
    /**
     * The FirebaseTenantRequestHandler constructor used to initialize an instance using a
     * FirebaseApp and a tenant ID.
     *
     * @param app - The app used to fetch access tokens to sign API requests.
     * @param tenantId - The request handler's tenant ID.
     * @constructor
     */
    constructor(app, tenantId) {
        super(app);
        this.tenantId = tenantId;
    }
    /**
     * @returns A new Auth user management resource URL builder instance.
     */
    newAuthUrlBuilder() {
        return new TenantAwareAuthResourceUrlBuilder(this.app, 'v1', this.tenantId);
    }
    /**
     * @returns A new project config resource URL builder instance.
     */
    newProjectConfigUrlBuilder() {
        return new TenantAwareAuthResourceUrlBuilder(this.app, 'v2', this.tenantId);
    }
    /**
     * Imports the list of users provided to Firebase Auth. This is useful when
     * migrating from an external authentication system without having to use the Firebase CLI SDK.
     * At most, 1000 users are allowed to be imported one at a time.
     * When importing a list of password users, UserImportOptions are required to be specified.
     *
     * Overrides the superclass methods by adding an additional check to match tenant IDs of
     * imported user records if present.
     *
     * @param users - The list of user records to import to Firebase Auth.
     * @param options - The user import options, required when the users provided
     *     include password credentials.
     * @returns A promise that resolves when the operation completes
     *     with the result of the import. This includes the number of successful imports, the number
     *     of failed uploads and their corresponding errors.
     */
    uploadAccount(users, options) {
        // Add additional check to match tenant ID of imported user records.
        users.forEach((user, index) => {
            if (validator.isNonEmptyString(user.tenantId) &&
                user.tenantId !== this.tenantId) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.MISMATCHING_TENANT_ID, `UserRecord of index "${index}" has mismatching tenant ID "${user.tenantId}"`);
            }
        });
        return super.uploadAccount(users, options);
    }
}
exports.TenantAwareAuthRequestHandler = TenantAwareAuthRequestHandler;
function emulatorHost() {
    return process.env.FIREBASE_AUTH_EMULATOR_HOST;
}
/**
 * When true the SDK should communicate with the Auth Emulator for all API
 * calls and also produce unsigned tokens.
 */
function useEmulator() {
    return !!emulatorHost();
}
