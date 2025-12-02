/// <reference types="node" />
import { ErrorReply } from '../errors';
import { TypeMapping } from './types';
export declare const RESP_TYPES: {
    readonly NULL: 95;
    readonly BOOLEAN: 35;
    readonly NUMBER: 58;
    readonly BIG_NUMBER: 40;
    readonly DOUBLE: 44;
    readonly SIMPLE_STRING: 43;
    readonly BLOB_STRING: 36;
    readonly VERBATIM_STRING: 61;
    readonly SIMPLE_ERROR: 45;
    readonly BLOB_ERROR: 33;
    readonly ARRAY: 42;
    readonly SET: 126;
    readonly MAP: 37;
    readonly PUSH: 62;
};
export declare const PUSH_TYPE_MAPPING: {
    36: BufferConstructor;
};
interface DecoderOptions {
    onReply(reply: any): unknown;
    onErrorReply(err: ErrorReply): unknown;
    onPush(push: Array<any>): unknown;
    getTypeMapping(): TypeMapping;
}
export declare class Decoder {
    #private;
    onReply: (reply: any) => unknown;
    onErrorReply: (err: ErrorReply) => unknown;
    onPush: (push: any[]) => unknown;
    getTypeMapping: () => TypeMapping;
    constructor(config: DecoderOptions);
    reset(): void;
    write(chunk: any): void;
}
export {};
//# sourceMappingURL=decoder.d.ts.map