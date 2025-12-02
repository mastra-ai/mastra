/// <reference types="node" />
import { ClientHttp2Session, SecureClientSessionOptions } from "http2";
import { Decoder } from "./core";
import { Request } from "./request";
import { Response } from "./response";
interface H2SessionItem {
    firstOrigin: string;
    session: ClientHttp2Session;
    promise: Promise<ClientHttp2Session>;
    ref: () => void;
    unref: () => void;
}
export interface CacheableH2Session {
    ref: () => void;
    session: Promise<ClientHttp2Session>;
    unref: () => void;
}
export declare type PushHandler = (origin: string, request: Request, getResponse: () => Promise<Response>) => void;
export declare type GetDecoders = (origin: string) => ReadonlyArray<Decoder>;
export declare type GetSessionOptions = (origin: string) => SecureClientSessionOptions;
export declare class H2Context {
    _pushHandler?: PushHandler;
    private _h2sessions;
    private _h2staleSessions;
    private _getDecoders;
    private _getSessionOptions;
    constructor(getDecoders: GetDecoders, getSessionOptions: GetSessionOptions);
    createHttp2(origin: string, onGotGoaway: () => void, extraOptions?: SecureClientSessionOptions): CacheableH2Session;
    disconnectSession(session: ClientHttp2Session): Promise<void>;
    releaseSession(origin: string): void;
    deleteActiveSession(origin: string): H2SessionItem | void;
    disconnectStaleSessions(origin: string): Promise<void>;
    disconnectAll(): Promise<void>;
    disconnect(url: string, session?: ClientHttp2Session): Promise<void>;
    private handleDisconnect;
    private handlePush;
    private connectHttp2;
}
export {};
