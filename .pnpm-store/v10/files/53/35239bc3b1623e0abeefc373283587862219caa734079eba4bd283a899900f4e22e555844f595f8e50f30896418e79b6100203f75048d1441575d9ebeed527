import { Table } from '../table.js';
import { TypeMap } from '../type.js';
import { FromArg0, FromArg1, FromArg2, FromArg3, FromArg4, FromArg5, RecordBatchReader, RecordBatchFileReader, RecordBatchStreamReader, AsyncRecordBatchFileReader, AsyncRecordBatchStreamReader } from './reader.js';
type RecordBatchReaders<T extends TypeMap = any> = RecordBatchFileReader<T> | RecordBatchStreamReader<T>;
type AsyncRecordBatchReaders<T extends TypeMap = any> = AsyncRecordBatchFileReader<T> | AsyncRecordBatchStreamReader<T>;
/**
 * Deserialize the IPC format into a {@link Table}. This function is a
 * convenience wrapper for {@link RecordBatchReader}. Opposite of {@link tableToIPC}.
 */
export declare function tableFromIPC<T extends TypeMap = any>(source: FromArg0 | FromArg2): Table<T>;
export declare function tableFromIPC<T extends TypeMap = any>(source: FromArg1): Promise<Table<T>>;
export declare function tableFromIPC<T extends TypeMap = any>(source: FromArg3 | FromArg4 | FromArg5): Promise<Table<T>>;
export declare function tableFromIPC<T extends TypeMap = any>(source: RecordBatchReaders<T>): Table<T>;
export declare function tableFromIPC<T extends TypeMap = any>(source: AsyncRecordBatchReaders<T>): Promise<Table<T>>;
export declare function tableFromIPC<T extends TypeMap = any>(source: RecordBatchReader<T>): Table<T> | Promise<Table<T>>;
/**
 * Serialize a {@link Table} to the IPC format. This function is a convenience
 * wrapper for {@link RecordBatchStreamWriter} and {@link RecordBatchFileWriter}.
 * Opposite of {@link tableFromIPC}.
 *
 * @param table The Table to serialize.
 * @param type Whether to serialize the Table as a file or a stream.
 */
export declare function tableToIPC<T extends TypeMap = any>(table: Table, type?: 'file' | 'stream'): Uint8Array;
export {};
