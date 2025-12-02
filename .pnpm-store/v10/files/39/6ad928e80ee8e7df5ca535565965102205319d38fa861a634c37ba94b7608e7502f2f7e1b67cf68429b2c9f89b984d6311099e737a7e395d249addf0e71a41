import { MetadataVersion } from './enum.js';
import { DataType, TypeMap } from './type.js';
export declare class Schema<T extends TypeMap = any> {
    readonly fields: Field<T[keyof T]>[];
    readonly metadata: Map<string, string>;
    readonly dictionaries: Map<number, DataType>;
    readonly metadataVersion: MetadataVersion;
    constructor(fields?: Field<T[keyof T]>[], metadata?: Map<string, string> | null, dictionaries?: Map<number, DataType> | null, metadataVersion?: MetadataVersion);
    get [Symbol.toStringTag](): string;
    get names(): (keyof T)[];
    toString(): string;
    /**
     * Construct a new Schema containing only specified fields.
     *
     * @param fieldNames Names of fields to keep.
     * @returns A new Schema of fields matching the specified names.
     */
    select<K extends keyof T = any>(fieldNames: K[]): Schema<{ [P in K]: T[P]; }>;
    /**
     * Construct a new Schema containing only fields at the specified indices.
     *
     * @param fieldIndices Indices of fields to keep.
     * @returns A new Schema of fields at the specified indices.
     */
    selectAt<K extends T = any>(fieldIndices: number[]): Schema<K>;
    assign<R extends TypeMap = any>(schema: Schema<R>): Schema<T & R>;
    assign<R extends TypeMap = any>(...fields: (Field<R[keyof R]> | Field<R[keyof R]>[])[]): Schema<T & R>;
}
export declare class Field<T extends DataType = any> {
    static new<T extends DataType = any>(props: {
        name: string | number;
        type: T;
        nullable?: boolean;
        metadata?: Map<string, string> | null;
    }): Field<T>;
    static new<T extends DataType = any>(name: string | number | Field<T>, type: T, nullable?: boolean, metadata?: Map<string, string> | null): Field<T>;
    readonly type: T;
    readonly name: string;
    readonly nullable: boolean;
    readonly metadata: Map<string, string>;
    constructor(name: string, type: T, nullable?: boolean, metadata?: Map<string, string> | null);
    get typeId(): import("./enum.js").Type;
    get [Symbol.toStringTag](): string;
    toString(): string;
    clone<R extends DataType = T>(props: {
        name?: string | number;
        type?: R;
        nullable?: boolean;
        metadata?: Map<string, string> | null;
    }): Field<R>;
    clone<R extends DataType = T>(name?: string | number | Field<T>, type?: R, nullable?: boolean, metadata?: Map<string, string> | null): Field<R>;
}
