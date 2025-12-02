import type { DataFormat, InsertValues, ValuesEncoder } from '@clickhouse/client-common';
import Stream from 'stream';
export declare class NodeValuesEncoder implements ValuesEncoder<Stream.Readable> {
    encodeValues<T>(values: InsertValues<Stream.Readable, T>, format: DataFormat): string | Stream.Readable;
    validateInsertValues<T>(values: InsertValues<Stream.Readable, T>, format: DataFormat): void;
}
