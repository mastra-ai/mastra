import type * as msg from '../../messages';
import type * as struct from '../../structs';
export declare class ClientRecord {
    readonly principal: string;
    readonly verifier: Uint8Array;
    readonly clientIdString: Uint8Array;
    readonly callback: struct.Nfsv4CbClient;
    readonly callbackIdent: number;
    readonly setclientidConfirm: Uint8Array;
    cache: msg.Nfsv4SetclientidResponse | undefined;
    lastRenew: number;
    constructor(principal: string, verifier: Uint8Array, clientIdString: Uint8Array, callback: struct.Nfsv4CbClient, callbackIdent: number, setclientidConfirm: Uint8Array, cache?: msg.Nfsv4SetclientidResponse | undefined, lastRenew?: number);
}
