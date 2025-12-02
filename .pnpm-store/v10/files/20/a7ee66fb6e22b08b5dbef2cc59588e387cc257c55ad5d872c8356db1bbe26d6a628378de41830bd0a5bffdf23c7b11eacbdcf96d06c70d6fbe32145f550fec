import { Data } from '../data.js';
import { Struct, TypeMap } from '../type.js';
/** @ignore */ declare const kParent: unique symbol;
/** @ignore */ declare const kRowIndex: unique symbol;
export type StructRowProxy<T extends TypeMap = any> = StructRow<T> & {
    [P in keyof T]: T[P]['TValue'];
} & {
    [key: symbol]: any;
};
export declare class StructRow<T extends TypeMap = any> {
    private [kRowIndex];
    private [kParent];
    constructor(parent: Data<Struct<T>>, rowIndex: number);
    toArray(): T[string]["TValue"][];
    toJSON(): { [P in string & keyof T]: T[P]["TValue"]; };
    toString(): string;
    [Symbol.iterator](): IterableIterator<[
        keyof T,
        {
            [P in keyof T]: T[P]['TValue'] | null;
        }[keyof T]
    ]>;
}
export {};
