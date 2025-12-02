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
/**
 * Platforms with which a Firebase App can be associated.
 */
export declare enum AppPlatform {
    /**
     * Unknown state. This is only used for distinguishing unset values.
     */
    PLATFORM_UNKNOWN = "PLATFORM_UNKNOWN",
    /**
     * The Firebase App is associated with iOS.
     */
    IOS = "IOS",
    /**
     * The Firebase App is associated with Android.
     */
    ANDROID = "ANDROID"
}
/**
 * Metadata about a Firebase app.
 */
export interface AppMetadata {
    /**
     * The globally unique, Firebase-assigned identifier of the app.
     *
     * @example
     * ```javascript
     * var appId = appMetadata.appId;
     * ```
     */
    appId: string;
    /**
     * The optional user-assigned display name of the app.
     *
     * @example
     * ```javascript
     * var displayName = appMetadata.displayName;
     * ```
     */
    displayName?: string;
    /**
     * The development platform of the app. Supporting Android and iOS app platforms.
     *
     * @example
     * ```javascript
     * var platform = AppPlatform.ANDROID;
     * ```
     */
    platform: AppPlatform;
    /**
     * The globally unique, user-assigned ID of the parent project for the app.
     *
     * @example
     * ```javascript
     * var projectId = appMetadata.projectId;
     * ```
     */
    projectId: string;
    /**
     * The fully-qualified resource name that identifies this app.
     *
     * This is useful when manually constructing requests for Firebase's public API.
     *
     * @example
     * ```javascript
     * var resourceName = androidAppMetadata.resourceName;
     * ```
     */
    resourceName: string;
}
