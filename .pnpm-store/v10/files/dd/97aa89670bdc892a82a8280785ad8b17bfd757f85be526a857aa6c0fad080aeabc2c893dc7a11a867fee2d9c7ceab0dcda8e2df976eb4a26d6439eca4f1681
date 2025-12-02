/// <reference types="node" />
import type * as dns from 'dns';
export declare type LookupFunction = ((hostname: string, family: number, callback: LookupSimpleCallback) => void) & ((hostname: string, options: dns.LookupOneOptions, callback: LookupSimpleCallback) => void) & ((hostname: string, options: dns.LookupAllOptions, callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => void) & ((hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void) => void) & ((hostname: string, callback: LookupSimpleCallback) => void);
export declare type LookupSimpleArgs = [number, LookupSimpleCallback];
export declare type LookupOneArgs = [dns.LookupOneOptions, LookupSimpleCallback];
export declare type LookupAllArgs = [
    dns.LookupAllOptions,
    (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
];
export declare type LookupArgs = [
    dns.LookupOptions,
    (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void
];
export declare type LookupArgSignature = LookupSimpleArgs & LookupSimpleCallback & LookupOneArgs & LookupAllArgs & LookupArgs;
export declare type LookupFunctionSignature = (hostname: string, args: Array<LookupArgSignature>) => void;
export declare type LookupPromiseSignature = (hostname: string, ...args: unknown[]) => Promise<unknown>;
export declare type LookupSimpleCallback = (err: NodeJS.ErrnoException | null, address: string, family: number) => void;
export declare type LookupCallbackSignature = LookupSimpleCallback & ((err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) & ((err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void);
//# sourceMappingURL=internal-types.d.ts.map