// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

export { MessageHeader } from './fb/message-header.js';

export {
    Type,
    BufferType,
    DateUnit,
    TimeUnit,
    Precision,
    UnionMode,
    IntervalUnit,
    MetadataVersion,
} from './enum.js';

export { Data, makeData } from './data.js';
export type { TypeMap } from './type.js';
export {
    DataType,
    Null,
    Bool,
    Int, Int8, Int16, Int32, Int64, Uint8, Uint16, Uint32, Uint64,
    Float, Float16, Float32, Float64,
    Utf8, LargeUtf8,
    Binary, LargeBinary,
    FixedSizeBinary,
    Date_, DateDay, DateMillisecond,
    Timestamp, TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond,
    Time, TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond,
    Decimal,
    List,
    Struct,
    Union, DenseUnion, SparseUnion,
    Dictionary,
    Interval, IntervalDayTime, IntervalYearMonth,
    Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond,
    FixedSizeList,
    Map_
} from './type.js';

export { Table, makeTable, tableFromArrays } from './table.js';
export { Vector, makeVector } from './vector.js';
export { Visitor } from './visitor.js';
export { Schema, Field } from './schema.js';

export { MapRow } from './row/map.js';
export { StructRow } from './row/struct.js';
export type { StructRowProxy } from './row/struct.js';

export { Builder } from './builder.js';
export { makeBuilder, vectorFromArray, tableFromJSON, builderThroughIterable, builderThroughAsyncIterable } from './factories.js';
export type { BuilderOptions } from './builder.js';
export { BoolBuilder } from './builder/bool.js';
export { NullBuilder } from './builder/null.js';
export { DateBuilder, DateDayBuilder, DateMillisecondBuilder } from './builder/date.js';
export { DecimalBuilder } from './builder/decimal.js';
export { DictionaryBuilder } from './builder/dictionary.js';
export { FixedSizeBinaryBuilder } from './builder/fixedsizebinary.js';
export { FloatBuilder, Float16Builder, Float32Builder, Float64Builder } from './builder/float.js';
export { IntBuilder, Int8Builder, Int16Builder, Int32Builder, Int64Builder, Uint8Builder, Uint16Builder, Uint32Builder, Uint64Builder } from './builder/int.js';
export { TimeBuilder, TimeSecondBuilder, TimeMillisecondBuilder, TimeMicrosecondBuilder, TimeNanosecondBuilder } from './builder/time.js';
export { TimestampBuilder, TimestampSecondBuilder, TimestampMillisecondBuilder, TimestampMicrosecondBuilder, TimestampNanosecondBuilder } from './builder/timestamp.js';
export { IntervalBuilder, IntervalDayTimeBuilder, IntervalYearMonthBuilder } from './builder/interval.js';
export { DurationBuilder, DurationSecondBuilder, DurationMillisecondBuilder, DurationMicrosecondBuilder, DurationNanosecondBuilder } from './builder/duration.js';
export { Utf8Builder } from './builder/utf8.js';
export { LargeUtf8Builder } from './builder/largeutf8.js';
export { BinaryBuilder } from './builder/binary.js';
export { LargeBinaryBuilder } from './builder/largebinary.js';
export { ListBuilder } from './builder/list.js';
export { FixedSizeListBuilder } from './builder/fixedsizelist.js';
export { MapBuilder } from './builder/map.js';
export { StructBuilder } from './builder/struct.js';
export { UnionBuilder, SparseUnionBuilder, DenseUnionBuilder } from './builder/union.js';

export { ByteStream, AsyncByteStream, AsyncByteQueue } from './io/stream.js';
export type { ReadableSource, WritableSink } from './io/stream.js';
export { RecordBatchReader, RecordBatchFileReader, RecordBatchStreamReader, AsyncRecordBatchFileReader, AsyncRecordBatchStreamReader } from './ipc/reader.js';
export { RecordBatchWriter, RecordBatchFileWriter, RecordBatchStreamWriter, RecordBatchJSONWriter } from './ipc/writer.js';
export { tableToIPC, tableFromIPC } from './ipc/serialization.js';
export { MessageReader, AsyncMessageReader, JSONMessageReader } from './ipc/message.js';
export { Message } from './ipc/metadata/message.js';
export { RecordBatch } from './recordbatch.js';
export type { ArrowJSONLike, FileHandle, Readable, Writable, ReadableWritable, ReadableDOMStreamOptions } from './io/interfaces.js';

import * as util_bn_ from './util/bn.js';
import * as util_int_ from './util/int.js';
import * as util_bit_ from './util/bit.js';
import * as util_math_ from './util/math.js';
import * as util_buffer_ from './util/buffer.js';
import * as util_vector_ from './util/vector.js';
import * as util_pretty_ from './util/pretty.js';
import { compareSchemas, compareFields, compareTypes } from './visitor/typecomparator.js';

/** @ignore */
export const util = {
    ...util_bn_,
    ...util_int_,
    ...util_bit_,
    ...util_math_,
    ...util_buffer_,
    ...util_vector_,
    ...util_pretty_,
    compareSchemas,
    compareFields,
    compareTypes,
};
