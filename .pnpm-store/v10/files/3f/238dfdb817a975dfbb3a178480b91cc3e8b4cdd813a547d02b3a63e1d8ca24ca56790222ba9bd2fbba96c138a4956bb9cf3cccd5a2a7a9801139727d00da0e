/**
 * @license
 * Copyright 2022 Google LLC
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
 * Keys for experimental properties on the `FirebaseDefaults` object.
 * @public
 */
export type ExperimentalKey = 'authTokenSyncURL' | 'authIdTokenMaxAge';
/**
 * An object that can be injected into the environment as __FIREBASE_DEFAULTS__,
 * either as a property of globalThis, a shell environment variable, or a
 * cookie.
 *
 * This object can be used to automatically configure and initialize
 * a Firebase app as well as any emulators.
 *
 * @public
 */
export interface FirebaseDefaults {
    config?: Record<string, string>;
    emulatorHosts?: Record<string, string>;
    _authTokenSyncURL?: string;
    _authIdTokenMaxAge?: number;
    /**
     * Override Firebase's runtime environment detection and
     * force the SDK to act as if it were in the specified environment.
     */
    forceEnvironment?: 'browser' | 'node';
    [key: string]: unknown;
}
declare global {
    var __FIREBASE_DEFAULTS__: FirebaseDefaults | undefined;
}
/**
 * Get the __FIREBASE_DEFAULTS__ object. It checks in order:
 * (1) if such an object exists as a property of `globalThis`
 * (2) if such an object was provided on a shell environment variable
 * (3) if such an object exists in a cookie
 * @public
 */
export declare const getDefaults: () => FirebaseDefaults | undefined;
/**
 * Returns emulator host stored in the __FIREBASE_DEFAULTS__ object
 * for the given product.
 * @returns a URL host formatted like `127.0.0.1:9999` or `[::1]:4000` if available
 * @public
 */
export declare const getDefaultEmulatorHost: (productName: string) => string | undefined;
/**
 * Returns emulator hostname and port stored in the __FIREBASE_DEFAULTS__ object
 * for the given product.
 * @returns a pair of hostname and port like `["::1", 4000]` if available
 * @public
 */
export declare const getDefaultEmulatorHostnameAndPort: (productName: string) => [hostname: string, port: number] | undefined;
/**
 * Returns Firebase app config stored in the __FIREBASE_DEFAULTS__ object.
 * @public
 */
export declare const getDefaultAppConfig: () => Record<string, string> | undefined;
/**
 * Returns an experimental setting on the __FIREBASE_DEFAULTS__ object (properties
 * prefixed by "_")
 * @public
 */
export declare const getExperimentalSetting: <T extends ExperimentalKey>(name: T) => FirebaseDefaults[`_${T}`];
