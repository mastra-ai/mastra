/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2018 Google Inc.
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
 * This is the interface that defines the required continue/state URL with
 * optional Android and iOS bundle identifiers.
 */
export interface ActionCodeSettings {
    /**
     * Defines the link continue/state URL, which has different meanings in
     * different contexts:
     * <ul>
     * <li>When the link is handled in the web action widgets, this is the deep
     *     link in the `continueUrl` query parameter.</li>
     * <li>When the link is handled in the app directly, this is the `continueUrl`
     *     query parameter in the deep link of the Dynamic Link.</li>
     * </ul>
     */
    url: string;
    /**
     * Whether to open the link via a mobile app or a browser.
     * The default is false. When set to true, the action code link is sent
     * as a Universal Link or Android App Link and is opened by the app if
     * installed. In the false case, the code is sent to the web widget first
     * and then redirects to the app if installed.
     */
    handleCodeInApp?: boolean;
    /**
     * Defines the iOS bundle ID. This will try to open the link in an iOS app if it
     * is installed.
     */
    iOS?: {
        /**
         * Defines the required iOS bundle ID of the app where the link should be
         * handled if the application is already installed on the device.
         */
        bundleId: string;
    };
    /**
     * Defines the Android package name. This will try to open the link in an
     * android app if it is installed. If `installApp` is passed, it specifies
     * whether to install the Android app if the device supports it and the app is
     * not already installed. If this field is provided without a `packageName`, an
     * error is thrown explaining that the `packageName` must be provided in
     * conjunction with this field. If `minimumVersion` is specified, and an older
     * version of the app is installed, the user is taken to the Play Store to
     * upgrade the app.
     */
    android?: {
        /**
         * Defines the required Android package name of the app where the link should be
         * handled if the Android app is installed.
         */
        packageName: string;
        /**
         * Whether to install the Android app if the device supports it and the app is
         * not already installed.
         */
        installApp?: boolean;
        /**
         * The Android minimum version if available. If the installed app is an older
         * version, the user is taken to the GOogle Play Store to upgrade the app.
         */
        minimumVersion?: string;
    };
    /**
     * Defines the dynamic link domain to use for the current link if it is to be
     * opened using Firebase Dynamic Links, as multiple dynamic link domains can be
     * configured per project. This field provides the ability to explicitly choose
     * configured per project. This fields provides the ability explicitly choose
     * one. If none is provided, the oldest domain is used by default.
     * @deprecated use `linkDomain` instead
     */
    dynamicLinkDomain?: string;
    /**
     * Defines the custom Firebase Hosting domain to use when the link is to be opened
     * via a specified mobile app,
     * This is a replacement of Firebase Dynamic Link.
     * If none is provided,
     * a default hosting domain will be used (for example, `example.firebaseapp.com`)
     */
    linkDomain?: string;
}
