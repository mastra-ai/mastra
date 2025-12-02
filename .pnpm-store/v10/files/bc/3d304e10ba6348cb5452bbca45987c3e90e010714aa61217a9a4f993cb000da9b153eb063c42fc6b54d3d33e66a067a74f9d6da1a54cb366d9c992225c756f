"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedConfigurationFromEnvironment = void 0;
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
const core_1 = require("@opentelemetry/core");
const api_1 = require("@opentelemetry/api");
function parseAndValidateTimeoutFromEnv(timeoutEnvVar) {
    const envTimeout = (0, core_1.getNumberFromEnv)(timeoutEnvVar);
    if (envTimeout != null) {
        if (Number.isFinite(envTimeout) && envTimeout > 0) {
            return envTimeout;
        }
        api_1.diag.warn(`Configuration: ${timeoutEnvVar} is invalid, expected number greater than 0 (actual: ${envTimeout})`);
    }
    return undefined;
}
function getTimeoutFromEnv(signalIdentifier) {
    const specificTimeout = parseAndValidateTimeoutFromEnv(`OTEL_EXPORTER_OTLP_${signalIdentifier}_TIMEOUT`);
    const nonSpecificTimeout = parseAndValidateTimeoutFromEnv('OTEL_EXPORTER_OTLP_TIMEOUT');
    return specificTimeout ?? nonSpecificTimeout;
}
function parseAndValidateCompressionFromEnv(compressionEnvVar) {
    const compression = (0, core_1.getStringFromEnv)(compressionEnvVar)?.trim();
    if (compression == null || compression === 'none' || compression === 'gzip') {
        return compression;
    }
    api_1.diag.warn(`Configuration: ${compressionEnvVar} is invalid, expected 'none' or 'gzip' (actual: '${compression}')`);
    return undefined;
}
function getCompressionFromEnv(signalIdentifier) {
    const specificCompression = parseAndValidateCompressionFromEnv(`OTEL_EXPORTER_OTLP_${signalIdentifier}_COMPRESSION`);
    const nonSpecificCompression = parseAndValidateCompressionFromEnv('OTEL_EXPORTER_OTLP_COMPRESSION');
    return specificCompression ?? nonSpecificCompression;
}
function getSharedConfigurationFromEnvironment(signalIdentifier) {
    return {
        timeoutMillis: getTimeoutFromEnv(signalIdentifier),
        compression: getCompressionFromEnv(signalIdentifier),
    };
}
exports.getSharedConfigurationFromEnvironment = getSharedConfigurationFromEnvironment;
//# sourceMappingURL=shared-env-configuration.js.map