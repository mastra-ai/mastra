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
import { AppCheckToken, AppCheckTokenOptions, VerifyAppCheckTokenOptions, VerifyAppCheckTokenResponse } from './app-check-api';
/**
 * The Firebase `AppCheck` service interface.
 */
export declare class AppCheck {
    readonly app: App;
    private readonly client;
    private readonly tokenGenerator;
    private readonly appCheckTokenVerifier;
    /**
     * Creates a new {@link AppCheckToken} that can be sent
     * back to a client.
     *
     * @param appId - The app ID to use as the JWT app_id.
     * @param options - Optional options object when creating a new App Check Token.
     *
     * @returns A promise that fulfills with a `AppCheckToken`.
     */
    createToken(appId: string, options?: AppCheckTokenOptions): Promise<AppCheckToken>;
    /**
     * Verifies a Firebase App Check token (JWT). If the token is valid, the promise is
     * fulfilled with the token's decoded claims; otherwise, the promise is
     * rejected.
     *
     * @param appCheckToken - The App Check token to verify.
     * @param options - Optional {@link VerifyAppCheckTokenOptions} object when verifying an App Check Token.
     *
     * @returns A promise fulfilled with the token's decoded claims
     *   if the App Check token is valid; otherwise, a rejected promise.
     */
    verifyToken(appCheckToken: string, options?: VerifyAppCheckTokenOptions): Promise<VerifyAppCheckTokenResponse>;
    private validateVerifyAppCheckTokenOptions;
}
