/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
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
exports.CryptoSignerErrorCode = exports.CryptoSignerError = exports.IAMSigner = exports.ServiceAccountSigner = void 0;
exports.cryptoSignerFromApp = cryptoSignerFromApp;
const credential_internal_1 = require("../app/credential-internal");
const api_request_1 = require("./api-request");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const ALGORITHM_RS256 = 'RS256';
/**
 * A CryptoSigner implementation that uses an explicitly specified service account private key to
 * sign data. Performs all operations locally, and does not make any RPC calls.
 */
class ServiceAccountSigner {
    /**
     * Creates a new CryptoSigner instance from the given service account credential.
     *
     * @param credential - A service account credential.
     */
    constructor(credential) {
        this.credential = credential;
        this.algorithm = ALGORITHM_RS256;
        if (!credential) {
            throw new CryptoSignerError({
                code: CryptoSignerErrorCode.INVALID_CREDENTIAL,
                message: 'INTERNAL ASSERT: Must provide a service account credential to initialize ServiceAccountSigner.',
            });
        }
    }
    /**
     * @inheritDoc
     */
    sign(buffer) {
        const crypto = require('crypto'); // eslint-disable-line @typescript-eslint/no-var-requires
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(buffer);
        return Promise.resolve(sign.sign(this.credential.privateKey));
    }
    /**
     * @inheritDoc
     */
    getAccountId() {
        return Promise.resolve(this.credential.clientEmail);
    }
}
exports.ServiceAccountSigner = ServiceAccountSigner;
/**
 * A CryptoSigner implementation that uses the remote IAM service to sign data. If initialized without
 * a service account ID, attempts to discover a service account ID by consulting the local Metadata
 * service. This will succeed in managed environments like Google Cloud Functions and App Engine.
 *
 * @see https://cloud.google.com/iam/reference/rest/v1/projects.serviceAccounts/signBlob
 * @see https://cloud.google.com/compute/docs/storing-retrieving-metadata
 */
class IAMSigner {
    constructor(httpClient, app) {
        this.algorithm = ALGORITHM_RS256;
        if (!httpClient) {
            throw new CryptoSignerError({
                code: CryptoSignerErrorCode.INVALID_ARGUMENT,
                message: 'INTERNAL ASSERT: Must provide a HTTP client to initialize IAMSigner.',
            });
        }
        if (app && (typeof app !== 'object' || app === null || !('options' in app))) {
            throw new CryptoSignerError({
                code: CryptoSignerErrorCode.INVALID_ARGUMENT,
                message: 'INTERNAL ASSERT: Must provide a valid Firebase app instance.',
            });
        }
        this.httpClient = httpClient;
        this.app = app;
    }
    /**
     * @inheritDoc
     */
    sign(buffer) {
        return this.getAccountId().then((serviceAccount) => {
            const request = {
                method: 'POST',
                url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:signBlob`,
                data: { payload: buffer.toString('base64') },
            };
            return this.httpClient.send(request);
        }).then((response) => {
            // Response from IAM is base64 encoded. Decode it into a buffer and return.
            return Buffer.from(response.data.signedBlob, 'base64');
        }).catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                throw new CryptoSignerError({
                    code: CryptoSignerErrorCode.SERVER_ERROR,
                    message: err.message,
                    cause: err
                });
            }
            throw err;
        });
    }
    /**
     * @inheritDoc
     */
    async getAccountId() {
        if (validator.isNonEmptyString(this.serviceAccountId)) {
            return this.serviceAccountId;
        }
        if (this.app) {
            const accountId = await utils.findServiceAccountEmail(this.app);
            if (accountId) {
                this.serviceAccountId = accountId;
                return accountId;
            }
        }
        const request = {
            method: 'GET',
            url: 'http://metadata/computeMetadata/v1/instance/service-accounts/default/email',
            headers: {
                'Metadata-Flavor': 'Google',
            },
        };
        const client = new api_request_1.HttpClient();
        return client.send(request).then((response) => {
            if (!response.text) {
                throw new CryptoSignerError({
                    code: CryptoSignerErrorCode.INTERNAL_ERROR,
                    message: 'HTTP Response missing payload',
                });
            }
            this.serviceAccountId = response.text;
            return response.text;
        }).catch((err) => {
            throw new CryptoSignerError({
                code: CryptoSignerErrorCode.INVALID_CREDENTIAL,
                message: 'Failed to determine service account. Make sure to initialize ' +
                    'the SDK with a service account credential. Alternatively specify a service ' +
                    `account with iam.serviceAccounts.signBlob permission. Original error: ${err}`,
            });
        });
    }
}
exports.IAMSigner = IAMSigner;
/**
 * Creates a new CryptoSigner instance for the given app. If the app has been initialized with a
 * service account credential, creates a ServiceAccountSigner.
 *
 * @param app - A FirebaseApp instance.
 * @returns A CryptoSigner instance.
 */
function cryptoSignerFromApp(app) {
    const credential = app.options.credential;
    if (credential instanceof credential_internal_1.ServiceAccountCredential) {
        return new ServiceAccountSigner(credential);
    }
    return new IAMSigner(new api_request_1.AuthorizedHttpClient(app), app);
}
/**
 * CryptoSigner error code structure.
 *
 * @param errorInfo - The error information (code and message).
 * @constructor
 */
class CryptoSignerError extends Error {
    constructor(errorInfo) {
        super(errorInfo.message);
        this.errorInfo = errorInfo;
        /* tslint:disable:max-line-length */
        // Set the prototype explicitly. See the following link for more details:
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        /* tslint:enable:max-line-length */
        this.__proto__ = CryptoSignerError.prototype;
    }
    /** @returns The error code. */
    get code() {
        return this.errorInfo.code;
    }
    /** @returns The error message. */
    get message() {
        return this.errorInfo.message;
    }
    /** @returns The error data. */
    get cause() {
        return this.errorInfo.cause;
    }
}
exports.CryptoSignerError = CryptoSignerError;
/**
 * Crypto Signer error codes and their default messages.
 */
class CryptoSignerErrorCode {
}
exports.CryptoSignerErrorCode = CryptoSignerErrorCode;
CryptoSignerErrorCode.INVALID_ARGUMENT = 'invalid-argument';
CryptoSignerErrorCode.INTERNAL_ERROR = 'internal-error';
CryptoSignerErrorCode.INVALID_CREDENTIAL = 'invalid-credential';
CryptoSignerErrorCode.SERVER_ERROR = 'server-error';
