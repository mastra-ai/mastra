import { getHttpConfigurationDefaults, mergeOtlpHttpConfigurationWithDefaults, } from './otlp-http-configuration';
import { getHttpConfigurationFromEnvironment } from './otlp-http-env-configuration';
import { diag } from '@opentelemetry/api';
import { wrapStaticHeadersInFunction } from './shared-configuration';
function convertLegacyAgentOptions(config) {
    // populate keepAlive for use with new settings
    if ((config === null || config === void 0 ? void 0 : config.keepAlive) != null) {
        if (config.httpAgentOptions != null) {
            if (config.httpAgentOptions.keepAlive == null) {
                // specific setting is not set, populate with non-specific setting.
                config.httpAgentOptions.keepAlive = config.keepAlive;
            }
            // do nothing, use specific setting otherwise
        }
        else {
            // populate specific option if AgentOptions does not exist.
            config.httpAgentOptions = {
                keepAlive: config.keepAlive,
            };
        }
    }
    return config.httpAgentOptions;
}
/**
 * @deprecated this will be removed in 2.0
 * @param config
 * @param signalIdentifier
 * @param signalResourcePath
 * @param requiredHeaders
 */
export function convertLegacyHttpOptions(config, signalIdentifier, signalResourcePath, requiredHeaders) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (config.metadata) {
        diag.warn('Metadata cannot be set when using http');
    }
    return mergeOtlpHttpConfigurationWithDefaults({
        url: config.url,
        headers: wrapStaticHeadersInFunction(config.headers),
        concurrencyLimit: config.concurrencyLimit,
        timeoutMillis: config.timeoutMillis,
        compression: config.compression,
        agentOptions: convertLegacyAgentOptions(config),
    }, getHttpConfigurationFromEnvironment(signalIdentifier, signalResourcePath), getHttpConfigurationDefaults(requiredHeaders, signalResourcePath));
}
//# sourceMappingURL=convert-legacy-node-http-options.js.map