/// <reference types="node" />
import { RequestOptions } from "https";
import { Socket } from "net";
import { URL } from "url";
import { Http1Options } from "./core";
import { Request } from "./request";
export interface ConnectOptions {
    rejectUnauthorized: boolean | undefined;
    createConnection: () => Socket;
}
export interface SocketAndCleanup {
    socket: Socket;
    cleanup: () => void;
}
export interface FreeSocketInfoWithSocket extends SocketAndCleanup {
    shouldCreateNew: boolean;
}
export interface FreeSocketInfoWithoutSocket {
    socket: never;
    cleanup: never;
    shouldCreateNew: boolean;
}
export declare type FreeSocketInfo = FreeSocketInfoWithSocket | FreeSocketInfoWithoutSocket;
export declare class OriginPool {
    private usedSockets;
    private unusedSockets;
    private waiting;
    private keepAlive;
    private keepAliveMsecs;
    private maxSockets;
    private maxFreeSockets;
    private connOpts;
    constructor(keepAlive: boolean, keepAliveMsecs: number, maxSockets: number, maxFreeSockets: number, timeout: number | void);
    connect(options: RequestOptions): import("http").ClientRequest;
    addUsed(socket: Socket): () => void;
    getFreeSocket(): FreeSocketInfo;
    waitForSocket(): Promise<SocketAndCleanup>;
    disconnectAll(): Promise<void>;
    private getFirstUnused;
    private tryReuse;
    private pumpWaiting;
    private disconnectSocket;
    private makeCleaner;
    private moveToUnused;
    private moveToUsed;
}
export declare class H1Context {
    private contextPool;
    constructor(options: Partial<Http1Options>);
    getSessionForOrigin(origin: string): OriginPool;
    getFreeSocketForSession(session: OriginPool): FreeSocketInfo;
    addUsedSocket(session: OriginPool, socket: Socket): () => void;
    waitForSocketBySession(session: OriginPool): Promise<SocketAndCleanup>;
    connect(url: URL, extraOptions: ConnectOptions, request: Request): import("http").ClientRequest;
    makeNewConnection(url: string): Promise<Socket>;
    disconnect(url: string): void;
    disconnectAll(): void;
}
