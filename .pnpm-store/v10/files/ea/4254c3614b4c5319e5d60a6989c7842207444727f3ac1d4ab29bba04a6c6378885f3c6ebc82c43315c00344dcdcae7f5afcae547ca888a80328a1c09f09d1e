import { Vector } from '../vector.js';
import { IntBuilder } from './int.js';
import { Dictionary, DataType } from '../type.js';
import { Builder, BuilderOptions } from '../builder.js';
type DictionaryHashFunction = (x: any) => string | number;
export interface DictionaryBuilderOptions<T extends DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    dictionaryHashFunction?: DictionaryHashFunction;
}
/** @ignore */
export declare class DictionaryBuilder<T extends Dictionary, TNull = any> extends Builder<T, TNull> {
    protected _dictionaryOffset: number;
    protected _dictionary?: Vector<T['dictionary']>;
    protected _keysToIndices: {
        [key: string]: number;
    };
    readonly indices: IntBuilder<T['indices']>;
    readonly dictionary: Builder<T['dictionary']>;
    constructor({ 'type': type, 'nullValues': nulls, 'dictionaryHashFunction': hashFn }: DictionaryBuilderOptions<T, TNull>);
    get values(): T["indices"]["TArray"] | null;
    get nullCount(): number;
    get nullBitmap(): Uint8Array | null;
    get byteLength(): number;
    get reservedLength(): number;
    get reservedByteLength(): number;
    isValid(value: T['TValue'] | TNull): boolean;
    setValid(index: number, valid: boolean): boolean;
    setValue(index: number, value: T['TValue']): void;
    flush(): import("../data.js").Data<T>;
    finish(): this;
    clear(): this;
    valueToKey(val: any): string | number;
}
export {};
