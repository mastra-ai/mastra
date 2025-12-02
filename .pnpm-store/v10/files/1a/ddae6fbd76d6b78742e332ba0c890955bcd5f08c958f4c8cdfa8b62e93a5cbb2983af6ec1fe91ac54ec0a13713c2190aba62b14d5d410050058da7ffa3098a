/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpersonatedServiceAccountCredential = exports.RefreshTokenCredential = exports.ServiceAccountCredential = exports.ApplicationDefaultCredential = void 0;
exports.isApplicationDefault = isApplicationDefault;
exports.getApplicationDefault = getApplicationDefault;
const fs = require("fs");
const google_auth_library_1 = require("google-auth-library");
const error_1 = require("../utils/error");
const util = require("../utils/validator");
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/firebase.messaging',
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/userinfo.email',
];
/**
 * Implementation of ADC that uses google-auth-library-nodejs.
 */
class ApplicationDefaultCredential {
    constructor(httpAgent) {
        this.googleAuth = new google_auth_library_1.GoogleAuth({
            scopes: SCOPES,
            clientOptions: {
                transporterOptions: {
                    agent: httpAgent,
                },
            },
        });
    }
    async getAccessToken() {
        if (!this.authClient) {
            this.authClient = await this.googleAuth.getClient();
        }
        await this.authClient.getAccessToken();
        const credentials = this.authClient.credentials;
        this.quotaProjectId = this.authClient.quotaProjectId;
        return populateCredential(credentials);
    }
    async getProjectId() {
        if (!this.projectId) {
            this.projectId = await this.googleAuth.getProjectId();
        }
        return Promise.resolve(this.projectId);
    }
    getQuotaProjectId() {
        if (!this.quotaProjectId) {
            this.quotaProjectId = this.authClient?.quotaProjectId;
        }
        return this.quotaProjectId;
    }
    async isComputeEngineCredential() {
        if (!this.authClient) {
            this.authClient = await this.googleAuth.getClient();
        }
        return Promise.resolve(this.authClient instanceof google_auth_library_1.Compute);
    }
    /**
   * getIDToken returns a OIDC token from the compute metadata service
   * that can be used to make authenticated calls to audience
   * @param audience the URL the returned ID token will be used to call.
  */
    async getIDToken(audience) {
        if (await this.isComputeEngineCredential()) {
            return this.authClient.fetchIdToken(audience);
        }
        else {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Credentials type should be Compute Engine Credentials.');
        }
    }
    async getServiceAccountEmail() {
        if (this.accountId) {
            return Promise.resolve(this.accountId);
        }
        const { client_email: clientEmail } = await this.googleAuth.getCredentials();
        this.accountId = clientEmail ?? '';
        return Promise.resolve(this.accountId);
    }
}
exports.ApplicationDefaultCredential = ApplicationDefaultCredential;
/**
 * Implementation of Credential that uses a service account.
 */
class ServiceAccountCredential {
    /**
     * Creates a new ServiceAccountCredential from the given parameters.
     *
     * @param serviceAccountPathOrObject - Service account json object or path to a service account json file.
     * @param httpAgent - Optional http.Agent to use when calling the remote token server.
     * @param implicit - An optional boolean indicating whether this credential was implicitly discovered from the
     *   environment, as opposed to being explicitly specified by the developer.
     *
     * @constructor
     */
    constructor(serviceAccountPathOrObject, httpAgent, implicit = false) {
        this.serviceAccountPathOrObject = serviceAccountPathOrObject;
        this.httpAgent = httpAgent;
        this.implicit = implicit;
        const serviceAccount = (typeof serviceAccountPathOrObject === 'string') ?
            ServiceAccount.fromPath(serviceAccountPathOrObject)
            : new ServiceAccount(serviceAccountPathOrObject);
        this.projectId = serviceAccount.projectId;
        this.privateKey = serviceAccount.privateKey;
        this.clientEmail = serviceAccount.clientEmail;
    }
    getGoogleAuth() {
        if (this.googleAuth) {
            return this.googleAuth;
        }
        const { auth, client } = populateGoogleAuth(this.serviceAccountPathOrObject, this.httpAgent);
        this.googleAuth = auth;
        this.authClient = client;
        return this.googleAuth;
    }
    async getAccessToken() {
        const googleAuth = this.getGoogleAuth();
        if (this.authClient === undefined) {
            this.authClient = await googleAuth.getClient();
        }
        await this.authClient.getAccessToken();
        const credentials = this.authClient.credentials;
        return populateCredential(credentials);
    }
}
exports.ServiceAccountCredential = ServiceAccountCredential;
/**
 * A struct containing the properties necessary to use service account JSON credentials.
 */
class ServiceAccount {
    static fromPath(filePath) {
        try {
            return new ServiceAccount(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        }
        catch (error) {
            // Throw a nicely formed error message if the file contents cannot be parsed
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse service account json file: ' + error);
        }
    }
    constructor(json) {
        if (!util.isNonNullObject(json)) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Service account must be an object.');
        }
        copyAttr(this, json, 'projectId', 'project_id');
        copyAttr(this, json, 'privateKey', 'private_key');
        copyAttr(this, json, 'clientEmail', 'client_email');
        let errorMessage;
        if (!util.isNonEmptyString(this.projectId)) {
            errorMessage = 'Service account object must contain a string "project_id" property.';
        }
        else if (!util.isNonEmptyString(this.privateKey)) {
            errorMessage = 'Service account object must contain a string "private_key" property.';
        }
        else if (!util.isNonEmptyString(this.clientEmail)) {
            errorMessage = 'Service account object must contain a string "client_email" property.';
        }
        if (typeof errorMessage !== 'undefined') {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, errorMessage);
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const forge = require('node-forge');
        try {
            forge.pki.privateKeyFromPem(this.privateKey);
        }
        catch (error) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse private key: ' + error);
        }
    }
}
/**
 * Implementation of Credential that gets access tokens from refresh tokens.
 */
class RefreshTokenCredential {
    /**
     * Creates a new RefreshTokenCredential from the given parameters.
     *
     * @param refreshTokenPathOrObject - Refresh token json object or path to a refresh token
     *   (user credentials) json file.
     * @param httpAgent - Optional http.Agent to use when calling the remote token server.
     * @param implicit - An optinal boolean indicating whether this credential was implicitly
     *   discovered from the environment, as opposed to being explicitly specified by the developer.
     *
     * @constructor
     */
    constructor(refreshTokenPathOrObject, httpAgent, implicit = false) {
        this.refreshTokenPathOrObject = refreshTokenPathOrObject;
        this.httpAgent = httpAgent;
        this.implicit = implicit;
        (typeof refreshTokenPathOrObject === 'string') ?
            RefreshToken.validateFromPath(refreshTokenPathOrObject)
            : RefreshToken.validateFromJSON(refreshTokenPathOrObject);
    }
    getGoogleAuth() {
        if (this.googleAuth) {
            return this.googleAuth;
        }
        const { auth, client } = populateGoogleAuth(this.refreshTokenPathOrObject, this.httpAgent);
        this.googleAuth = auth;
        this.authClient = client;
        return this.googleAuth;
    }
    async getAccessToken() {
        const googleAuth = this.getGoogleAuth();
        if (this.authClient === undefined) {
            this.authClient = await googleAuth.getClient();
        }
        await this.authClient.getAccessToken();
        const credentials = this.authClient.credentials;
        return populateCredential(credentials);
    }
}
exports.RefreshTokenCredential = RefreshTokenCredential;
class RefreshToken {
    /*
     * Tries to load a RefreshToken from a path. Throws if the path doesn't exist or the
     * data at the path is invalid.
     */
    static validateFromPath(filePath) {
        try {
            RefreshToken.validateFromJSON(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        }
        catch (error) {
            // Throw a nicely formed error message if the file contents cannot be parsed
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse refresh token file: ' + error);
        }
    }
    static validateFromJSON(json) {
        const creds = { clientId: '', clientSecret: '', refreshToken: '', type: '' };
        copyAttr(creds, json, 'clientId', 'client_id');
        copyAttr(creds, json, 'clientSecret', 'client_secret');
        copyAttr(creds, json, 'refreshToken', 'refresh_token');
        copyAttr(creds, json, 'type', 'type');
        let errorMessage;
        if (!util.isNonEmptyString(creds.clientId)) {
            errorMessage = 'Refresh token must contain a "client_id" property.';
        }
        else if (!util.isNonEmptyString(creds.clientSecret)) {
            errorMessage = 'Refresh token must contain a "client_secret" property.';
        }
        else if (!util.isNonEmptyString(creds.refreshToken)) {
            errorMessage = 'Refresh token must contain a "refresh_token" property.';
        }
        else if (!util.isNonEmptyString(creds.type)) {
            errorMessage = 'Refresh token must contain a "type" property.';
        }
        if (typeof errorMessage !== 'undefined') {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, errorMessage);
        }
    }
}
/**
 * Implementation of Credential that uses impersonated service account.
 */
class ImpersonatedServiceAccountCredential {
    /**
     * Creates a new ImpersonatedServiceAccountCredential from the given parameters.
     *
     * @param impersonatedServiceAccountPathOrObject - Impersonated Service account json object or
     * path to a service account json file.
     * @param httpAgent - Optional http.Agent to use when calling the remote token server.
     * @param implicit - An optional boolean indicating whether this credential was implicitly
     *   discovered from the environment, as opposed to being explicitly specified by the developer.
     *
     * @constructor
     */
    constructor(impersonatedServiceAccountPathOrObject, httpAgent, implicit = false) {
        this.impersonatedServiceAccountPathOrObject = impersonatedServiceAccountPathOrObject;
        this.httpAgent = httpAgent;
        this.implicit = implicit;
        (typeof impersonatedServiceAccountPathOrObject === 'string') ?
            ImpersonatedServiceAccount.validateFromPath(impersonatedServiceAccountPathOrObject)
            : ImpersonatedServiceAccount.validateFromJSON(impersonatedServiceAccountPathOrObject);
    }
    getGoogleAuth() {
        if (this.googleAuth) {
            return this.googleAuth;
        }
        const { auth, client } = populateGoogleAuth(this.impersonatedServiceAccountPathOrObject, this.httpAgent);
        this.googleAuth = auth;
        this.authClient = client;
        return this.googleAuth;
    }
    async getAccessToken() {
        const googleAuth = this.getGoogleAuth();
        if (this.authClient === undefined) {
            this.authClient = await googleAuth.getClient();
        }
        await this.authClient.getAccessToken();
        const credentials = this.authClient.credentials;
        return populateCredential(credentials);
    }
}
exports.ImpersonatedServiceAccountCredential = ImpersonatedServiceAccountCredential;
/**
 * A helper class to validate the properties necessary to use impersonated service account credentials.
 */
class ImpersonatedServiceAccount {
    /*
     * Tries to load a ImpersonatedServiceAccount from a path. Throws if the path doesn't exist or the
     * data at the path is invalid.
     */
    static validateFromPath(filePath) {
        try {
            ImpersonatedServiceAccount.validateFromJSON(JSON.parse(fs.readFileSync(filePath, 'utf8')));
        }
        catch (error) {
            // Throw a nicely formed error message if the file contents cannot be parsed
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse impersonated service account file: ' + error);
        }
    }
    static validateFromJSON(json) {
        const { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, type } = json['source_credentials'];
        let errorMessage;
        if (!util.isNonEmptyString(clientId)) {
            errorMessage = 'Impersonated Service Account must contain a "source_credentials.client_id" property.';
        }
        else if (!util.isNonEmptyString(clientSecret)) {
            errorMessage = 'Impersonated Service Account must contain a "source_credentials.client_secret" property.';
        }
        else if (!util.isNonEmptyString(refreshToken)) {
            errorMessage = 'Impersonated Service Account must contain a "source_credentials.refresh_token" property.';
        }
        else if (!util.isNonEmptyString(type)) {
            errorMessage = 'Impersonated Service Account must contain a "source_credentials.type" property.';
        }
        if (typeof errorMessage !== 'undefined') {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, errorMessage);
        }
    }
}
/**
 * Checks if the given credential was loaded via the application default credentials mechanism.
 *
 * @param credential - The credential instance to check.
 */
function isApplicationDefault(credential) {
    return credential instanceof ApplicationDefaultCredential ||
        (credential instanceof RefreshTokenCredential && credential.implicit);
}
function getApplicationDefault(httpAgent) {
    return new ApplicationDefaultCredential(httpAgent);
}
/**
 * Copies the specified property from one object to another.
 *
 * If no property exists by the given "key", looks for a property identified by "alt", and copies it instead.
 * This can be used to implement behaviors such as "copy property myKey or my_key".
 *
 * @param to - Target object to copy the property into.
 * @param from - Source object to copy the property from.
 * @param key - Name of the property to copy.
 * @param alt - Alternative name of the property to copy.
 */
function copyAttr(to, from, key, alt) {
    const tmp = from[key] || from[alt];
    if (typeof tmp !== 'undefined') {
        to[key] = tmp;
    }
}
/**
 * Populate google-auth-library GoogleAuth credentials type.
 */
function populateGoogleAuth(keyFile, httpAgent) {
    let client;
    const auth = new google_auth_library_1.GoogleAuth({
        scopes: SCOPES,
        clientOptions: {
            transporterOptions: {
                agent: httpAgent,
            },
        },
        keyFile: (typeof keyFile === 'string') ? keyFile : undefined,
    });
    if (typeof keyFile === 'object') {
        if (!util.isNonNullObject(keyFile)) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Service account must be an object.');
        }
        copyAttr(keyFile, keyFile, 'project_id', 'projectId');
        copyAttr(keyFile, keyFile, 'private_key', 'privateKey');
        copyAttr(keyFile, keyFile, 'client_email', 'clientEmail');
        client = auth.fromJSON(keyFile);
    }
    return { auth, client };
}
/**
 * Populate GoogleOAuthAccessToken credentials from google-auth-library Credentials type.
 */
function populateCredential(credentials) {
    const accessToken = credentials?.access_token;
    const expiryDate = credentials?.expiry_date;
    if (typeof accessToken !== 'string')
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse Google auth credential: access_token must be a non empty string.');
    if (typeof expiryDate !== 'number')
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, 'Failed to parse Google auth credential: Invalid expiry_date.');
    return {
        ...credentials,
        access_token: accessToken,
        // inverse operation of following
        // https://github.com/googleapis/google-auth-library-nodejs/blob/5ed910513451c82e2551777a3e2212964799ef8e/src/auth/baseexternalclient.ts#L446-L446
        expires_in: Math.floor((expiryDate - new Date().getTime()) / 1000),
    };
}
