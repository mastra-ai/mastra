/// <reference types="node" />
import * as stream from 'node:stream';
import { Nfsv4CompoundRequest, Nfsv4CompoundResponse, Nfsv4Request } from '../messages';
import type { Nfsv4Client } from './types';
export interface Nfsv4TcpClientOpts {
    host?: string;
    port?: number;
    timeout?: number;
    debug?: boolean;
    logger?: Pick<typeof console, 'log' | 'error'>;
}
export declare class Nfsv4TcpClient implements Nfsv4Client {
    static fromDuplex(duplex: stream.Duplex, opts?: Nfsv4TcpClientOpts): Nfsv4TcpClient;
    readonly host: string;
    readonly port: number;
    readonly timeout: number;
    debug: boolean;
    logger: Pick<typeof console, 'log' | 'error'>;
    private socket;
    private connected;
    private connecting;
    private xid;
    private seqid;
    private pendingRequests;
    private readonly rmDecoder;
    private readonly rpcDecoder;
    private readonly nfsDecoder;
    private readonly nfsEncoder;
    constructor(opts?: Nfsv4TcpClientOpts);
    private nextXid;
    connect(): Promise<void>;
    protected setSocket(socket: stream.Duplex): void;
    private onData;
    private onRpcMessage;
    private onClose;
    compound(request: Nfsv4CompoundRequest): Promise<Nfsv4CompoundResponse>;
    compound(operations: Nfsv4Request[], tag?: string, minorversion?: number): Promise<Nfsv4CompoundResponse>;
    null(): Promise<void>;
    close(): void;
    isConnected(): boolean;
}
