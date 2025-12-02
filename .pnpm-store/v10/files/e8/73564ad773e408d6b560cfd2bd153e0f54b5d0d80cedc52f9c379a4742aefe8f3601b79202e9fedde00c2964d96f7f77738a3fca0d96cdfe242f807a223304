/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAuth = void 0;
exports.createFirebaseTokenGenerator = createFirebaseTokenGenerator;
const error_1 = require("../utils/error");
const deep_copy_1 = require("../utils/deep-copy");
const validator = require("../utils/validator");
const auth_api_request_1 = require("./auth-api-request");
const token_generator_1 = require("./token-generator");
const token_verifier_1 = require("./token-verifier");
const auth_config_1 = require("./auth-config");
const user_record_1 = require("./user-record");
const identifier_1 = require("./identifier");
const crypto_signer_1 = require("../utils/crypto-signer");
/**
 * @internal
 */
function createFirebaseTokenGenerator(app, tenantId) {
    try {
        const signer = (0, auth_api_request_1.useEmulator)() ? new token_generator_1.EmulatedSigner() : (0, crypto_signer_1.cryptoSignerFromApp)(app);
        return new token_generator_1.FirebaseTokenGenerator(signer, tenantId);
    }
    catch (err) {
        throw (0, token_generator_1.handleCryptoSignerError)(err);
    }
}
/**
 * Common parent interface for both `Auth` and `TenantAwareAuth` APIs.
 */
class BaseAuth {
    /**
     * The BaseAuth class constructor.
     *
     * @param app - The FirebaseApp to associate with this Auth instance.
     * @param authRequestHandler - The RPC request handler for this instance.
     * @param tokenGenerator - Optional token generator. If not specified, a
     *     (non-tenant-aware) instance will be created. Use this paramter to
     *     specify a tenant-aware tokenGenerator.
     * @constructor
     * @internal
     */
    constructor(app, 
    /** @internal */ authRequestHandler, tokenGenerator) {
        this.authRequestHandler = authRequestHandler;
        if (tokenGenerator) {
            this.tokenGenerator = tokenGenerator;
        }
        else {
            this.tokenGenerator = createFirebaseTokenGenerator(app);
        }
        this.sessionCookieVerifier = (0, token_verifier_1.createSessionCookieVerifier)(app);
        this.idTokenVerifier = (0, token_verifier_1.createIdTokenVerifier)(app);
        this.authBlockingTokenVerifier = (0, token_verifier_1.createAuthBlockingTokenVerifier)(app);
    }
    /**
     * Creates a new Firebase custom token (JWT) that can be sent back to a client
     * device to use to sign in with the client SDKs' `signInWithCustomToken()`
     * methods. (Tenant-aware instances will also embed the tenant ID in the
     * token.)
     *
     * See {@link https://firebase.google.com/docs/auth/admin/create-custom-tokens | Create Custom Tokens}
     * for code samples and detailed documentation.
     *
     * @param uid - The `uid` to use as the custom token's subject.
     * @param developerClaims - Optional additional claims to include
     *   in the custom token's payload.
     *
     * @returns A promise fulfilled with a custom token for the
     *   provided `uid` and payload.
     */
    createCustomToken(uid, developerClaims) {
        return this.tokenGenerator.createCustomToken(uid, developerClaims);
    }
    /**
     * Verifies a Firebase ID token (JWT). If the token is valid, the promise is
     * fulfilled with the token's decoded claims; otherwise, the promise is
     * rejected.
     *
     * If `checkRevoked` is set to true, first verifies whether the corresponding
     * user is disabled. If yes, an `auth/user-disabled` error is thrown. If no,
     * verifies if the session corresponding to the ID token was revoked. If the
     * corresponding user's session was invalidated, an `auth/id-token-revoked`
     * error is thrown. If not specified the check is not applied.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/verify-id-tokens | Verify ID Tokens}
     * for code samples and detailed documentation.
     *
     * @param idToken - The ID token to verify.
     * @param checkRevoked - Whether to check if the ID token was revoked.
     *   This requires an extra request to the Firebase Auth backend to check
     *   the `tokensValidAfterTime` time for the corresponding user.
     *   When not specified, this additional check is not applied.
     *
     * @returns A promise fulfilled with the
     *   token's decoded claims if the ID token is valid; otherwise, a rejected
     *   promise.
     */
    verifyIdToken(idToken, checkRevoked = false) {
        const isEmulator = (0, auth_api_request_1.useEmulator)();
        return this.idTokenVerifier.verifyJWT(idToken, isEmulator)
            .then((decodedIdToken) => {
            // Whether to check if the token was revoked.
            if (checkRevoked || isEmulator) {
                return this.verifyDecodedJWTNotRevokedOrDisabled(decodedIdToken, error_1.AuthClientErrorCode.ID_TOKEN_REVOKED);
            }
            return decodedIdToken;
        });
    }
    /**
     * Gets the user data for the user corresponding to a given `uid`.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
     * for code samples and detailed documentation.
     *
     * @param uid - The `uid` corresponding to the user whose data to fetch.
     *
     * @returns A promise fulfilled with the user
     *   data corresponding to the provided `uid`.
     */
    getUser(uid) {
        return this.authRequestHandler.getAccountInfoByUid(uid)
            .then((response) => {
            // Returns the user record populated with server response.
            return new user_record_1.UserRecord(response.users[0]);
        });
    }
    /**
     * Gets the user data for the user corresponding to a given email.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
     * for code samples and detailed documentation.
     *
     * @param email - The email corresponding to the user whose data to
     *   fetch.
     *
     * @returns A promise fulfilled with the user
     *   data corresponding to the provided email.
     */
    getUserByEmail(email) {
        return this.authRequestHandler.getAccountInfoByEmail(email)
            .then((response) => {
            // Returns the user record populated with server response.
            return new user_record_1.UserRecord(response.users[0]);
        });
    }
    /**
     * Gets the user data for the user corresponding to a given phone number. The
     * phone number has to conform to the E.164 specification.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
     * for code samples and detailed documentation.
     *
     * @param phoneNumber - The phone number corresponding to the user whose
     *   data to fetch.
     *
     * @returns A promise fulfilled with the user
     *   data corresponding to the provided phone number.
     */
    getUserByPhoneNumber(phoneNumber) {
        return this.authRequestHandler.getAccountInfoByPhoneNumber(phoneNumber)
            .then((response) => {
            // Returns the user record populated with server response.
            return new user_record_1.UserRecord(response.users[0]);
        });
    }
    /**
     * Gets the user data for the user corresponding to a given provider id.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#retrieve_user_data | Retrieve user data}
     * for code samples and detailed documentation.
     *
     * @param providerId - The provider ID, for example, "google.com" for the
     *   Google provider.
     * @param uid - The user identifier for the given provider.
     *
     * @returns A promise fulfilled with the user data corresponding to the
     *   given provider id.
     */
    getUserByProviderUid(providerId, uid) {
        // Although we don't really advertise it, we want to also handle
        // non-federated idps with this call. So if we detect one of them, we'll
        // reroute this request appropriately.
        if (providerId === 'phone') {
            return this.getUserByPhoneNumber(uid);
        }
        else if (providerId === 'email') {
            return this.getUserByEmail(uid);
        }
        return this.authRequestHandler.getAccountInfoByFederatedUid(providerId, uid)
            .then((response) => {
            // Returns the user record populated with server response.
            return new user_record_1.UserRecord(response.users[0]);
        });
    }
    /**
     * Gets the user data corresponding to the specified identifiers.
     *
     * There are no ordering guarantees; in particular, the nth entry in the result list is not
     * guaranteed to correspond to the nth entry in the input parameters list.
     *
     * Only a maximum of 100 identifiers may be supplied. If more than 100 identifiers are supplied,
     * this method throws a FirebaseAuthError.
     *
     * @param identifiers - The identifiers used to indicate which user records should be returned.
     *     Must not have more than 100 entries.
     * @returns A promise that resolves to the corresponding user records.
     * @throws FirebaseAuthError If any of the identifiers are invalid or if more than 100
     *     identifiers are specified.
     */
    getUsers(identifiers) {
        if (!validator.isArray(identifiers)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '`identifiers` parameter must be an array');
        }
        return this.authRequestHandler
            .getAccountInfoByIdentifiers(identifiers)
            .then((response) => {
            /**
             * Checks if the specified identifier is within the list of
             * UserRecords.
             */
            const isUserFound = ((id, userRecords) => {
                return !!userRecords.find((userRecord) => {
                    if ((0, identifier_1.isUidIdentifier)(id)) {
                        return id.uid === userRecord.uid;
                    }
                    else if ((0, identifier_1.isEmailIdentifier)(id)) {
                        return id.email === userRecord.email;
                    }
                    else if ((0, identifier_1.isPhoneIdentifier)(id)) {
                        return id.phoneNumber === userRecord.phoneNumber;
                    }
                    else if ((0, identifier_1.isProviderIdentifier)(id)) {
                        const matchingUserInfo = userRecord.providerData.find((userInfo) => {
                            return id.providerId === userInfo.providerId;
                        });
                        return !!matchingUserInfo && id.providerUid === matchingUserInfo.uid;
                    }
                    else {
                        throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'Unhandled identifier type');
                    }
                });
            });
            const users = response.users ? response.users.map((user) => new user_record_1.UserRecord(user)) : [];
            const notFound = identifiers.filter((id) => !isUserFound(id, users));
            return { users, notFound };
        });
    }
    /**
     * Retrieves a list of users (single batch only) with a size of `maxResults`
     * starting from the offset as specified by `pageToken`. This is used to
     * retrieve all the users of a specified project in batches.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#list_all_users | List all users}
     * for code samples and detailed documentation.
     *
     * @param maxResults - The page size, 1000 if undefined. This is also
     *   the maximum allowed limit.
     * @param pageToken - The next page token. If not specified, returns
     *   users starting without any offset.
     * @returns A promise that resolves with
     *   the current batch of downloaded users and the next page token.
     */
    listUsers(maxResults, pageToken) {
        return this.authRequestHandler.downloadAccount(maxResults, pageToken)
            .then((response) => {
            // List of users to return.
            const users = [];
            // Convert each user response to a UserRecord.
            response.users.forEach((userResponse) => {
                users.push(new user_record_1.UserRecord(userResponse));
            });
            // Return list of user records and the next page token if available.
            const result = {
                users,
                pageToken: response.nextPageToken,
            };
            // Delete result.pageToken if undefined.
            if (typeof result.pageToken === 'undefined') {
                delete result.pageToken;
            }
            return result;
        });
    }
    /**
     * Creates a new user.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#create_a_user | Create a user}
     * for code samples and detailed documentation.
     *
     * @param properties - The properties to set on the
     *   new user record to be created.
     *
     * @returns A promise fulfilled with the user
     *   data corresponding to the newly created user.
     */
    createUser(properties) {
        return this.authRequestHandler.createNewAccount(properties)
            .then((uid) => {
            // Return the corresponding user record.
            return this.getUser(uid);
        })
            .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                // Something must have happened after creating the user and then retrieving it.
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'Unable to create the user record provided.');
            }
            throw error;
        });
    }
    /**
     * Deletes an existing user.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#delete_a_user | Delete a user}
     * for code samples and detailed documentation.
     *
     * @param uid - The `uid` corresponding to the user to delete.
     *
     * @returns An empty promise fulfilled once the user has been
     *   deleted.
     */
    deleteUser(uid) {
        return this.authRequestHandler.deleteAccount(uid)
            .then(() => {
            // Return nothing on success.
        });
    }
    /**
     * Deletes the users specified by the given uids.
     *
     * Deleting a non-existing user won't generate an error (i.e. this method
     * is idempotent.) Non-existing users are considered to be successfully
     * deleted, and are therefore counted in the
     * `DeleteUsersResult.successCount` value.
     *
     * Only a maximum of 1000 identifiers may be supplied. If more than 1000
     * identifiers are supplied, this method throws a FirebaseAuthError.
     *
     * This API is currently rate limited at the server to 1 QPS. If you exceed
     * this, you may get a quota exceeded error. Therefore, if you want to
     * delete more than 1000 users, you may need to add a delay to ensure you
     * don't go over this limit.
     *
     * @param uids - The `uids` corresponding to the users to delete.
     *
     * @returns A Promise that resolves to the total number of successful/failed
     *     deletions, as well as the array of errors that corresponds to the
     *     failed deletions.
     */
    deleteUsers(uids) {
        if (!validator.isArray(uids)) {
            throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '`uids` parameter must be an array');
        }
        return this.authRequestHandler.deleteAccounts(uids, /*force=*/ true)
            .then((batchDeleteAccountsResponse) => {
            const result = {
                failureCount: 0,
                successCount: uids.length,
                errors: [],
            };
            if (!validator.isNonEmptyArray(batchDeleteAccountsResponse.errors)) {
                return result;
            }
            result.failureCount = batchDeleteAccountsResponse.errors.length;
            result.successCount = uids.length - batchDeleteAccountsResponse.errors.length;
            result.errors = batchDeleteAccountsResponse.errors.map((batchDeleteErrorInfo) => {
                if (batchDeleteErrorInfo.index === undefined) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INTERNAL_ERROR, 'Corrupt BatchDeleteAccountsResponse detected');
                }
                const errMsgToError = (msg) => {
                    // We unconditionally set force=true, so the 'NOT_DISABLED' error
                    // should not be possible.
                    const code = msg && msg.startsWith('NOT_DISABLED') ?
                        error_1.AuthClientErrorCode.USER_NOT_DISABLED : error_1.AuthClientErrorCode.INTERNAL_ERROR;
                    return new error_1.FirebaseAuthError(code, batchDeleteErrorInfo.message);
                };
                return {
                    index: batchDeleteErrorInfo.index,
                    error: errMsgToError(batchDeleteErrorInfo.message),
                };
            });
            return result;
        });
    }
    /**
     * Updates an existing user.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-users#update_a_user | Update a user}
     * for code samples and detailed documentation.
     *
     * @param uid - The `uid` corresponding to the user to update.
     * @param properties - The properties to update on
     *   the provided user.
     *
     * @returns A promise fulfilled with the
     *   updated user data.
     */
    updateUser(uid, properties) {
        // Although we don't really advertise it, we want to also handle linking of
        // non-federated idps with this call. So if we detect one of them, we'll
        // adjust the properties parameter appropriately. This *does* imply that a
        // conflict could arise, e.g. if the user provides a phoneNumber property,
        // but also provides a providerToLink with a 'phone' provider id. In that
        // case, we'll throw an error.
        properties = (0, deep_copy_1.deepCopy)(properties);
        if (properties?.providerToLink) {
            if (properties.providerToLink.providerId === 'email') {
                if (typeof properties.email !== 'undefined') {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, "Both UpdateRequest.email and UpdateRequest.providerToLink.providerId='email' were set. To "
                        + 'link to the email/password provider, only specify the UpdateRequest.email field.');
                }
                properties.email = properties.providerToLink.uid;
                delete properties.providerToLink;
            }
            else if (properties.providerToLink.providerId === 'phone') {
                if (typeof properties.phoneNumber !== 'undefined') {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, "Both UpdateRequest.phoneNumber and UpdateRequest.providerToLink.providerId='phone' were set. To "
                        + 'link to a phone provider, only specify the UpdateRequest.phoneNumber field.');
                }
                properties.phoneNumber = properties.providerToLink.uid;
                delete properties.providerToLink;
            }
        }
        if (properties?.providersToUnlink) {
            if (properties.providersToUnlink.indexOf('phone') !== -1) {
                // If we've been told to unlink the phone provider both via setting
                // phoneNumber to null *and* by setting providersToUnlink to include
                // 'phone', then we'll reject that. Though it might also be reasonable
                // to relax this restriction and just unlink it.
                if (properties.phoneNumber === null) {
                    throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, "Both UpdateRequest.phoneNumber=null and UpdateRequest.providersToUnlink=['phone'] were set. To "
                        + 'unlink from a phone provider, only specify the UpdateRequest.phoneNumber=null field.');
                }
            }
        }
        return this.authRequestHandler.updateExistingAccount(uid, properties)
            .then((existingUid) => {
            // Return the corresponding user record.
            return this.getUser(existingUid);
        });
    }
    /**
     * Sets additional developer claims on an existing user identified by the
     * provided `uid`, typically used to define user roles and levels of
     * access. These claims should propagate to all devices where the user is
     * already signed in (after token expiration or when token refresh is forced)
     * and the next time the user signs in. If a reserved OIDC claim name
     * is used (sub, iat, iss, etc), an error is thrown. They are set on the
     * authenticated user's ID token JWT.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/custom-claims |
     * Defining user roles and access levels}
     * for code samples and detailed documentation.
     *
     * @param uid - The `uid` of the user to edit.
     * @param customUserClaims - The developer claims to set. If null is
     *   passed, existing custom claims are deleted. Passing a custom claims payload
     *   larger than 1000 bytes will throw an error. Custom claims are added to the
     *   user's ID token which is transmitted on every authenticated request.
     *   For profile non-access related user attributes, use database or other
     *   separate storage systems.
     * @returns A promise that resolves when the operation completes
     *   successfully.
     */
    setCustomUserClaims(uid, customUserClaims) {
        return this.authRequestHandler.setCustomUserClaims(uid, customUserClaims)
            .then(() => {
            // Return nothing on success.
        });
    }
    /**
     * Revokes all refresh tokens for an existing user.
     *
     * This API will update the user's {@link UserRecord.tokensValidAfterTime} to
     * the current UTC. It is important that the server on which this is called has
     * its clock set correctly and synchronized.
     *
     * While this will revoke all sessions for a specified user and disable any
     * new ID tokens for existing sessions from getting minted, existing ID tokens
     * may remain active until their natural expiration (one hour). To verify that
     * ID tokens are revoked, use {@link BaseAuth.verifyIdToken}
     * where `checkRevoked` is set to true.
     *
     * @param uid - The `uid` corresponding to the user whose refresh tokens
     *   are to be revoked.
     *
     * @returns An empty promise fulfilled once the user's refresh
     *   tokens have been revoked.
     */
    revokeRefreshTokens(uid) {
        return this.authRequestHandler.revokeRefreshTokens(uid)
            .then(() => {
            // Return nothing on success.
        });
    }
    /**
     * Imports the provided list of users into Firebase Auth.
     * A maximum of 1000 users are allowed to be imported one at a time.
     * When importing users with passwords,
     * {@link UserImportOptions} are required to be
     * specified.
     * This operation is optimized for bulk imports and will ignore checks on `uid`,
     * `email` and other identifier uniqueness which could result in duplications.
     *
     * @param users - The list of user records to import to Firebase Auth.
     * @param options - The user import options, required when the users provided include
     *   password credentials.
     * @returns A promise that resolves when
     *   the operation completes with the result of the import. This includes the
     *   number of successful imports, the number of failed imports and their
     *   corresponding errors.
    */
    importUsers(users, options) {
        return this.authRequestHandler.uploadAccount(users, options);
    }
    /**
     * Creates a new Firebase session cookie with the specified options. The created
     * JWT string can be set as a server-side session cookie with a custom cookie
     * policy, and be used for session management. The session cookie JWT will have
     * the same payload claims as the provided ID token.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-cookies | Manage Session Cookies}
     * for code samples and detailed documentation.
     *
     * @param idToken - The Firebase ID token to exchange for a session
     *   cookie.
     * @param sessionCookieOptions - The session
     *   cookie options which includes custom session duration.
     *
     * @returns A promise that resolves on success with the
     *   created session cookie.
     */
    createSessionCookie(idToken, sessionCookieOptions) {
        // Return rejected promise if expiresIn is not available.
        if (!validator.isNonNullObject(sessionCookieOptions) ||
            !validator.isNumber(sessionCookieOptions.expiresIn)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_SESSION_COOKIE_DURATION));
        }
        return this.authRequestHandler.createSessionCookie(idToken, sessionCookieOptions.expiresIn);
    }
    /**
     * Verifies a Firebase session cookie. Returns a Promise with the cookie claims.
     * Rejects the promise if the cookie could not be verified.
     *
     * If `checkRevoked` is set to true, first verifies whether the corresponding
     * user is disabled: If yes, an `auth/user-disabled` error is thrown. If no,
     * verifies if the session corresponding to the session cookie was revoked.
     * If the corresponding user's session was invalidated, an
     * `auth/session-cookie-revoked` error is thrown. If not specified the check
     * is not performed.
     *
     * See {@link https://firebase.google.com/docs/auth/admin/manage-cookies#verify_session_cookie_and_check_permissions |
     * Verify Session Cookies}
     * for code samples and detailed documentation
     *
     * @param sessionCookie - The session cookie to verify.
     * @param checkForRevocation -  Whether to check if the session cookie was
     *   revoked. This requires an extra request to the Firebase Auth backend to
     *   check the `tokensValidAfterTime` time for the corresponding user.
     *   When not specified, this additional check is not performed.
     *
     * @returns A promise fulfilled with the
     *   session cookie's decoded claims if the session cookie is valid; otherwise,
     *   a rejected promise.
     */
    verifySessionCookie(sessionCookie, checkRevoked = false) {
        const isEmulator = (0, auth_api_request_1.useEmulator)();
        return this.sessionCookieVerifier.verifyJWT(sessionCookie, isEmulator)
            .then((decodedIdToken) => {
            // Whether to check if the token was revoked.
            if (checkRevoked || isEmulator) {
                return this.verifyDecodedJWTNotRevokedOrDisabled(decodedIdToken, error_1.AuthClientErrorCode.SESSION_COOKIE_REVOKED);
            }
            return decodedIdToken;
        });
    }
    /**
     * Generates the out of band email action link to reset a user's password.
     * The link is generated for the user with the specified email address. The
     * optional  {@link ActionCodeSettings} object
     * defines whether the link is to be handled by a mobile app or browser and the
     * additional state information to be passed in the deep link, etc.
     *
     * @example
     * ```javascript
     * var actionCodeSettings = {
     *   url: 'https://www.example.com/?email=user@example.com',
     *   iOS: {
     *     bundleId: 'com.example.ios'
     *   },
     *   android: {
     *     packageName: 'com.example.android',
     *     installApp: true,
     *     minimumVersion: '12'
     *   },
     *   handleCodeInApp: true,
     *   linkDomain: 'project-id.firebaseapp.com'
     * };
     * admin.auth()
     *     .generatePasswordResetLink('user@example.com', actionCodeSettings)
     *     .then(function(link) {
     *       // The link was successfully generated.
     *     })
     *     .catch(function(error) {
     *       // Some error occurred, you can inspect the code: error.code
     *     });
     * ```
     *
     * @param email - The email address of the user whose password is to be
     *   reset.
     * @param actionCodeSettings - The action
     *     code settings. If specified, the state/continue URL is set as the
     *     "continueUrl" parameter in the password reset link. The default password
     *     reset landing page will use this to display a link to go back to the app
     *     if it is installed.
     *     If the actionCodeSettings is not specified, no URL is appended to the
     *     action URL.
     *     The state URL provided must belong to a domain that is whitelisted by the
     *     developer in the console. Otherwise an error is thrown.
     *     Mobile app redirects are only applicable if the developer configures
     *     and accepts the Firebase Dynamic Links terms of service.
     *     The Android package name and iOS bundle ID are respected only if they
     *     are configured in the same Firebase Auth project.
     * @returns A promise that resolves with the generated link.
     */
    generatePasswordResetLink(email, actionCodeSettings) {
        return this.authRequestHandler.getEmailActionLink('PASSWORD_RESET', email, actionCodeSettings);
    }
    /**
     * Generates the out of band email action link to verify the user's ownership
     * of the specified email. The {@link ActionCodeSettings} object provided
     * as an argument to this method defines whether the link is to be handled by a
     * mobile app or browser along with additional state information to be passed in
     * the deep link, etc.
     *
     * @example
     * ```javascript
     * var actionCodeSettings = {
     *   url: 'https://www.example.com/cart?email=user@example.com&cartId=123',
     *   iOS: {
     *     bundleId: 'com.example.ios'
     *   },
     *   android: {
     *     packageName: 'com.example.android',
     *     installApp: true,
     *     minimumVersion: '12'
     *   },
     *   handleCodeInApp: true,
     *   linkDomain: 'project-id.firebaseapp.com'
     * };
     * admin.auth()
     *     .generateEmailVerificationLink('user@example.com', actionCodeSettings)
     *     .then(function(link) {
     *       // The link was successfully generated.
     *     })
     *     .catch(function(error) {
     *       // Some error occurred, you can inspect the code: error.code
     *     });
     * ```
     *
     * @param email - The email account to verify.
     * @param actionCodeSettings - The action
     *     code settings. If specified, the state/continue URL is set as the
     *     "continueUrl" parameter in the email verification link. The default email
     *     verification landing page will use this to display a link to go back to
     *     the app if it is installed.
     *     If the actionCodeSettings is not specified, no URL is appended to the
     *     action URL.
     *     The state URL provided must belong to a domain that is whitelisted by the
     *     developer in the console. Otherwise an error is thrown.
     *     Mobile app redirects are only applicable if the developer configures
     *     and accepts the Firebase Dynamic Links terms of service.
     *     The Android package name and iOS bundle ID are respected only if they
     *     are configured in the same Firebase Auth project.
     * @returns A promise that resolves with the generated link.
     */
    generateEmailVerificationLink(email, actionCodeSettings) {
        return this.authRequestHandler.getEmailActionLink('VERIFY_EMAIL', email, actionCodeSettings);
    }
    /**
     * Generates an out-of-band email action link to verify the user's ownership
     * of the specified email. The {@link ActionCodeSettings} object provided
     * as an argument to this method defines whether the link is to be handled by a
     * mobile app or browser along with additional state information to be passed in
     * the deep link, etc.
     *
     * @param email - The current email account.
     * @param newEmail - The email address the account is being updated to.
     * @param actionCodeSettings - The action
     *     code settings. If specified, the state/continue URL is set as the
     *     "continueUrl" parameter in the email verification link. The default email
     *     verification landing page will use this to display a link to go back to
     *     the app if it is installed.
     *     If the actionCodeSettings is not specified, no URL is appended to the
     *     action URL.
     *     The state URL provided must belong to a domain that is authorized
     *     in the console, or an error will be thrown.
     *     Mobile app redirects are only applicable if the developer configures
     *     and accepts the Firebase Dynamic Links terms of service.
     *     The Android package name and iOS bundle ID are respected only if they
     *     are configured in the same Firebase Auth project.
     * @returns A promise that resolves with the generated link.
     */
    generateVerifyAndChangeEmailLink(email, newEmail, actionCodeSettings) {
        return this.authRequestHandler.getEmailActionLink('VERIFY_AND_CHANGE_EMAIL', email, actionCodeSettings, newEmail);
    }
    /**
     * Generates the out of band email action link to verify the user's ownership
     * of the specified email. The {@link ActionCodeSettings} object provided
     * as an argument to this method defines whether the link is to be handled by a
     * mobile app or browser along with additional state information to be passed in
     * the deep link, etc.
     *
     * @example
     * ```javascript
     * var actionCodeSettings = {
     *   url: 'https://www.example.com/cart?email=user@example.com&cartId=123',
     *   iOS: {
     *     bundleId: 'com.example.ios'
     *   },
     *   android: {
     *     packageName: 'com.example.android',
     *     installApp: true,
     *     minimumVersion: '12'
     *   },
     *   handleCodeInApp: true,
     *   linkDomain: 'project-id.firebaseapp.com'
     * };
     * admin.auth()
     *     .generateEmailVerificationLink('user@example.com', actionCodeSettings)
     *     .then(function(link) {
     *       // The link was successfully generated.
     *     })
     *     .catch(function(error) {
     *       // Some error occurred, you can inspect the code: error.code
     *     });
     * ```
     *
     * @param email - The email account to verify.
     * @param actionCodeSettings - The action
     *     code settings. If specified, the state/continue URL is set as the
     *     "continueUrl" parameter in the email verification link. The default email
     *     verification landing page will use this to display a link to go back to
     *     the app if it is installed.
     *     If the actionCodeSettings is not specified, no URL is appended to the
     *     action URL.
     *     The state URL provided must belong to a domain that is whitelisted by the
     *     developer in the console. Otherwise an error is thrown.
     *     Mobile app redirects are only applicable if the developer configures
     *     and accepts the Firebase Dynamic Links terms of service.
     *     The Android package name and iOS bundle ID are respected only if they
     *     are configured in the same Firebase Auth project.
     * @returns A promise that resolves with the generated link.
     */
    generateSignInWithEmailLink(email, actionCodeSettings) {
        return this.authRequestHandler.getEmailActionLink('EMAIL_SIGNIN', email, actionCodeSettings);
    }
    /**
     * Returns the list of existing provider configurations matching the filter
     * provided. At most, 100 provider configs can be listed at a time.
     *
     * SAML and OIDC provider support requires Google Cloud's Identity Platform
     * (GCIP). To learn more about GCIP, including pricing and features,
     * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
     *
     * @param options - The provider config filter to apply.
     * @returns A promise that resolves with the list of provider configs meeting the
     *   filter requirements.
     */
    listProviderConfigs(options) {
        const processResponse = (response, providerConfigs) => {
            // Return list of provider configuration and the next page token if available.
            const result = {
                providerConfigs,
            };
            // Delete result.pageToken if undefined.
            if (Object.prototype.hasOwnProperty.call(response, 'nextPageToken')) {
                result.pageToken = response.nextPageToken;
            }
            return result;
        };
        if (options && options.type === 'oidc') {
            return this.authRequestHandler.listOAuthIdpConfigs(options.maxResults, options.pageToken)
                .then((response) => {
                // List of provider configurations to return.
                const providerConfigs = [];
                // Convert each provider config response to a OIDCConfig.
                response.oauthIdpConfigs.forEach((configResponse) => {
                    providerConfigs.push(new auth_config_1.OIDCConfig(configResponse));
                });
                // Return list of provider configuration and the next page token if available.
                return processResponse(response, providerConfigs);
            });
        }
        else if (options && options.type === 'saml') {
            return this.authRequestHandler.listInboundSamlConfigs(options.maxResults, options.pageToken)
                .then((response) => {
                // List of provider configurations to return.
                const providerConfigs = [];
                // Convert each provider config response to a SAMLConfig.
                response.inboundSamlConfigs.forEach((configResponse) => {
                    providerConfigs.push(new auth_config_1.SAMLConfig(configResponse));
                });
                // Return list of provider configuration and the next page token if available.
                return processResponse(response, providerConfigs);
            });
        }
        return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_ARGUMENT, '"AuthProviderConfigFilter.type" must be either "saml" or "oidc"'));
    }
    /**
     * Looks up an Auth provider configuration by the provided ID.
     * Returns a promise that resolves with the provider configuration
     * corresponding to the provider ID specified. If the specified ID does not
     * exist, an `auth/configuration-not-found` error is thrown.
     *
     * SAML and OIDC provider support requires Google Cloud's Identity Platform
     * (GCIP). To learn more about GCIP, including pricing and features,
     * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
     *
     * @param providerId - The provider ID corresponding to the provider
     *     config to return.
     * @returns A promise that resolves
     *     with the configuration corresponding to the provided ID.
     */
    getProviderConfig(providerId) {
        if (auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return this.authRequestHandler.getOAuthIdpConfig(providerId)
                .then((response) => {
                return new auth_config_1.OIDCConfig(response);
            });
        }
        else if (auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return this.authRequestHandler.getInboundSamlConfig(providerId)
                .then((response) => {
                return new auth_config_1.SAMLConfig(response);
            });
        }
        return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
    }
    /**
     * Deletes the provider configuration corresponding to the provider ID passed.
     * If the specified ID does not exist, an `auth/configuration-not-found` error
     * is thrown.
     *
     * SAML and OIDC provider support requires Google Cloud's Identity Platform
     * (GCIP). To learn more about GCIP, including pricing and features,
     * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
     *
     * @param providerId - The provider ID corresponding to the provider
     *     config to delete.
     * @returns A promise that resolves on completion.
     */
    deleteProviderConfig(providerId) {
        if (auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return this.authRequestHandler.deleteOAuthIdpConfig(providerId);
        }
        else if (auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return this.authRequestHandler.deleteInboundSamlConfig(providerId);
        }
        return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
    }
    /**
     * Returns a promise that resolves with the updated `AuthProviderConfig`
     * corresponding to the provider ID specified.
     * If the specified ID does not exist, an `auth/configuration-not-found` error
     * is thrown.
     *
     * SAML and OIDC provider support requires Google Cloud's Identity Platform
     * (GCIP). To learn more about GCIP, including pricing and features,
     * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
     *
     * @param providerId - The provider ID corresponding to the provider
     *     config to update.
     * @param updatedConfig - The updated configuration.
     * @returns A promise that resolves with the updated provider configuration.
     */
    updateProviderConfig(providerId, updatedConfig) {
        if (!validator.isNonNullObject(updatedConfig)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, 'Request is missing "UpdateAuthProviderRequest" configuration.'));
        }
        if (auth_config_1.OIDCConfig.isProviderId(providerId)) {
            return this.authRequestHandler.updateOAuthIdpConfig(providerId, updatedConfig)
                .then((response) => {
                return new auth_config_1.OIDCConfig(response);
            });
        }
        else if (auth_config_1.SAMLConfig.isProviderId(providerId)) {
            return this.authRequestHandler.updateInboundSamlConfig(providerId, updatedConfig)
                .then((response) => {
                return new auth_config_1.SAMLConfig(response);
            });
        }
        return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
    }
    /**
     * Returns a promise that resolves with the newly created `AuthProviderConfig`
     * when the new provider configuration is created.
     *
     * SAML and OIDC provider support requires Google Cloud's Identity Platform
     * (GCIP). To learn more about GCIP, including pricing and features,
     * see the {@link https://cloud.google.com/identity-platform | GCIP documentation}.
     *
     * @param config - The provider configuration to create.
     * @returns A promise that resolves with the created provider configuration.
     */
    createProviderConfig(config) {
        if (!validator.isNonNullObject(config)) {
            return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_CONFIG, 'Request is missing "AuthProviderConfig" configuration.'));
        }
        if (auth_config_1.OIDCConfig.isProviderId(config.providerId)) {
            return this.authRequestHandler.createOAuthIdpConfig(config)
                .then((response) => {
                return new auth_config_1.OIDCConfig(response);
            });
        }
        else if (auth_config_1.SAMLConfig.isProviderId(config.providerId)) {
            return this.authRequestHandler.createInboundSamlConfig(config)
                .then((response) => {
                return new auth_config_1.SAMLConfig(response);
            });
        }
        return Promise.reject(new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.INVALID_PROVIDER_ID));
    }
    /** @alpha */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _verifyAuthBlockingToken(token, audience) {
        const isEmulator = (0, auth_api_request_1.useEmulator)();
        return this.authBlockingTokenVerifier._verifyAuthBlockingToken(token, isEmulator, audience)
            .then((decodedAuthBlockingToken) => {
            return decodedAuthBlockingToken;
        });
    }
    /**
     * Verifies the decoded Firebase issued JWT is not revoked or disabled. Returns a promise that
     * resolves with the decoded claims on success. Rejects the promise with revocation error if revoked
     * or user disabled.
     *
     * @param decodedIdToken - The JWT's decoded claims.
     * @param revocationErrorInfo - The revocation error info to throw on revocation
     *     detection.
     * @returns A promise that will be fulfilled after a successful verification.
     */
    verifyDecodedJWTNotRevokedOrDisabled(decodedIdToken, revocationErrorInfo) {
        // Get tokens valid after time for the corresponding user.
        return this.getUser(decodedIdToken.sub)
            .then((user) => {
            if (user.disabled) {
                throw new error_1.FirebaseAuthError(error_1.AuthClientErrorCode.USER_DISABLED, 'The user record is disabled.');
            }
            // If no tokens valid after time available, token is not revoked.
            if (user.tokensValidAfterTime) {
                // Get the ID token authentication time and convert to milliseconds UTC.
                const authTimeUtc = decodedIdToken.auth_time * 1000;
                // Get user tokens valid after time in milliseconds UTC.
                const validSinceUtc = new Date(user.tokensValidAfterTime).getTime();
                // Check if authentication time is older than valid since time.
                if (authTimeUtc < validSinceUtc) {
                    throw new error_1.FirebaseAuthError(revocationErrorInfo);
                }
            }
            // All checks above passed. Return the decoded token.
            return decodedIdToken;
        });
    }
}
exports.BaseAuth = BaseAuth;
