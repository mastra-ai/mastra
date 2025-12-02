import { DictionaryBatch } from './dictionary-batch.js';
import { RecordBatch } from './record-batch.js';
import { Schema } from './schema.js';
import { SparseTensor } from './sparse-tensor.js';
import { Tensor } from './tensor.js';
/**
 * ----------------------------------------------------------------------
 * The root Message type
 * This union enables us to easily send different message types without
 * redundant storage, and in the future we can easily add new message types.
 *
 * Arrow implementations do not need to implement all of the message types,
 * which may include experimental metadata types. For maximum compatibility,
 * it is best to send data using RecordBatch
 */
export declare enum MessageHeader {
    NONE = 0,
    Schema = 1,
    DictionaryBatch = 2,
    RecordBatch = 3,
    Tensor = 4,
    SparseTensor = 5
}
export declare function unionToMessageHeader(type: MessageHeader, accessor: (obj: DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor) => DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor | null): DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor | null;
export declare function unionListToMessageHeader(type: MessageHeader, accessor: (index: number, obj: DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor) => DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor | null, index: number): DictionaryBatch | RecordBatch | Schema | SparseTensor | Tensor | null;
