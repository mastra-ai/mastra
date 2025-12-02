/// <reference types="node" />
import { Nfsv4Decoder } from '../Nfsv4Decoder';
import { Nfsv4FullEncoder } from '../Nfsv4FullEncoder';
import { RmRecordDecoder, RmRecordEncoder } from '../../../rm';
import { RpcCallMessage, RpcMessage, RpcMessageDecoder, RpcMessageEncoder } from '../../../rpc';
import type { Duplex } from 'node:stream';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/buffers/lib/types';
import type { Nfsv4Operations } from './operations/Nfsv4Operations';
export interface Nfsv4ConnectionOpts {
    duplex: Duplex;
    ops: Nfsv4Operations;
    encoder?: Nfsv4FullEncoder;
    decoder?: Nfsv4Decoder;
    debug?: boolean;
    logger?: Pick<typeof console, 'log' | 'error'>;
}
export declare class Nfsv4Connection {
    closed: boolean;
    maxIncomingMessage: number;
    maxBackpressure: number;
    protected lastXid: number;
    readonly duplex: Duplex;
    protected readonly rmDecoder: RmRecordDecoder;
    protected readonly rpcDecoder: RpcMessageDecoder;
    protected readonly nfsDecoder: Nfsv4Decoder;
    protected readonly writer: IWriter & IWriterGrowable;
    protected readonly rmEncoder: RmRecordEncoder;
    protected readonly rpcEncoder: RpcMessageEncoder;
    protected readonly nfsEncoder: Nfsv4FullEncoder;
    debug: boolean;
    logger: Pick<typeof console, 'log' | 'error'>;
    readonly ops: Nfsv4Operations;
    constructor(opts: Nfsv4ConnectionOpts);
    protected onData(data: Uint8Array): void;
    protected onRpcMessage(msg: RpcMessage): void;
    protected onRpcCallMessage(procedure: RpcCallMessage): void;
    private closeWithError;
    close(): void;
    private __uncorkTimer;
    write(buf: Uint8Array): void;
    send(): void;
}
