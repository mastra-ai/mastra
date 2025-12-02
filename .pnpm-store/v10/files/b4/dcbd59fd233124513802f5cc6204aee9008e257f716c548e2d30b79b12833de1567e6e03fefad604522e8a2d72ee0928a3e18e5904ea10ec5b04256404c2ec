"use strict";
/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasWindowFetch = hasWindowFetch;
exports.isNodeJS = isNodeJS;
/* global window */
const features = {
    windowFetch: typeof window !== 'undefined' &&
        window?.fetch &&
        typeof window?.fetch === 'function',
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    textEncoder: typeof TextEncoder !== 'undefined',
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    textDecoder: typeof TextDecoder !== 'undefined',
    nodeJS: typeof process !== 'undefined' && process?.versions?.node,
};
function hasWindowFetch() {
    return features.windowFetch;
}
function isNodeJS() {
    return features.nodeJS;
}
//# sourceMappingURL=featureDetection.js.map