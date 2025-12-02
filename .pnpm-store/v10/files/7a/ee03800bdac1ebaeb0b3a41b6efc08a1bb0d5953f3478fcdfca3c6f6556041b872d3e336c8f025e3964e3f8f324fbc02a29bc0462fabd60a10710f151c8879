import { IExporterTransport } from '../exporter-transport';
import { HeadersFactory } from '../configuration/otlp-http-configuration';
export interface SendBeaconParameters {
    url: string;
    /**
     * Only `Content-Type` will be used, sendBeacon does not support custom headers
     * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
     */
    headers: HeadersFactory;
}
export declare function createSendBeaconTransport(parameters: SendBeaconParameters): IExporterTransport;
//# sourceMappingURL=send-beacon-transport.d.ts.map