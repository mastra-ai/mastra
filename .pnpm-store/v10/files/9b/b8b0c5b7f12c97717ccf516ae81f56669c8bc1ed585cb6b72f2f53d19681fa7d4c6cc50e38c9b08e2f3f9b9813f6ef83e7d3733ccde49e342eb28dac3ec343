/// <reference types="node" />
import { ClientHttp2Session } from "http2";
export interface MonkeyH2Session extends ClientHttp2Session {
    __fetch_h2_destroyed?: boolean;
    __fetch_h2_goaway?: boolean;
    __fetch_h2_refcount: number;
}
export declare function hasGotGoaway(session: ClientHttp2Session): boolean;
export declare function setGotGoaway(session: ClientHttp2Session): void;
export declare function isDestroyed(session: ClientHttp2Session): boolean | undefined;
export declare function setDestroyed(session: ClientHttp2Session): void;
