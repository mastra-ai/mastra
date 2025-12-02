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
import { Table } from '../table.mjs';
import { isPromise } from '../util/compat.mjs';
import { RecordBatchReader } from './reader.mjs';
import { RecordBatchFileWriter, RecordBatchStreamWriter } from './writer.mjs';
export function tableFromIPC(input) {
    const reader = RecordBatchReader.from(input);
    if (isPromise(reader)) {
        return reader.then((reader) => tableFromIPC(reader));
    }
    if (reader.isAsync()) {
        return reader.readAll().then((xs) => new Table(xs));
    }
    return new Table(reader.readAll());
}
/**
 * Serialize a {@link Table} to the IPC format. This function is a convenience
 * wrapper for {@link RecordBatchStreamWriter} and {@link RecordBatchFileWriter}.
 * Opposite of {@link tableFromIPC}.
 *
 * @param table The Table to serialize.
 * @param type Whether to serialize the Table as a file or a stream.
 */
export function tableToIPC(table, type = 'stream') {
    return (type === 'stream' ? RecordBatchStreamWriter : RecordBatchFileWriter)
        .writeAll(table)
        .toUint8Array(true);
}

//# sourceMappingURL=serialization.mjs.map
