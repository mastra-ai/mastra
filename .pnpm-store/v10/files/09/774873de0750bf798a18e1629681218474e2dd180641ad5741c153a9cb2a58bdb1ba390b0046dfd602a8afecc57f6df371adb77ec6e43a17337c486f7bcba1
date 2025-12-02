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

import streamAdapters from './io/adapters.js';
import { Builder } from './builder.js';
import { RecordBatchReader, RecordBatchFileReader, RecordBatchStreamReader, } from './ipc/reader.js';
import { RecordBatchWriter, RecordBatchFileWriter, RecordBatchStreamWriter, } from './ipc/writer.js';
import { toDOMStream } from './io/whatwg/iterable.js';
import { builderThroughDOMStream } from './io/whatwg/builder.js';
import { recordBatchReaderThroughDOMStream } from './io/whatwg/reader.js';
import { recordBatchWriterThroughDOMStream } from './io/whatwg/writer.js';

streamAdapters.toDOMStream = toDOMStream;
Builder['throughDOM'] = builderThroughDOMStream;
RecordBatchReader['throughDOM'] = recordBatchReaderThroughDOMStream;
RecordBatchFileReader['throughDOM'] = recordBatchReaderThroughDOMStream;
RecordBatchStreamReader['throughDOM'] = recordBatchReaderThroughDOMStream;
RecordBatchWriter['throughDOM'] = recordBatchWriterThroughDOMStream;
RecordBatchFileWriter['throughDOM'] = recordBatchWriterThroughDOMStream;
RecordBatchStreamWriter['throughDOM'] = recordBatchWriterThroughDOMStream;

export type {
    TypeMap, StructRowProxy,
    ReadableSource, WritableSink,
    ArrowJSONLike, FileHandle, Readable, Writable, ReadableWritable, ReadableDOMStreamOptions,
} from './Arrow.js';

export {
    DateUnit, IntervalUnit, MessageHeader, MetadataVersion, Precision, TimeUnit, Type, UnionMode, BufferType,
    Data, makeData,
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
    Struct, StructRow,
    Union, DenseUnion, SparseUnion,
    Dictionary,
    Interval, IntervalDayTime, IntervalYearMonth,
    Duration, DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond,
    FixedSizeList,
    Map_, MapRow,
    Table, makeTable, tableFromArrays,
    Schema, Field,
    Visitor,
    Vector, makeVector, vectorFromArray, tableFromJSON,
    ByteStream, AsyncByteStream, AsyncByteQueue,
    RecordBatchReader, RecordBatchFileReader, RecordBatchStreamReader, AsyncRecordBatchFileReader, AsyncRecordBatchStreamReader,
    RecordBatchWriter, RecordBatchFileWriter, RecordBatchStreamWriter, RecordBatchJSONWriter,
    tableFromIPC, tableToIPC,
    MessageReader, AsyncMessageReader, JSONMessageReader,
    Message,
    RecordBatch,
    util,
    Builder, makeBuilder, builderThroughIterable, builderThroughAsyncIterable,
} from './Arrow.js';

export {
    BinaryBuilder, LargeBinaryBuilder,
    BoolBuilder,
    DateBuilder, DateDayBuilder, DateMillisecondBuilder,
    DecimalBuilder,
    DictionaryBuilder,
    FixedSizeBinaryBuilder,
    FixedSizeListBuilder,
    FloatBuilder, Float16Builder, Float32Builder, Float64Builder,
    IntervalBuilder, IntervalDayTimeBuilder, IntervalYearMonthBuilder,
    DurationBuilder, DurationSecondBuilder, DurationMillisecondBuilder, DurationMicrosecondBuilder, DurationNanosecondBuilder,
    IntBuilder, Int8Builder, Int16Builder, Int32Builder, Int64Builder, Uint8Builder, Uint16Builder, Uint32Builder, Uint64Builder,
    ListBuilder,
    MapBuilder,
    NullBuilder,
    StructBuilder,
    TimestampBuilder, TimestampSecondBuilder, TimestampMillisecondBuilder, TimestampMicrosecondBuilder, TimestampNanosecondBuilder,
    TimeBuilder, TimeSecondBuilder, TimeMillisecondBuilder, TimeMicrosecondBuilder, TimeNanosecondBuilder,
    UnionBuilder, DenseUnionBuilder, SparseUnionBuilder,
    Utf8Builder, LargeUtf8Builder
} from './Arrow.js';
