import { createOtlpSendBeaconExportDelegate, createOtlpXhrExportDelegate, } from '../otlp-browser-http-export-delegate';
import { convertLegacyBrowserHttpOptions } from './convert-legacy-browser-http-options';
/**
 * @deprecated
 * @param config
 * @param serializer
 * @param signalResourcePath
 * @param requiredHeaders
 */
export function createLegacyOtlpBrowserExportDelegate(config, serializer, signalResourcePath, requiredHeaders) {
    const useXhr = !!config.headers || typeof navigator.sendBeacon !== 'function';
    const options = convertLegacyBrowserHttpOptions(config, signalResourcePath, requiredHeaders);
    if (useXhr) {
        return createOtlpXhrExportDelegate(options, serializer);
    }
    else {
        return createOtlpSendBeaconExportDelegate(options, serializer);
    }
}
//# sourceMappingURL=create-legacy-browser-delegate.js.map