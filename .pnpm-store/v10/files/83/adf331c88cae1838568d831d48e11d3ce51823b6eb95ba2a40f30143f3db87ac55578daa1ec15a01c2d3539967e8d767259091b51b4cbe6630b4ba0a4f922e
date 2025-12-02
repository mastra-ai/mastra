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
import { Credential } from './credential';
/**
 * Type representing a Firebase OAuth access token (derived from a Google OAuth2 access token) which
 * can be used to authenticate to Firebase services such as the Realtime Database and Auth.
 */
export interface FirebaseAccessToken {
    accessToken: string;
    expirationTime: number;
}
/**
 * Internals of a FirebaseApp instance.
 */
export declare class FirebaseAppInternals {
    private credential_;
    private cachedToken_;
    private promiseToCachedToken_;
    private tokenListeners_;
    private isRefreshing;
    constructor(credential_: Credential);
    getToken(forceRefresh?: boolean): Promise<FirebaseAccessToken>;
    getCachedToken(): FirebaseAccessToken | null;
    private refreshToken;
    private shouldRefresh;
    /**
     * Adds a listener that is called each time a token changes.
     *
     * @param listener - The listener that will be called with each new token.
     */
    addAuthTokenListener(listener: (token: string) => void): void;
    /**
     * Removes a token listener.
     *
     * @param listener - The listener to remove.
     */
    removeAuthTokenListener(listener: (token: string) => void): void;
}
