/*! firebase-admin v13.5.0 */
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
import { App } from '../app';
import { AppCheckToken as TAppCheckToken, AppCheckTokenOptions as TAppCheckTokenOptions, DecodedAppCheckToken as TDecodedAppCheckToken, VerifyAppCheckTokenOptions as TVerifyAppCheckTokenOptions, VerifyAppCheckTokenResponse as TVerifyAppCheckTokenResponse } from './app-check-api';
import { AppCheck as TAppCheck } from './app-check';
/**
 * Gets the {@link firebase-admin.app-check#AppCheck} service for the default app or a given app.
 *
 * `admin.appCheck()` can be called with no arguments to access the default
 * app's `AppCheck` service or as `admin.appCheck(app)` to access the
 * `AppCheck` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the `AppCheck` service for the default app
 * var defaultAppCheck = admin.appCheck();
 * ```
 *
 * @example
 * ```javascript
 * // Get the `AppCheck` service for a given app
 * var otherAppCheck = admin.appCheck(otherApp);
 * ```
 *
 * @param app - Optional app for which to return the `AppCheck` service.
 *   If not provided, the default `AppCheck` service is returned.
 *
 * @returns The default `AppCheck` service if no
 *   app is provided, or the `AppCheck` service associated with the provided
 *   app.
 */
export declare function appCheck(app?: App): appCheck.AppCheck;
export declare namespace appCheck {
    /**
     * Type alias to {@link firebase-admin.app-check#AppCheck}.
     */
    type AppCheck = TAppCheck;
    /**
     * Type alias to {@link firebase-admin.app-check#AppCheckToken}.
     */
    type AppCheckToken = TAppCheckToken;
    /**
     * Type alias to {@link firebase-admin.app-check#DecodedAppCheckToken}.
     */
    type DecodedAppCheckToken = TDecodedAppCheckToken;
    /**
     * Type alias to {@link firebase-admin.app-check#VerifyAppCheckTokenResponse}.
     */
    type VerifyAppCheckTokenResponse = TVerifyAppCheckTokenResponse;
    /**
     * Type alias to {@link firebase-admin.app-check#AppCheckTokenOptions}.
     */
    type AppCheckTokenOptions = TAppCheckTokenOptions;
    /**
     * Type alias to {@link firebase-admin.app-check#VerifyAppCheckTokenOptions}.
     */
    type VerifyAppCheckTokenOptions = TVerifyAppCheckTokenOptions;
}
