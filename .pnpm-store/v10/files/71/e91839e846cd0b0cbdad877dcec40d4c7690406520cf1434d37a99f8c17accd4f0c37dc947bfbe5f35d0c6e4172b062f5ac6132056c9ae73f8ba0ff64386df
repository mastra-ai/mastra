import { diag } from '@opentelemetry/api';
function parseAndValidateTimeoutFromEnv(timeoutEnvVar) {
    var _a;
    const envTimeout = (_a = process.env[timeoutEnvVar]) === null || _a === void 0 ? void 0 : _a.trim();
    if (envTimeout != null && envTimeout !== '') {
        const definedTimeout = Number(envTimeout);
        if (!Number.isNaN(definedTimeout) &&
            Number.isFinite(definedTimeout) &&
            definedTimeout > 0) {
            return definedTimeout;
        }
        diag.warn(`Configuration: ${timeoutEnvVar} is invalid, expected number greater than 0 (actual: ${envTimeout})`);
    }
    return undefined;
}
function getTimeoutFromEnv(signalIdentifier) {
    const specificTimeout = parseAndValidateTimeoutFromEnv(`OTEL_EXPORTER_OTLP_${signalIdentifier}_TIMEOUT`);
    const nonSpecificTimeout = parseAndValidateTimeoutFromEnv('OTEL_EXPORTER_OTLP_TIMEOUT');
    return specificTimeout !== null && specificTimeout !== void 0 ? specificTimeout : nonSpecificTimeout;
}
function parseAndValidateCompressionFromEnv(compressionEnvVar) {
    var _a;
    const compression = (_a = process.env[compressionEnvVar]) === null || _a === void 0 ? void 0 : _a.trim();
    if (compression === '') {
        return undefined;
    }
    if (compression == null || compression === 'none' || compression === 'gzip') {
        return compression;
    }
    diag.warn(`Configuration: ${compressionEnvVar} is invalid, expected 'none' or 'gzip' (actual: '${compression}')`);
    return undefined;
}
function getCompressionFromEnv(signalIdentifier) {
    const specificCompression = parseAndValidateCompressionFromEnv(`OTEL_EXPORTER_OTLP_${signalIdentifier}_COMPRESSION`);
    const nonSpecificCompression = parseAndValidateCompressionFromEnv('OTEL_EXPORTER_OTLP_COMPRESSION');
    return specificCompression !== null && specificCompression !== void 0 ? specificCompression : nonSpecificCompression;
}
export function getSharedConfigurationFromEnvironment(signalIdentifier) {
    return {
        timeoutMillis: getTimeoutFromEnv(signalIdentifier),
        compression: getCompressionFromEnv(signalIdentifier),
    };
}
//# sourceMappingURL=shared-env-configuration.js.map