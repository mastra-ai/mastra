import type { Reader } from '@jsonjoy.com/buffers/lib/Reader';
export declare class Nlm4Holder {
    readonly exclusive: boolean;
    readonly svid: number;
    readonly oh: Reader;
    readonly offset: bigint;
    readonly length: bigint;
    constructor(exclusive: boolean, svid: number, oh: Reader, offset: bigint, length: bigint);
}
export declare class Nlm4Lock {
    readonly callerName: string;
    readonly fh: Reader;
    readonly oh: Reader;
    readonly svid: number;
    readonly offset: bigint;
    readonly length: bigint;
    constructor(callerName: string, fh: Reader, oh: Reader, svid: number, offset: bigint, length: bigint);
}
export declare class Nlm4Share {
    readonly callerName: string;
    readonly fh: Reader;
    readonly oh: Reader;
    readonly mode: number;
    readonly access: number;
    constructor(callerName: string, fh: Reader, oh: Reader, mode: number, access: number);
}
export declare class Nlm4Notify {
    readonly name: string;
    readonly state: number;
    constructor(name: string, state: number);
}
