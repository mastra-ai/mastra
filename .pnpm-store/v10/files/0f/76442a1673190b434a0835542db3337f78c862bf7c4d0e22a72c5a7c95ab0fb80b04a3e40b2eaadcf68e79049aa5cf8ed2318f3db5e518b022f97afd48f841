/*! firebase-admin v13.5.0 */
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
import { Agent } from 'http';
import { Credential, GoogleOAuthAccessToken } from './credential';
/**
 * Implementation of ADC that uses google-auth-library-nodejs.
 */
export declare class ApplicationDefaultCredential implements Credential {
    private readonly googleAuth;
    private authClient;
    private projectId?;
    private quotaProjectId?;
    private accountId?;
    constructor(httpAgent?: Agent);
    getAccessToken(): Promise<GoogleOAuthAccessToken>;
    getProjectId(): Promise<string>;
    getQuotaProjectId(): string | undefined;
    isComputeEngineCredential(): Promise<boolean>;
    /**
   * getIDToken returns a OIDC token from the compute metadata service
   * that can be used to make authenticated calls to audience
   * @param audience the URL the returned ID token will be used to call.
  */
    getIDToken(audience: string): Promise<string>;
    getServiceAccountEmail(): Promise<string>;
}
/**
 * Implementation of Credential that uses a service account.
 */
export declare class ServiceAccountCredential implements Credential {
    private readonly serviceAccountPathOrObject;
    private readonly httpAgent?;
    readonly implicit: boolean;
    readonly projectId: string;
    readonly privateKey: string;
    readonly clientEmail: string;
    private googleAuth;
    private authClient;
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
    constructor(serviceAccountPathOrObject: string | object, httpAgent?: Agent | undefined, implicit?: boolean);
    private getGoogleAuth;
    getAccessToken(): Promise<GoogleOAuthAccessToken>;
}
/**
 * Implementation of Credential that gets access tokens from refresh tokens.
 */
export declare class RefreshTokenCredential implements Credential {
    private readonly refreshTokenPathOrObject;
    private readonly httpAgent?;
    readonly implicit: boolean;
    private googleAuth;
    private authClient;
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
    constructor(refreshTokenPathOrObject: string | object, httpAgent?: Agent | undefined, implicit?: boolean);
    private getGoogleAuth;
    getAccessToken(): Promise<GoogleOAuthAccessToken>;
}
/**
 * Implementation of Credential that uses impersonated service account.
 */
export declare class ImpersonatedServiceAccountCredential implements Credential {
    private readonly impersonatedServiceAccountPathOrObject;
    private readonly httpAgent?;
    readonly implicit: boolean;
    private googleAuth;
    private authClient;
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
    constructor(impersonatedServiceAccountPathOrObject: string | object, httpAgent?: Agent | undefined, implicit?: boolean);
    private getGoogleAuth;
    getAccessToken(): Promise<GoogleOAuthAccessToken>;
}
/**
 * Checks if the given credential was loaded via the application default credentials mechanism.
 *
 * @param credential - The credential instance to check.
 */
export declare function isApplicationDefault(credential?: Credential): boolean;
export declare function getApplicationDefault(httpAgent?: Agent): Credential;
