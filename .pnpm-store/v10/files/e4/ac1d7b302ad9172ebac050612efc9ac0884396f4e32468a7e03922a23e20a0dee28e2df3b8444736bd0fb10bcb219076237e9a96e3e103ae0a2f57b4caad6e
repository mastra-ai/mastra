/// <reference types="node" />
import { SecureClientSessionOptions } from "http2";
import { TLSSocket } from "tls";
import { HttpProtocols } from "./core";
import { AltNameMatch } from "./san";
export interface HttpsSocketResult {
    socket: TLSSocket;
    protocol: "http1" | "http2";
    altNameMatch: AltNameMatch;
}
export declare function connectTLS(host: string, port: string, protocols: ReadonlyArray<HttpProtocols>, connOpts: SecureClientSessionOptions): Promise<HttpsSocketResult>;
