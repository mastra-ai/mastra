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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { getSharedConfigurationDefaults, mergeOtlpSharedConfigurationWithDefaults, } from './shared-configuration';
import { validateAndNormalizeHeaders } from '../util';
function mergeHeaders(userProvidedHeaders, fallbackHeaders, defaultHeaders) {
    var requiredHeaders = __assign({}, defaultHeaders());
    var headers = {};
    return function () {
        // add fallback ones first
        if (fallbackHeaders != null) {
            Object.assign(headers, fallbackHeaders());
        }
        // override with user-provided ones
        if (userProvidedHeaders != null) {
            Object.assign(headers, userProvidedHeaders());
        }
        // override required ones.
        return Object.assign(headers, requiredHeaders);
    };
}
function validateUserProvidedUrl(url) {
    if (url == null) {
        return undefined;
    }
    try {
        new URL(url);
        return url;
    }
    catch (e) {
        throw new Error("Configuration: Could not parse user-provided export URL: '" + url + "'");
    }
}
/**
 * @param userProvidedConfiguration  Configuration options provided by the user in code.
 * @param fallbackConfiguration Fallback to use when the {@link userProvidedConfiguration} does not specify an option.
 * @param defaultConfiguration The defaults as defined by the exporter specification
 */
export function mergeOtlpHttpConfigurationWithDefaults(userProvidedConfiguration, fallbackConfiguration, defaultConfiguration) {
    var _a, _b, _c, _d;
    return __assign(__assign({}, mergeOtlpSharedConfigurationWithDefaults(userProvidedConfiguration, fallbackConfiguration, defaultConfiguration)), { headers: mergeHeaders(validateAndNormalizeHeaders(userProvidedConfiguration.headers), fallbackConfiguration.headers, defaultConfiguration.headers), url: (_b = (_a = validateUserProvidedUrl(userProvidedConfiguration.url)) !== null && _a !== void 0 ? _a : fallbackConfiguration.url) !== null && _b !== void 0 ? _b : defaultConfiguration.url, agentOptions: (_d = (_c = userProvidedConfiguration.agentOptions) !== null && _c !== void 0 ? _c : fallbackConfiguration.agentOptions) !== null && _d !== void 0 ? _d : defaultConfiguration.agentOptions });
}
export function getHttpConfigurationDefaults(requiredHeaders, signalResourcePath) {
    return __assign(__assign({}, getSharedConfigurationDefaults()), { headers: function () { return requiredHeaders; }, url: 'http://localhost:4318/' + signalResourcePath, agentOptions: { keepAlive: true } });
}
//# sourceMappingURL=otlp-http-configuration.js.map