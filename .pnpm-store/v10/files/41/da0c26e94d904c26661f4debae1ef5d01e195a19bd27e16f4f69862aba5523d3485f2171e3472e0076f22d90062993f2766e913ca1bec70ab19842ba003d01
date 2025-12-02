import { Buffer } from "node:buffer";
import type { IncomingMessage, OutgoingHttpHeader, OutgoingHttpHeaders, ServerResponse } from "node:http";
import { FetchOutgoingMessage, DataWrittenEvent, OutgoingMessageOptions } from "./http-outgoing.js";
import { FetchIncomingMessage } from "./http-incoming.js";
import { kOutHeaders } from "./internal-http.js";
export declare const STATUS_CODES: Record<number, string>;
/**
 * This is an implementation of ServerResponse from Node.js intended to run in
 * a WinterTC runtime. The 'Writable' interface of this class is wired to an in-memory
 * buffer. This class also provides a method that creates a Response object that
 * can be handled by the runtime.
 *
 * This instance can be used in normal ways, but it does not give access to the
 * underlying socket (because there isn't one. req.socket will always return null).
 *
 * Some code in this class is transplanted/adapted from node/lib/_httpserver.js
 *
 * NOTE: Node.js doesn't really separate the body from headers, the entire "stream"
 * contains the headers and the body. So we provide functions that lets us pull
 * the headers and body out individually at a later time.
 */
export declare class FetchServerResponse extends FetchOutgoingMessage implements ServerResponse {
    static encoder: import("util").TextEncoder;
    statusCode: number;
    statusMessage: string;
    _sent100: boolean;
    _expect_continue: boolean;
    [kOutHeaders]: Record<string, any> | null;
    constructor(req: IncomingMessage, options?: OutgoingMessageOptions);
    dataFromDataWrittenEvent(e: DataWrittenEvent): Buffer | Uint8Array;
    _finish(): void;
    assignSocket(socket: any): void;
    detachSocket(socket: any): void;
    writeContinue(callback?: () => void): void;
    writeProcessing(callback?: () => void): void;
    writeEarlyHints(hints: Record<string, string | string[]>, callback?: () => void): void;
    _implicitHeader(): void;
    writeHead(statusCode: number, reason?: string | OutgoingHttpHeaders | OutgoingHttpHeader[], obj?: OutgoingHttpHeaders | OutgoingHttpHeader[]): this;
    writeHeader: (statusCode: number, reason?: string | OutgoingHttpHeaders | OutgoingHttpHeader[], obj?: OutgoingHttpHeaders | OutgoingHttpHeader[]) => this;
    fetchResponse: Promise<Response>;
    _toFetchResponse(status: number, statusText: string, sentHeaders: [header: string, value: string][], initialDataChunks: (Buffer | Uint8Array)[], finished: boolean): import("undici-types").Response;
}
export type ReqRes = {
    req: IncomingMessage;
    res: ServerResponse;
};
export type ToReqResOptions = {
    createIncomingMessage?: (ctx?: any) => FetchIncomingMessage;
    createServerResponse?: (incomingMessage: FetchIncomingMessage, ctx?: any) => FetchServerResponse;
    ctx?: any;
};
export declare function toReqRes(req: Request, options?: ToReqResOptions): ReqRes;
export declare function toFetchResponse(res: ServerResponse): Promise<Response>;
//# sourceMappingURL=http-server.d.ts.map