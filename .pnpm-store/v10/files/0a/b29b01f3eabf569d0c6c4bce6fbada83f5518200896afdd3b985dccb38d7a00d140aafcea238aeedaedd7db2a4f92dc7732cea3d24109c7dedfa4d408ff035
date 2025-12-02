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
import { __awaiter } from "tslib";
import { AsyncByteQueue } from '../../io/stream.mjs';
import { RecordBatchReader } from '../../ipc/reader.mjs';
/** @ignore */
export function recordBatchReaderThroughDOMStream(writableStrategy, readableStrategy) {
    const queue = new AsyncByteQueue();
    let reader = null;
    const readable = new ReadableStream({
        cancel() {
            return __awaiter(this, void 0, void 0, function* () { yield queue.close(); });
        },
        start(controller) {
            return __awaiter(this, void 0, void 0, function* () { yield next(controller, reader || (reader = yield open())); });
        },
        pull(controller) {
            return __awaiter(this, void 0, void 0, function* () { reader ? yield next(controller, reader) : controller.close(); });
        }
    });
    return { writable: new WritableStream(queue, Object.assign({ 'highWaterMark': Math.pow(2, 14) }, writableStrategy)), readable };
    function open() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (yield RecordBatchReader.from(queue)).open(readableStrategy);
        });
    }
    function next(controller, reader) {
        return __awaiter(this, void 0, void 0, function* () {
            let size = controller.desiredSize;
            let r = null;
            while (!(r = yield reader.next()).done) {
                controller.enqueue(r.value);
                if (size != null && --size <= 0) {
                    return;
                }
            }
            controller.close();
        });
    }
}

//# sourceMappingURL=reader.mjs.map
