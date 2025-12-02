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

import { TypeMap } from '../../type.js';
import { RecordBatch } from '../../recordbatch.js';
import { AsyncByteQueue } from '../../io/stream.js';
import { RecordBatchReader } from '../../ipc/reader.js';

/** @ignore */
export function recordBatchReaderThroughDOMStream<T extends TypeMap = any>(writableStrategy?: ByteLengthQueuingStrategy, readableStrategy?: { autoDestroy: boolean }) {

    const queue = new AsyncByteQueue();
    let reader: RecordBatchReader<T> | null = null;

    const readable = new ReadableStream<RecordBatch<T>>({
        async cancel() { await queue.close(); },
        async start(controller) { await next(controller, reader || (reader = await open())); },
        async pull(controller) { reader ? await next(controller, reader) : controller.close(); }
    });

    return { writable: new WritableStream(queue, { 'highWaterMark': 2 ** 14, ...writableStrategy }), readable };

    async function open() {
        return await (await RecordBatchReader.from<T>(queue)).open(readableStrategy);
    }

    async function next(controller: ReadableStreamDefaultController<RecordBatch<T>>, reader: RecordBatchReader<T>) {
        let size = controller.desiredSize;
        let r: IteratorResult<RecordBatch<T>> | null = null;
        while (!(r = await reader.next()).done) {
            controller.enqueue(r!.value);
            if (size != null && --size <= 0) {
                return;
            }
        }
        controller.close();
    }
}
