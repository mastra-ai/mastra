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
export interface ServiceAccount {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
}
/**
 * Interface for Google OAuth 2.0 access tokens.
 */
export interface GoogleOAuthAccessToken {
    access_token: string;
    expires_in: number;
}
/**
 * Interface that provides Google OAuth2 access tokens used to authenticate
 * with Firebase services.
 *
 * In most cases, you will not need to implement this yourself and can instead
 * use the default implementations provided by the `firebase-admin/app` module.
 */
export interface Credential {
    /**
     * Returns a Google OAuth2 access token object used to authenticate with
     * Firebase services.
     *
     * @returns A Google OAuth2 access token object.
     */
    getAccessToken(): Promise<GoogleOAuthAccessToken>;
}
