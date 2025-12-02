"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedConfigurationDefaults = exports.mergeOtlpSharedConfigurationWithDefaults = exports.wrapStaticHeadersInFunction = exports.validateTimeoutMillis = void 0;
function validateTimeoutMillis(timeoutMillis) {
    if (!Number.isNaN(timeoutMillis) &&
        Number.isFinite(timeoutMillis) &&
        timeoutMillis > 0) {
        return timeoutMillis;
    }
    throw new Error(`Configuration: timeoutMillis is invalid, expected number greater than 0 (actual: '${timeoutMillis}')`);
}
exports.validateTimeoutMillis = validateTimeoutMillis;
function wrapStaticHeadersInFunction(headers) {
    if (headers == null) {
        return undefined;
    }
    return () => headers;
}
exports.wrapStaticHeadersInFunction = wrapStaticHeadersInFunction;
/**
 * @param userProvidedConfiguration  Configuration options provided by the user in code.
 * @param fallbackConfiguration Fallback to use when the {@link userProvidedConfiguration} does not specify an option.
 * @param defaultConfiguration The defaults as defined by the exporter specification
 */
function mergeOtlpSharedConfigurationWithDefaults(userProvidedConfiguration, fallbackConfiguration, defaultConfiguration) {
    var _a, _b, _c, _d, _e, _f;
    return {
        timeoutMillis: validateTimeoutMillis((_b = (_a = userProvidedConfiguration.timeoutMillis) !== null && _a !== void 0 ? _a : fallbackConfiguration.timeoutMillis) !== null && _b !== void 0 ? _b : defaultConfiguration.timeoutMillis),
        concurrencyLimit: (_d = (_c = userProvidedConfiguration.concurrencyLimit) !== null && _c !== void 0 ? _c : fallbackConfiguration.concurrencyLimit) !== null && _d !== void 0 ? _d : defaultConfiguration.concurrencyLimit,
        compression: (_f = (_e = userProvidedConfiguration.compression) !== null && _e !== void 0 ? _e : fallbackConfiguration.compression) !== null && _f !== void 0 ? _f : defaultConfiguration.compression,
    };
}
exports.mergeOtlpSharedConfigurationWithDefaults = mergeOtlpSharedConfigurationWithDefaults;
function getSharedConfigurationDefaults() {
    return {
        timeoutMillis: 10000,
        concurrencyLimit: 30,
        compression: 'none',
    };
}
exports.getSharedConfigurationDefaults = getSharedConfigurationDefaults;
//# sourceMappingURL=shared-configuration.js.map