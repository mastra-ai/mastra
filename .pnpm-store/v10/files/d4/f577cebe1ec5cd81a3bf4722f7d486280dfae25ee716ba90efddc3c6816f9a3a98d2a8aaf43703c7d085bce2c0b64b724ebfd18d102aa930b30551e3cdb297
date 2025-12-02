/**
 * @license
 * Copyright 2017 Google LLC
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
 * Returns navigator.userAgent string or '' if it's not defined.
 * @return user agent string
 */
export declare function getUA(): string;
/**
 * Detect Cordova / PhoneGap / Ionic frameworks on a mobile device.
 *
 * Deliberately does not rely on checking `file://` URLs (as this fails PhoneGap
 * in the Ripple emulator) nor Cordova `onDeviceReady`, which would normally
 * wait for a callback.
 */
export declare function isMobileCordova(): boolean;
/**
 * Detect Node.js.
 *
 * @return true if Node.js environment is detected or specified.
 */
export declare function isNode(): boolean;
/**
 * Detect Browser Environment.
 * Note: This will return true for certain test frameworks that are incompletely
 * mimicking a browser, and should not lead to assuming all browser APIs are
 * available.
 */
export declare function isBrowser(): boolean;
/**
 * Detect Web Worker context.
 */
export declare function isWebWorker(): boolean;
/**
 * Detect Cloudflare Worker context.
 */
export declare function isCloudflareWorker(): boolean;
export declare function isBrowserExtension(): boolean;
/**
 * Detect React Native.
 *
 * @return true if ReactNative environment is detected.
 */
export declare function isReactNative(): boolean;
/** Detects Electron apps. */
export declare function isElectron(): boolean;
/** Detects Internet Explorer. */
export declare function isIE(): boolean;
/** Detects Universal Windows Platform apps. */
export declare function isUWP(): boolean;
/**
 * Detect whether the current SDK build is the Node version.
 *
 * @return true if it's the Node SDK build.
 */
export declare function isNodeSdk(): boolean;
/** Returns true if we are running in Safari. */
export declare function isSafari(): boolean;
/** Returns true if we are running in Safari or WebKit */
export declare function isSafariOrWebkit(): boolean;
/**
 * This method checks if indexedDB is supported by current browser/service worker context
 * @return true if indexedDB is supported by current browser/service worker context
 */
export declare function isIndexedDBAvailable(): boolean;
/**
 * This method validates browser/sw context for indexedDB by opening a dummy indexedDB database and reject
 * if errors occur during the database open operation.
 *
 * @throws exception if current browser/sw context can't run idb.open (ex: Safari iframe, Firefox
 * private browsing)
 */
export declare function validateIndexedDBOpenable(): Promise<boolean>;
/**
 *
 * This method checks whether cookie is enabled within current browser
 * @return true if cookie is enabled within current browser
 */
export declare function areCookiesEnabled(): boolean;
