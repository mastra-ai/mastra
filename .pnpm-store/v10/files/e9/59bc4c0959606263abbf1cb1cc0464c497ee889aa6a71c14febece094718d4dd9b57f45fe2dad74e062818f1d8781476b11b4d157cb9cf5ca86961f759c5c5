import { XdrEncoder } from '../../xdr/XdrEncoder';
import * as msg from './messages';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class Nfsv4Encoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    readonly xdr: XdrEncoder;
    constructor(writer?: W);
    encodeCompound(compound: msg.Nfsv4CompoundRequest | msg.Nfsv4CompoundResponse, isRequest?: boolean): Uint8Array;
    writeCompound(compound: msg.Nfsv4CompoundRequest | msg.Nfsv4CompoundResponse, isRequest: boolean): void;
    encodeCbCompound(compound: msg.Nfsv4CbCompoundRequest | msg.Nfsv4CbCompoundResponse, isRequest?: boolean): Uint8Array;
    writeCbCompound(compound: msg.Nfsv4CbCompoundRequest | msg.Nfsv4CbCompoundResponse, isRequest: boolean): void;
}
