import type * as misc from 'memfs/lib/node/types/misc';
import { Nfsv4FType } from '../constants';
export declare class NfsFsDirent implements misc.IDirent {
    name: string;
    private type;
    constructor(name: string, type: Nfsv4FType);
    isDirectory(): boolean;
    isFile(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
}
