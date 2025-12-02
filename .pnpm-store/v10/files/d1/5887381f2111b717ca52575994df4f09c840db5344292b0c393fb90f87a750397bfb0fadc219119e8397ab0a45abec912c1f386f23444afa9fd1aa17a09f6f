/*! firebase-admin v13.5.0 */
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
import { App } from '../app';
import { ServiceAccountCredential } from '../app/credential-internal';
import { AuthorizedHttpClient } from './api-request';
import { Algorithm } from 'jsonwebtoken';
import { ErrorInfo } from '../utils/error';
/**
 * CryptoSigner interface represents an object that can be used to sign JWTs.
 */
export interface CryptoSigner {
    /**
     * The name of the signing algorithm.
     */
    readonly algorithm: Algorithm;
    /**
     * Cryptographically signs a buffer of data.
     *
     * @param buffer - The data to be signed.
     * @returns A promise that resolves with the raw bytes of a signature.
     */
    sign(buffer: Buffer): Promise<Buffer>;
    /**
     * Returns the ID of the service account used to sign tokens.
     *
     * @returns A promise that resolves with a service account ID.
     */
    getAccountId(): Promise<string>;
}
/**
 * A CryptoSigner implementation that uses an explicitly specified service account private key to
 * sign data. Performs all operations locally, and does not make any RPC calls.
 */
export declare class ServiceAccountSigner implements CryptoSigner {
    private readonly credential;
    algorithm: Algorithm;
    /**
     * Creates a new CryptoSigner instance from the given service account credential.
     *
     * @param credential - A service account credential.
     */
    constructor(credential: ServiceAccountCredential);
    /**
     * @inheritDoc
     */
    sign(buffer: Buffer): Promise<Buffer>;
    /**
     * @inheritDoc
     */
    getAccountId(): Promise<string>;
}
/**
 * A CryptoSigner implementation that uses the remote IAM service to sign data. If initialized without
 * a service account ID, attempts to discover a service account ID by consulting the local Metadata
 * service. This will succeed in managed environments like Google Cloud Functions and App Engine.
 *
 * @see https://cloud.google.com/iam/reference/rest/v1/projects.serviceAccounts/signBlob
 * @see https://cloud.google.com/compute/docs/storing-retrieving-metadata
 */
export declare class IAMSigner implements CryptoSigner {
    algorithm: Algorithm;
    private readonly httpClient;
    private serviceAccountId?;
    private app?;
    constructor(httpClient: AuthorizedHttpClient, app?: App);
    /**
     * @inheritDoc
     */
    sign(buffer: Buffer): Promise<Buffer>;
    /**
     * @inheritDoc
     */
    getAccountId(): Promise<string>;
}
/**
 * Creates a new CryptoSigner instance for the given app. If the app has been initialized with a
 * service account credential, creates a ServiceAccountSigner.
 *
 * @param app - A FirebaseApp instance.
 * @returns A CryptoSigner instance.
 */
export declare function cryptoSignerFromApp(app: App): CryptoSigner;
/**
 * Defines extended error info type. This includes a code, message string, and error data.
 */
export interface ExtendedErrorInfo extends ErrorInfo {
    cause?: Error;
}
/**
 * CryptoSigner error code structure.
 *
 * @param errorInfo - The error information (code and message).
 * @constructor
 */
export declare class CryptoSignerError extends Error {
    private errorInfo;
    constructor(errorInfo: ExtendedErrorInfo);
    /** @returns The error code. */
    get code(): string;
    /** @returns The error message. */
    get message(): string;
    /** @returns The error data. */
    get cause(): Error | undefined;
}
/**
 * Crypto Signer error codes and their default messages.
 */
export declare class CryptoSignerErrorCode {
    static INVALID_ARGUMENT: string;
    static INTERNAL_ERROR: string;
    static INVALID_CREDENTIAL: string;
    static SERVER_ERROR: string;
}
