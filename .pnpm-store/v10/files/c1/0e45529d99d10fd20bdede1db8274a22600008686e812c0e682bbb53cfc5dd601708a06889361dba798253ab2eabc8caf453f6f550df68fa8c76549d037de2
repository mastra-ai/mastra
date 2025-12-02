"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Union = exports.StructRow = exports.Struct = exports.List = exports.Decimal = exports.TimeNanosecond = exports.TimeMicrosecond = exports.TimeMillisecond = exports.TimeSecond = exports.Time = exports.TimestampNanosecond = exports.TimestampMicrosecond = exports.TimestampMillisecond = exports.TimestampSecond = exports.Timestamp = exports.DateMillisecond = exports.DateDay = exports.Date_ = exports.FixedSizeBinary = exports.LargeBinary = exports.Binary = exports.LargeUtf8 = exports.Utf8 = exports.Float64 = exports.Float32 = exports.Float16 = exports.Float = exports.Uint64 = exports.Uint32 = exports.Uint16 = exports.Uint8 = exports.Int64 = exports.Int32 = exports.Int16 = exports.Int8 = exports.Int = exports.Bool = exports.Null = exports.DataType = exports.makeData = exports.Data = exports.BufferType = exports.UnionMode = exports.Type = exports.TimeUnit = exports.Precision = exports.MetadataVersion = exports.MessageHeader = exports.IntervalUnit = exports.DateUnit = void 0;
exports.LargeBinaryBuilder = exports.BinaryBuilder = exports.builderThroughAsyncIterable = exports.builderThroughIterable = exports.makeBuilder = exports.Builder = exports.util = exports.RecordBatch = exports.Message = exports.JSONMessageReader = exports.AsyncMessageReader = exports.MessageReader = exports.tableToIPC = exports.tableFromIPC = exports.RecordBatchJSONWriter = exports.RecordBatchStreamWriter = exports.RecordBatchFileWriter = exports.RecordBatchWriter = exports.AsyncRecordBatchStreamReader = exports.AsyncRecordBatchFileReader = exports.RecordBatchStreamReader = exports.RecordBatchFileReader = exports.RecordBatchReader = exports.AsyncByteQueue = exports.AsyncByteStream = exports.ByteStream = exports.tableFromJSON = exports.vectorFromArray = exports.makeVector = exports.Vector = exports.Visitor = exports.Field = exports.Schema = exports.tableFromArrays = exports.makeTable = exports.Table = exports.MapRow = exports.Map_ = exports.FixedSizeList = exports.DurationNanosecond = exports.DurationMicrosecond = exports.DurationMillisecond = exports.DurationSecond = exports.Duration = exports.IntervalYearMonth = exports.IntervalDayTime = exports.Interval = exports.Dictionary = exports.SparseUnion = exports.DenseUnion = void 0;
exports.LargeUtf8Builder = exports.Utf8Builder = exports.SparseUnionBuilder = exports.DenseUnionBuilder = exports.UnionBuilder = exports.TimeNanosecondBuilder = exports.TimeMicrosecondBuilder = exports.TimeMillisecondBuilder = exports.TimeSecondBuilder = exports.TimeBuilder = exports.TimestampNanosecondBuilder = exports.TimestampMicrosecondBuilder = exports.TimestampMillisecondBuilder = exports.TimestampSecondBuilder = exports.TimestampBuilder = exports.StructBuilder = exports.NullBuilder = exports.MapBuilder = exports.ListBuilder = exports.Uint64Builder = exports.Uint32Builder = exports.Uint16Builder = exports.Uint8Builder = exports.Int64Builder = exports.Int32Builder = exports.Int16Builder = exports.Int8Builder = exports.IntBuilder = exports.DurationNanosecondBuilder = exports.DurationMicrosecondBuilder = exports.DurationMillisecondBuilder = exports.DurationSecondBuilder = exports.DurationBuilder = exports.IntervalYearMonthBuilder = exports.IntervalDayTimeBuilder = exports.IntervalBuilder = exports.Float64Builder = exports.Float32Builder = exports.Float16Builder = exports.FloatBuilder = exports.FixedSizeListBuilder = exports.FixedSizeBinaryBuilder = exports.DictionaryBuilder = exports.DecimalBuilder = exports.DateMillisecondBuilder = exports.DateDayBuilder = exports.DateBuilder = exports.BoolBuilder = void 0;
const adapters_js_1 = require("./io/adapters.js");
const builder_js_1 = require("./builder.js");
const reader_js_1 = require("./ipc/reader.js");
const writer_js_1 = require("./ipc/writer.js");
const iterable_js_1 = require("./io/whatwg/iterable.js");
const builder_js_2 = require("./io/whatwg/builder.js");
const reader_js_2 = require("./io/whatwg/reader.js");
const writer_js_2 = require("./io/whatwg/writer.js");
adapters_js_1.default.toDOMStream = iterable_js_1.toDOMStream;
builder_js_1.Builder['throughDOM'] = builder_js_2.builderThroughDOMStream;
reader_js_1.RecordBatchReader['throughDOM'] = reader_js_2.recordBatchReaderThroughDOMStream;
reader_js_1.RecordBatchFileReader['throughDOM'] = reader_js_2.recordBatchReaderThroughDOMStream;
reader_js_1.RecordBatchStreamReader['throughDOM'] = reader_js_2.recordBatchReaderThroughDOMStream;
writer_js_1.RecordBatchWriter['throughDOM'] = writer_js_2.recordBatchWriterThroughDOMStream;
writer_js_1.RecordBatchFileWriter['throughDOM'] = writer_js_2.recordBatchWriterThroughDOMStream;
writer_js_1.RecordBatchStreamWriter['throughDOM'] = writer_js_2.recordBatchWriterThroughDOMStream;
var Arrow_js_1 = require("./Arrow.js");
Object.defineProperty(exports, "DateUnit", { enumerable: true, get: function () { return Arrow_js_1.DateUnit; } });
Object.defineProperty(exports, "IntervalUnit", { enumerable: true, get: function () { return Arrow_js_1.IntervalUnit; } });
Object.defineProperty(exports, "MessageHeader", { enumerable: true, get: function () { return Arrow_js_1.MessageHeader; } });
Object.defineProperty(exports, "MetadataVersion", { enumerable: true, get: function () { return Arrow_js_1.MetadataVersion; } });
Object.defineProperty(exports, "Precision", { enumerable: true, get: function () { return Arrow_js_1.Precision; } });
Object.defineProperty(exports, "TimeUnit", { enumerable: true, get: function () { return Arrow_js_1.TimeUnit; } });
Object.defineProperty(exports, "Type", { enumerable: true, get: function () { return Arrow_js_1.Type; } });
Object.defineProperty(exports, "UnionMode", { enumerable: true, get: function () { return Arrow_js_1.UnionMode; } });
Object.defineProperty(exports, "BufferType", { enumerable: true, get: function () { return Arrow_js_1.BufferType; } });
Object.defineProperty(exports, "Data", { enumerable: true, get: function () { return Arrow_js_1.Data; } });
Object.defineProperty(exports, "makeData", { enumerable: true, get: function () { return Arrow_js_1.makeData; } });
Object.defineProperty(exports, "DataType", { enumerable: true, get: function () { return Arrow_js_1.DataType; } });
Object.defineProperty(exports, "Null", { enumerable: true, get: function () { return Arrow_js_1.Null; } });
Object.defineProperty(exports, "Bool", { enumerable: true, get: function () { return Arrow_js_1.Bool; } });
Object.defineProperty(exports, "Int", { enumerable: true, get: function () { return Arrow_js_1.Int; } });
Object.defineProperty(exports, "Int8", { enumerable: true, get: function () { return Arrow_js_1.Int8; } });
Object.defineProperty(exports, "Int16", { enumerable: true, get: function () { return Arrow_js_1.Int16; } });
Object.defineProperty(exports, "Int32", { enumerable: true, get: function () { return Arrow_js_1.Int32; } });
Object.defineProperty(exports, "Int64", { enumerable: true, get: function () { return Arrow_js_1.Int64; } });
Object.defineProperty(exports, "Uint8", { enumerable: true, get: function () { return Arrow_js_1.Uint8; } });
Object.defineProperty(exports, "Uint16", { enumerable: true, get: function () { return Arrow_js_1.Uint16; } });
Object.defineProperty(exports, "Uint32", { enumerable: true, get: function () { return Arrow_js_1.Uint32; } });
Object.defineProperty(exports, "Uint64", { enumerable: true, get: function () { return Arrow_js_1.Uint64; } });
Object.defineProperty(exports, "Float", { enumerable: true, get: function () { return Arrow_js_1.Float; } });
Object.defineProperty(exports, "Float16", { enumerable: true, get: function () { return Arrow_js_1.Float16; } });
Object.defineProperty(exports, "Float32", { enumerable: true, get: function () { return Arrow_js_1.Float32; } });
Object.defineProperty(exports, "Float64", { enumerable: true, get: function () { return Arrow_js_1.Float64; } });
Object.defineProperty(exports, "Utf8", { enumerable: true, get: function () { return Arrow_js_1.Utf8; } });
Object.defineProperty(exports, "LargeUtf8", { enumerable: true, get: function () { return Arrow_js_1.LargeUtf8; } });
Object.defineProperty(exports, "Binary", { enumerable: true, get: function () { return Arrow_js_1.Binary; } });
Object.defineProperty(exports, "LargeBinary", { enumerable: true, get: function () { return Arrow_js_1.LargeBinary; } });
Object.defineProperty(exports, "FixedSizeBinary", { enumerable: true, get: function () { return Arrow_js_1.FixedSizeBinary; } });
Object.defineProperty(exports, "Date_", { enumerable: true, get: function () { return Arrow_js_1.Date_; } });
Object.defineProperty(exports, "DateDay", { enumerable: true, get: function () { return Arrow_js_1.DateDay; } });
Object.defineProperty(exports, "DateMillisecond", { enumerable: true, get: function () { return Arrow_js_1.DateMillisecond; } });
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return Arrow_js_1.Timestamp; } });
Object.defineProperty(exports, "TimestampSecond", { enumerable: true, get: function () { return Arrow_js_1.TimestampSecond; } });
Object.defineProperty(exports, "TimestampMillisecond", { enumerable: true, get: function () { return Arrow_js_1.TimestampMillisecond; } });
Object.defineProperty(exports, "TimestampMicrosecond", { enumerable: true, get: function () { return Arrow_js_1.TimestampMicrosecond; } });
Object.defineProperty(exports, "TimestampNanosecond", { enumerable: true, get: function () { return Arrow_js_1.TimestampNanosecond; } });
Object.defineProperty(exports, "Time", { enumerable: true, get: function () { return Arrow_js_1.Time; } });
Object.defineProperty(exports, "TimeSecond", { enumerable: true, get: function () { return Arrow_js_1.TimeSecond; } });
Object.defineProperty(exports, "TimeMillisecond", { enumerable: true, get: function () { return Arrow_js_1.TimeMillisecond; } });
Object.defineProperty(exports, "TimeMicrosecond", { enumerable: true, get: function () { return Arrow_js_1.TimeMicrosecond; } });
Object.defineProperty(exports, "TimeNanosecond", { enumerable: true, get: function () { return Arrow_js_1.TimeNanosecond; } });
Object.defineProperty(exports, "Decimal", { enumerable: true, get: function () { return Arrow_js_1.Decimal; } });
Object.defineProperty(exports, "List", { enumerable: true, get: function () { return Arrow_js_1.List; } });
Object.defineProperty(exports, "Struct", { enumerable: true, get: function () { return Arrow_js_1.Struct; } });
Object.defineProperty(exports, "StructRow", { enumerable: true, get: function () { return Arrow_js_1.StructRow; } });
Object.defineProperty(exports, "Union", { enumerable: true, get: function () { return Arrow_js_1.Union; } });
Object.defineProperty(exports, "DenseUnion", { enumerable: true, get: function () { return Arrow_js_1.DenseUnion; } });
Object.defineProperty(exports, "SparseUnion", { enumerable: true, get: function () { return Arrow_js_1.SparseUnion; } });
Object.defineProperty(exports, "Dictionary", { enumerable: true, get: function () { return Arrow_js_1.Dictionary; } });
Object.defineProperty(exports, "Interval", { enumerable: true, get: function () { return Arrow_js_1.Interval; } });
Object.defineProperty(exports, "IntervalDayTime", { enumerable: true, get: function () { return Arrow_js_1.IntervalDayTime; } });
Object.defineProperty(exports, "IntervalYearMonth", { enumerable: true, get: function () { return Arrow_js_1.IntervalYearMonth; } });
Object.defineProperty(exports, "Duration", { enumerable: true, get: function () { return Arrow_js_1.Duration; } });
Object.defineProperty(exports, "DurationSecond", { enumerable: true, get: function () { return Arrow_js_1.DurationSecond; } });
Object.defineProperty(exports, "DurationMillisecond", { enumerable: true, get: function () { return Arrow_js_1.DurationMillisecond; } });
Object.defineProperty(exports, "DurationMicrosecond", { enumerable: true, get: function () { return Arrow_js_1.DurationMicrosecond; } });
Object.defineProperty(exports, "DurationNanosecond", { enumerable: true, get: function () { return Arrow_js_1.DurationNanosecond; } });
Object.defineProperty(exports, "FixedSizeList", { enumerable: true, get: function () { return Arrow_js_1.FixedSizeList; } });
Object.defineProperty(exports, "Map_", { enumerable: true, get: function () { return Arrow_js_1.Map_; } });
Object.defineProperty(exports, "MapRow", { enumerable: true, get: function () { return Arrow_js_1.MapRow; } });
Object.defineProperty(exports, "Table", { enumerable: true, get: function () { return Arrow_js_1.Table; } });
Object.defineProperty(exports, "makeTable", { enumerable: true, get: function () { return Arrow_js_1.makeTable; } });
Object.defineProperty(exports, "tableFromArrays", { enumerable: true, get: function () { return Arrow_js_1.tableFromArrays; } });
Object.defineProperty(exports, "Schema", { enumerable: true, get: function () { return Arrow_js_1.Schema; } });
Object.defineProperty(exports, "Field", { enumerable: true, get: function () { return Arrow_js_1.Field; } });
Object.defineProperty(exports, "Visitor", { enumerable: true, get: function () { return Arrow_js_1.Visitor; } });
Object.defineProperty(exports, "Vector", { enumerable: true, get: function () { return Arrow_js_1.Vector; } });
Object.defineProperty(exports, "makeVector", { enumerable: true, get: function () { return Arrow_js_1.makeVector; } });
Object.defineProperty(exports, "vectorFromArray", { enumerable: true, get: function () { return Arrow_js_1.vectorFromArray; } });
Object.defineProperty(exports, "tableFromJSON", { enumerable: true, get: function () { return Arrow_js_1.tableFromJSON; } });
Object.defineProperty(exports, "ByteStream", { enumerable: true, get: function () { return Arrow_js_1.ByteStream; } });
Object.defineProperty(exports, "AsyncByteStream", { enumerable: true, get: function () { return Arrow_js_1.AsyncByteStream; } });
Object.defineProperty(exports, "AsyncByteQueue", { enumerable: true, get: function () { return Arrow_js_1.AsyncByteQueue; } });
Object.defineProperty(exports, "RecordBatchReader", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchReader; } });
Object.defineProperty(exports, "RecordBatchFileReader", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchFileReader; } });
Object.defineProperty(exports, "RecordBatchStreamReader", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchStreamReader; } });
Object.defineProperty(exports, "AsyncRecordBatchFileReader", { enumerable: true, get: function () { return Arrow_js_1.AsyncRecordBatchFileReader; } });
Object.defineProperty(exports, "AsyncRecordBatchStreamReader", { enumerable: true, get: function () { return Arrow_js_1.AsyncRecordBatchStreamReader; } });
Object.defineProperty(exports, "RecordBatchWriter", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchWriter; } });
Object.defineProperty(exports, "RecordBatchFileWriter", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchFileWriter; } });
Object.defineProperty(exports, "RecordBatchStreamWriter", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchStreamWriter; } });
Object.defineProperty(exports, "RecordBatchJSONWriter", { enumerable: true, get: function () { return Arrow_js_1.RecordBatchJSONWriter; } });
Object.defineProperty(exports, "tableFromIPC", { enumerable: true, get: function () { return Arrow_js_1.tableFromIPC; } });
Object.defineProperty(exports, "tableToIPC", { enumerable: true, get: function () { return Arrow_js_1.tableToIPC; } });
Object.defineProperty(exports, "MessageReader", { enumerable: true, get: function () { return Arrow_js_1.MessageReader; } });
Object.defineProperty(exports, "AsyncMessageReader", { enumerable: true, get: function () { return Arrow_js_1.AsyncMessageReader; } });
Object.defineProperty(exports, "JSONMessageReader", { enumerable: true, get: function () { return Arrow_js_1.JSONMessageReader; } });
Object.defineProperty(exports, "Message", { enumerable: true, get: function () { return Arrow_js_1.Message; } });
Object.defineProperty(exports, "RecordBatch", { enumerable: true, get: function () { return Arrow_js_1.RecordBatch; } });
Object.defineProperty(exports, "util", { enumerable: true, get: function () { return Arrow_js_1.util; } });
Object.defineProperty(exports, "Builder", { enumerable: true, get: function () { return Arrow_js_1.Builder; } });
Object.defineProperty(exports, "makeBuilder", { enumerable: true, get: function () { return Arrow_js_1.makeBuilder; } });
Object.defineProperty(exports, "builderThroughIterable", { enumerable: true, get: function () { return Arrow_js_1.builderThroughIterable; } });
Object.defineProperty(exports, "builderThroughAsyncIterable", { enumerable: true, get: function () { return Arrow_js_1.builderThroughAsyncIterable; } });
var Arrow_js_2 = require("./Arrow.js");
Object.defineProperty(exports, "BinaryBuilder", { enumerable: true, get: function () { return Arrow_js_2.BinaryBuilder; } });
Object.defineProperty(exports, "LargeBinaryBuilder", { enumerable: true, get: function () { return Arrow_js_2.LargeBinaryBuilder; } });
Object.defineProperty(exports, "BoolBuilder", { enumerable: true, get: function () { return Arrow_js_2.BoolBuilder; } });
Object.defineProperty(exports, "DateBuilder", { enumerable: true, get: function () { return Arrow_js_2.DateBuilder; } });
Object.defineProperty(exports, "DateDayBuilder", { enumerable: true, get: function () { return Arrow_js_2.DateDayBuilder; } });
Object.defineProperty(exports, "DateMillisecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.DateMillisecondBuilder; } });
Object.defineProperty(exports, "DecimalBuilder", { enumerable: true, get: function () { return Arrow_js_2.DecimalBuilder; } });
Object.defineProperty(exports, "DictionaryBuilder", { enumerable: true, get: function () { return Arrow_js_2.DictionaryBuilder; } });
Object.defineProperty(exports, "FixedSizeBinaryBuilder", { enumerable: true, get: function () { return Arrow_js_2.FixedSizeBinaryBuilder; } });
Object.defineProperty(exports, "FixedSizeListBuilder", { enumerable: true, get: function () { return Arrow_js_2.FixedSizeListBuilder; } });
Object.defineProperty(exports, "FloatBuilder", { enumerable: true, get: function () { return Arrow_js_2.FloatBuilder; } });
Object.defineProperty(exports, "Float16Builder", { enumerable: true, get: function () { return Arrow_js_2.Float16Builder; } });
Object.defineProperty(exports, "Float32Builder", { enumerable: true, get: function () { return Arrow_js_2.Float32Builder; } });
Object.defineProperty(exports, "Float64Builder", { enumerable: true, get: function () { return Arrow_js_2.Float64Builder; } });
Object.defineProperty(exports, "IntervalBuilder", { enumerable: true, get: function () { return Arrow_js_2.IntervalBuilder; } });
Object.defineProperty(exports, "IntervalDayTimeBuilder", { enumerable: true, get: function () { return Arrow_js_2.IntervalDayTimeBuilder; } });
Object.defineProperty(exports, "IntervalYearMonthBuilder", { enumerable: true, get: function () { return Arrow_js_2.IntervalYearMonthBuilder; } });
Object.defineProperty(exports, "DurationBuilder", { enumerable: true, get: function () { return Arrow_js_2.DurationBuilder; } });
Object.defineProperty(exports, "DurationSecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.DurationSecondBuilder; } });
Object.defineProperty(exports, "DurationMillisecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.DurationMillisecondBuilder; } });
Object.defineProperty(exports, "DurationMicrosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.DurationMicrosecondBuilder; } });
Object.defineProperty(exports, "DurationNanosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.DurationNanosecondBuilder; } });
Object.defineProperty(exports, "IntBuilder", { enumerable: true, get: function () { return Arrow_js_2.IntBuilder; } });
Object.defineProperty(exports, "Int8Builder", { enumerable: true, get: function () { return Arrow_js_2.Int8Builder; } });
Object.defineProperty(exports, "Int16Builder", { enumerable: true, get: function () { return Arrow_js_2.Int16Builder; } });
Object.defineProperty(exports, "Int32Builder", { enumerable: true, get: function () { return Arrow_js_2.Int32Builder; } });
Object.defineProperty(exports, "Int64Builder", { enumerable: true, get: function () { return Arrow_js_2.Int64Builder; } });
Object.defineProperty(exports, "Uint8Builder", { enumerable: true, get: function () { return Arrow_js_2.Uint8Builder; } });
Object.defineProperty(exports, "Uint16Builder", { enumerable: true, get: function () { return Arrow_js_2.Uint16Builder; } });
Object.defineProperty(exports, "Uint32Builder", { enumerable: true, get: function () { return Arrow_js_2.Uint32Builder; } });
Object.defineProperty(exports, "Uint64Builder", { enumerable: true, get: function () { return Arrow_js_2.Uint64Builder; } });
Object.defineProperty(exports, "ListBuilder", { enumerable: true, get: function () { return Arrow_js_2.ListBuilder; } });
Object.defineProperty(exports, "MapBuilder", { enumerable: true, get: function () { return Arrow_js_2.MapBuilder; } });
Object.defineProperty(exports, "NullBuilder", { enumerable: true, get: function () { return Arrow_js_2.NullBuilder; } });
Object.defineProperty(exports, "StructBuilder", { enumerable: true, get: function () { return Arrow_js_2.StructBuilder; } });
Object.defineProperty(exports, "TimestampBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimestampBuilder; } });
Object.defineProperty(exports, "TimestampSecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimestampSecondBuilder; } });
Object.defineProperty(exports, "TimestampMillisecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimestampMillisecondBuilder; } });
Object.defineProperty(exports, "TimestampMicrosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimestampMicrosecondBuilder; } });
Object.defineProperty(exports, "TimestampNanosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimestampNanosecondBuilder; } });
Object.defineProperty(exports, "TimeBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimeBuilder; } });
Object.defineProperty(exports, "TimeSecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimeSecondBuilder; } });
Object.defineProperty(exports, "TimeMillisecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimeMillisecondBuilder; } });
Object.defineProperty(exports, "TimeMicrosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimeMicrosecondBuilder; } });
Object.defineProperty(exports, "TimeNanosecondBuilder", { enumerable: true, get: function () { return Arrow_js_2.TimeNanosecondBuilder; } });
Object.defineProperty(exports, "UnionBuilder", { enumerable: true, get: function () { return Arrow_js_2.UnionBuilder; } });
Object.defineProperty(exports, "DenseUnionBuilder", { enumerable: true, get: function () { return Arrow_js_2.DenseUnionBuilder; } });
Object.defineProperty(exports, "SparseUnionBuilder", { enumerable: true, get: function () { return Arrow_js_2.SparseUnionBuilder; } });
Object.defineProperty(exports, "Utf8Builder", { enumerable: true, get: function () { return Arrow_js_2.Utf8Builder; } });
Object.defineProperty(exports, "LargeUtf8Builder", { enumerable: true, get: function () { return Arrow_js_2.LargeUtf8Builder; } });

//# sourceMappingURL=Arrow.dom.js.map
