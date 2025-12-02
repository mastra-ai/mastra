
/**
 *
 * This method checks whether cookie is enabled within current browser
 * @return true if cookie is enabled within current browser
 */
export declare function areCookiesEnabled(): boolean;

/**
 * Throws an error if the provided assertion is falsy
 */
export declare const assert: (assertion: unknown, message: string) => void;

/**
 * Returns an Error object suitable for throwing.
 */
export declare const assertionError: (message: string) => Error;

/** Turn synchronous function into one called asynchronously. */
export declare function async(fn: Function, onError?: ErrorFn): Function;

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
declare interface Base64 {
    byteToCharMap_: {
        [key: number]: string;
    } | null;
    charToByteMap_: {
        [key: string]: number;
    } | null;
    byteToCharMapWebSafe_: {
        [key: number]: string;
    } | null;
    charToByteMapWebSafe_: {
        [key: string]: number;
    } | null;
    ENCODED_VALS_BASE: string;
    readonly ENCODED_VALS: string;
    readonly ENCODED_VALS_WEBSAFE: string;
    HAS_NATIVE_SUPPORT: boolean;
    encodeByteArray(input: number[] | Uint8Array, webSafe?: boolean): string;
    encodeString(input: string, webSafe?: boolean): string;
    decodeString(input: string, webSafe: boolean): string;
    decodeStringToByteArray(input: string, webSafe: boolean): number[];
    init_(): void;
}

export declare const base64: Base64;

/**
 * URL-safe base64 decoding
 *
 * NOTE: DO NOT use the global atob() function - it does NOT support the
 * base64Url variant encoding.
 *
 * @param str To be decoded
 * @return Decoded result, if possible
 */
export declare const base64Decode: (str: string) => string | null;

/**
 * URL-safe base64 encoding
 */
export declare const base64Encode: (str: string) => string;

/**
 * URL-safe base64 encoding (without "." padding in the end).
 * e.g. Used in JSON Web Token (JWT) parts.
 */
export declare const base64urlEncodeWithoutPadding: (str: string) => string;

/**
 * Based on the backoff method from
 * https://github.com/google/closure-library/blob/master/closure/goog/math/exponentialbackoff.js.
 * Extracted here so we don't need to pass metadata and a stateful ExponentialBackoff object around.
 */
export declare function calculateBackoffMillis(backoffCount: number, intervalMillis?: number, backoffFactor?: number): number;

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
declare interface Claims {
    [key: string]: {};
}

/**
 * @license
 * Copyright 2021 Google LLC
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
export declare interface Compat<T> {
    _delegate: T;
}

export declare type CompleteFn = () => void;

/**
 * @fileoverview Firebase constants.  Some of these (@defines) can be overridden at compile-time.
 */
export declare const CONSTANTS: {
    /**
     * @define {boolean} Whether this is the client Node.js SDK.
     */
    NODE_CLIENT: boolean;
    /**
     * @define {boolean} Whether this is the Admin Node.js SDK.
     */
    NODE_ADMIN: boolean;
    /**
     * Firebase SDK Version
     */
    SDK_VERSION: string;
};

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
export declare function contains<T extends object>(obj: T, key: string): boolean;

export declare function createMockUserToken(token: EmulatorMockTokenOptions, projectId?: string): string;

/**
 * Helper to make a Subscribe function (just like Promise helps make a
 * Thenable).
 *
 * @param executor Function which can make calls to a single Observer
 *     as a proxy.
 * @param onNoObservers Callback when count of Observers goes to zero.
 */
export declare function createSubscribe<T>(executor: Executor<T>, onNoObservers?: Executor<T>): Subscribe<T>;

/**
 * Decodes a Firebase auth. token into constituent parts.
 *
 * Notes:
 * - May return with invalid / incomplete claims if there's no native base64 decoding support.
 * - Doesn't check if the token is actually valid.
 */
export declare const decode: (token: string) => DecodedToken;

/**
 * An error encountered while decoding base64 string.
 */
export declare class DecodeBase64StringError extends Error {
    readonly name = "DecodeBase64StringError";
}

declare interface DecodedToken {
    header: object;
    claims: Claims;
    data: object;
    signature: string;
}

declare interface DecodedToken {
    header: object;
    claims: Claims;
    data: object;
    signature: string;
}

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
 * Do a deep-copy of basic JavaScript Objects or Arrays.
 */
export declare function deepCopy<T>(value: T): T;

/**
 * Deep equal two objects. Support Arrays and Objects.
 */
export declare function deepEqual(a: object, b: object): boolean;

/**
 * Copy properties from source to target (recursively allows extension
 * of Objects and Arrays).  Scalar values in the target are over-written.
 * If target is undefined, an object of the appropriate type will be created
 * (and returned).
 *
 * We recursively copy all child properties of plain Objects in the source- so
 * that namespace- like dictionaries are merged.
 *
 * Note that the target can be a function, in which case the properties in
 * the source Object are copied onto it as static properties of the Function.
 *
 * Note: we don't merge __proto__ to prevent prototype pollution
 */
export declare function deepExtend(target: unknown, source: unknown): unknown;

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
export declare class Deferred<R> {
    promise: Promise<R>;
    reject: (value?: unknown) => void;
    resolve: (value?: unknown) => void;
    constructor();
    /**
     * Our API internals are not promisified and cannot because our callback APIs have subtle expectations around
     * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
     * and returns a node-style callback which will resolve or reject the Deferred's promise.
     */
    wrapCallback(callback?: (error?: unknown, value?: unknown) => void): (error: unknown, value?: unknown) => void;
}

export declare type EmulatorMockTokenOptions = ({
    user_id: string;
} | {
    sub: string;
}) & Partial<FirebaseIdToken>;

export declare interface ErrorData {
    [key: string]: unknown;
}

export declare class ErrorFactory<ErrorCode extends string, ErrorParams extends {
    readonly [K in ErrorCode]?: ErrorData;
} = {}> {
    private readonly service;
    private readonly serviceName;
    private readonly errors;
    constructor(service: string, serviceName: string, errors: ErrorMap<ErrorCode>);
    create<K extends ErrorCode>(code: K, ...data: K extends keyof ErrorParams ? [ErrorParams[K]] : []): FirebaseError;
}

export declare type ErrorFn = (error: Error) => void;

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
 * @fileoverview Standardized Firebase Error.
 *
 * Usage:
 *
 *   // TypeScript string literals for type-safe codes
 *   type Err =
 *     'unknown' |
 *     'object-not-found'
 *     ;
 *
 *   // Closure enum for type-safe error codes
 *   // at-enum {string}
 *   var Err = {
 *     UNKNOWN: 'unknown',
 *     OBJECT_NOT_FOUND: 'object-not-found',
 *   }
 *
 *   let errors: Map<Err, string> = {
 *     'generic-error': "Unknown error",
 *     'file-not-found': "Could not find file: {$file}",
 *   };
 *
 *   // Type-safe function - must pass a valid error code as param.
 *   let error = new ErrorFactory<Err>('service', 'Service', errors);
 *
 *   ...
 *   throw error.create(Err.GENERIC);
 *   ...
 *   throw error.create(Err.FILE_NOT_FOUND, {'file': fileName});
 *   ...
 *   // Service: Could not file file: foo.txt (service/file-not-found).
 *
 *   catch (e) {
 *     assert(e.message === "Could not find file: foo.txt.");
 *     if ((e as FirebaseError)?.code === 'service/file-not-found') {
 *       console.log("Could not read file: " + e['file']);
 *     }
 *   }
 */
export declare type ErrorMap<ErrorCode extends string> = {
    readonly [K in ErrorCode]: string;
};

/**
 * Generates a string to prefix an error message about failed argument validation
 *
 * @param fnName The function name
 * @param argName The name of the argument
 * @return The prefix to add to the error thrown for validation.
 */
export declare function errorPrefix(fnName: string, argName: string): string;

export declare type Executor<T> = (observer: Observer<T>) => void;

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
export declare type ExperimentalKey = 'authTokenSyncURL' | 'authIdTokenMaxAge';

/**
 * Extract the query string part of a URL, including the leading question mark (if present).
 */
export declare function extractQuerystring(url: string): string;

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
export declare interface FirebaseDefaults {
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

export declare class FirebaseError extends Error {
    /** The error code for this error. */
    readonly code: string;
    /** Custom data for this error. */
    customData?: Record<string, unknown> | undefined;
    /** The custom name for all FirebaseErrors. */
    readonly name: string;
    constructor(
    /** The error code for this error. */
    code: string, message: string, 
    /** Custom data for this error. */
    customData?: Record<string, unknown> | undefined);
}

declare interface FirebaseIdToken {
    iss: string;
    aud: string;
    sub: string;
    iat: number;
    exp: number;
    user_id: string;
    auth_time: number;
    provider_id?: 'anonymous';
    email?: string;
    email_verified?: boolean;
    phone_number?: string;
    name?: string;
    picture?: string;
    firebase: {
        sign_in_provider: FirebaseSignInProvider;
        identities?: {
            [provider in FirebaseSignInProvider]?: string[];
        };
    };
    [claim: string]: unknown;
    uid?: never;
}

/**
 * @license
 * Copyright 2021 Google LLC
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
export declare type FirebaseSignInProvider = 'custom' | 'email' | 'password' | 'phone' | 'anonymous' | 'google.com' | 'facebook.com' | 'github.com' | 'twitter.com' | 'microsoft.com' | 'apple.com';

/**
 * Returns Firebase app config stored in the __FIREBASE_DEFAULTS__ object.
 * @public
 */
export declare const getDefaultAppConfig: () => Record<string, string> | undefined;

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
 * Get the __FIREBASE_DEFAULTS__ object. It checks in order:
 * (1) if such an object exists as a property of `globalThis`
 * (2) if such an object was provided on a shell environment variable
 * (3) if such an object exists in a cookie
 * @public
 */
export declare const getDefaults: () => FirebaseDefaults | undefined;

/**
 * Returns an experimental setting on the __FIREBASE_DEFAULTS__ object (properties
 * prefixed by "_")
 * @public
 */
export declare const getExperimentalSetting: <T extends ExperimentalKey>(name: T) => FirebaseDefaults[`_${T}`];

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
 * Polyfill for `globalThis` object.
 * @returns the `globalThis` object for the given environment.
 * @public
 */
export declare function getGlobal(): typeof globalThis;

export declare function getModularInstance<ExpService>(service: Compat<ExpService> | ExpService): ExpService;

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
 * Attempts to peer into an auth token and determine if it's an admin auth token by looking at the claims portion.
 *
 * Notes:
 * - May return a false negative if there's no native base64 decoding support.
 * - Doesn't check if the token is actually valid.
 */
export declare const isAdmin: (token: string) => boolean;

/**
 * Detect Browser Environment.
 * Note: This will return true for certain test frameworks that are incompletely
 * mimicking a browser, and should not lead to assuming all browser APIs are
 * available.
 */
export declare function isBrowser(): boolean;

export declare function isBrowserExtension(): boolean;

/**
 * Detect Cloudflare Worker context.
 */
export declare function isCloudflareWorker(): boolean;

/**
 * @license
 * Copyright 2025 Google LLC
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
 * Checks whether host is a cloud workstation or not.
 * @public
 */
export declare function isCloudWorkstation(url: string): boolean;

/** Detects Electron apps. */
export declare function isElectron(): boolean;

export declare function isEmpty(obj: object): obj is {};

/** Detects Internet Explorer. */
export declare function isIE(): boolean;

/**
 * This method checks if indexedDB is supported by current browser/service worker context
 * @return true if indexedDB is supported by current browser/service worker context
 */
export declare function isIndexedDBAvailable(): boolean;

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
 * Detect whether the current SDK build is the Node version.
 *
 * @return true if it's the Node SDK build.
 */
export declare function isNodeSdk(): boolean;

/**
 * Detect React Native.
 *
 * @return true if ReactNative environment is detected.
 */
export declare function isReactNative(): boolean;

/** Returns true if we are running in Safari. */
export declare function isSafari(): boolean;

/** Returns true if we are running in Safari or WebKit */
export declare function isSafariOrWebkit(): boolean;

/**
 * Decodes a Firebase auth. token and returns its issued at time if valid, null otherwise.
 *
 * Notes:
 * - May return null if there's no native base64 decoding support.
 * - Doesn't check if the token is actually valid.
 */
export declare const issuedAtTime: (token: string) => number | null;

/** Detects Universal Windows Platform apps. */
export declare function isUWP(): boolean;

/**
 * Decodes a Firebase auth. token and checks the validity of its format. Expects a valid issued-at time.
 *
 * Notes:
 * - May return a false negative if there's no native base64 decoding support.
 * - Doesn't check if the token is actually valid.
 */
export declare const isValidFormat: (token: string) => boolean;

/**
 * Decodes a Firebase auth. token and checks the validity of its time-based claims. Will return true if the
 * token is within the time window authorized by the 'nbf' (not-before) and 'iat' (issued-at) claims.
 *
 * Notes:
 * - May return a false negative if there's no native base64 decoding support.
 * - Doesn't check if the token is actually valid.
 */
export declare const isValidTimestamp: (token: string) => boolean;

/**
 * Detect Web Worker context.
 */
export declare function isWebWorker(): boolean;

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
 * Evaluates a JSON string into a javascript object.
 *
 * @param {string} str A string containing JSON.
 * @return {*} The javascript object representing the specified JSON.
 */
export declare function jsonEval(str: string): unknown;

export declare function map<K extends string, V, U>(obj: {
    [key in K]: V;
}, fn: (value: V, key: K, obj: {
    [key in K]: V;
}) => U, contextObj?: unknown): {
    [key in K]: U;
};

/**
 * The maximum milliseconds to increase to.
 *
 * <p>Visible for testing
 */
export declare const MAX_VALUE_MILLIS: number;

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
export declare type NextFn<T> = (value: T) => void;

export declare interface Observable<T> {
    subscribe: Subscribe<T>;
}

export declare interface Observer<T> {
    next: NextFn<T>;
    error: ErrorFn;
    complete: CompleteFn;
}

/**
 * @license
 * Copyright 2020 Google LLC
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
 * Provide English ordinal letters after a number
 */
export declare function ordinal(i: number): string;

export declare type PartialObserver<T> = Partial<Observer<T>>;

/**
 * Makes a fetch request to the given server.
 * Mostly used for forwarding cookies in Firebase Studio.
 * @public
 */
export declare function pingServer(endpoint: string): Promise<boolean>;

/* Excluded from this release type: promiseWithTimeout */

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
 * Returns a querystring-formatted string (e.g. &arg=val&arg2=val2) from a
 * params object (e.g. {arg: 'val', arg2: 'val2'})
 * Note: You must prepend it with ? when adding it to a URL.
 */
export declare function querystring(querystringParams: {
    [key: string]: string | number;
}): string;

/**
 * Decodes a querystring (e.g. ?arg=val&arg2=val2) into a params object
 * (e.g. {arg: 'val', arg2: 'val2'})
 */
export declare function querystringDecode(querystring: string): Record<string, string>;

/**
 * The percentage of backoff time to randomize by.
 * See
 * http://go/safe-client-behavior#step-1-determine-the-appropriate-retry-interval-to-handle-spike-traffic
 * for context.
 *
 * <p>Visible for testing
 */
export declare const RANDOM_FACTOR = 0.5;

export declare function safeGet<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined;

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
 * @fileoverview SHA-1 cryptographic hash.
 * Variable names follow the notation in FIPS PUB 180-3:
 * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
 *
 * Usage:
 *   var sha1 = new sha1();
 *   sha1.update(bytes);
 *   var hash = sha1.digest();
 *
 * Performance:
 *   Chrome 23:   ~400 Mbit/s
 *   Firefox 16:  ~250 Mbit/s
 *
 */
/**
 * SHA-1 cryptographic hash constructor.
 *
 * The properties declared here are discussed in the above algorithm document.
 * @constructor
 * @final
 * @struct
 */
export declare class Sha1 {
    /**
     * Holds the previous values of accumulated variables a-e in the compress_
     * function.
     * @private
     */
    private chain_;
    /**
     * A buffer holding the partially computed hash result.
     * @private
     */
    private buf_;
    /**
     * An array of 80 bytes, each a part of the message to be hashed.  Referred to
     * as the message schedule in the docs.
     * @private
     */
    private W_;
    /**
     * Contains data needed to pad messages less than 64 bytes.
     * @private
     */
    private pad_;
    /**
     * @private {number}
     */
    private inbuf_;
    /**
     * @private {number}
     */
    private total_;
    blockSize: number;
    constructor();
    reset(): void;
    /**
     * Internal compress helper function.
     * @param buf Block to compress.
     * @param offset Offset of the block in the buffer.
     * @private
     */
    compress_(buf: number[] | Uint8Array | string, offset?: number): void;
    update(bytes?: number[] | Uint8Array | string, length?: number): void;
    /** @override */
    digest(): number[];
}

/**
 * Returns JSON representing a javascript object.
 * @param {*} data JavaScript object to be stringified.
 * @return {string} The JSON contents of the object.
 */
export declare function stringify(data: unknown): string;

/**
 * Calculate length without actually converting; useful for doing cheaper validation.
 * @param {string} str
 * @return {number}
 */
export declare const stringLength: (str: string) => number;

export declare interface StringLike {
    toString(): string;
}

/**
 * @param {string} str
 * @return {Array}
 */
export declare const stringToByteArray: (str: string) => number[];

/**
 * The Subscribe interface has two forms - passing the inline function
 * callbacks, or a object interface with callback properties.
 */
export declare interface Subscribe<T> {
    (next?: NextFn<T>, error?: ErrorFn, complete?: CompleteFn): Unsubscribe;
    (observer: PartialObserver<T>): Unsubscribe;
}

export declare type Unsubscribe = () => void;

/**
 * Updates Emulator Banner. Primarily used for Firebase Studio
 * @param name
 * @param isRunningEmulator
 * @public
 */
export declare function updateEmulatorBanner(name: string, isRunningEmulator: boolean): void;

/**
 * Check to make sure the appropriate number of arguments are provided for a public function.
 * Throws an error if it fails.
 *
 * @param fnName The function name
 * @param minCount The minimum number of arguments to allow for the function call
 * @param maxCount The maximum number of argument to allow for the function call
 * @param argCount The actual number of arguments provided.
 */
export declare const validateArgCount: (fnName: string, minCount: number, maxCount: number, argCount: number) => void;

export declare function validateCallback(fnName: string, argumentName: string, callback: Function, optional: boolean): void;

export declare function validateContextObject(fnName: string, argumentName: string, context: unknown, optional: boolean): void;

/**
 * This method validates browser/sw context for indexedDB by opening a dummy indexedDB database and reject
 * if errors occur during the database open operation.
 *
 * @throws exception if current browser/sw context can't run idb.open (ex: Safari iframe, Firefox
 * private browsing)
 */
export declare function validateIndexedDBOpenable(): Promise<boolean>;

/**
 * @param fnName
 * @param argumentNumber
 * @param namespace
 * @param optional
 */
export declare function validateNamespace(fnName: string, namespace: string, optional: boolean): void;

export { }
