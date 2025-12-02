import { Nfsv4Connection } from './Nfsv4Connection';
import * as msg from '../messages';
export declare class Nfsv4CompoundProcCtx {
    readonly connection: Nfsv4Connection;
    readonly req: msg.Nfsv4CompoundRequest;
    cfh: Uint8Array | null;
    sfh: Uint8Array | null;
    constructor(connection: Nfsv4Connection, req: msg.Nfsv4CompoundRequest);
    getPrincipal(): string;
    exec(): Promise<msg.Nfsv4CompoundResponse>;
}
