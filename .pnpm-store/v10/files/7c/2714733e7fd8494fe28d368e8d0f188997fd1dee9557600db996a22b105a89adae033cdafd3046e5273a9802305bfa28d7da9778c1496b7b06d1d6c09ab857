import { Data } from '../data.js';
import { Vector } from '../vector.js';
import { DataType, Struct } from '../type.js';
/** @ignore */ export declare const kKeys: unique symbol;
/** @ignore */ export declare const kVals: unique symbol;
/** @ignore */ export declare const kKeysAsStrings: unique symbol;
/** @ignore */ export declare const _kKeysAsStrings: unique symbol;
export declare class MapRow<K extends DataType = any, V extends DataType = any> {
    [key: string]: V['TValue'];
    private [kKeys];
    private [kVals];
    private [_kKeysAsStrings];
    constructor(slice: Data<Struct<{
        key: K;
        value: V;
    }>>);
    /** @ignore */
    get [kKeysAsStrings](): string[];
    [Symbol.iterator](): MapRowIterator<K, V>;
    get size(): number;
    toArray(): unknown[];
    toJSON(): { [P in K["TValue"]]: V["TValue"]; };
    toString(): string;
}
declare class MapRowIterator<K extends DataType = any, V extends DataType = any> implements IterableIterator<[K['TValue'], V['TValue'] | null]> {
    private keys;
    private vals;
    private numKeys;
    private keyIndex;
    constructor(keys: Vector<K>, vals: Data<V>);
    [Symbol.iterator](): this;
    next(): IteratorReturnResult<null> | {
        done: boolean;
        value: [K["TValue"], V["TValue"] | null];
    };
}
export {};
