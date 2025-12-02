/// <reference types="node" />
import * as net from 'net';
import { Logger } from './types';
import { Nfsv4Operations } from './operations/Nfsv4Operations';
export interface Nfsv4TcpServerOpts {
    ops: Nfsv4Operations;
    port?: number;
    host?: string;
    debug?: boolean;
    logger?: Logger;
    onError?: (err: Error) => void;
    stopOnSigint?: boolean;
}
export declare class Nfsv4TcpServer {
    static start(opts: Nfsv4TcpServerOpts): void;
    readonly server: net.Server;
    port: number;
    host: string;
    debug: boolean;
    logger: Logger;
    private sigintHandler?;
    constructor(opts: Nfsv4TcpServerOpts);
    private cleanup;
    stop(): Promise<void>;
    start(port?: number, host?: string): Promise<void>;
}
