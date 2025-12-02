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
const tslib_1 = require("tslib");
const buffer_js_1 = require("../util/buffer.js");
/** @ignore */
exports.default = {
    fromIterable(source) {
        return pump(fromIterable(source));
    },
    fromAsyncIterable(source) {
        return pump(fromAsyncIterable(source));
    },
    fromDOMStream(source) {
        return pump(fromDOMStream(source));
    },
    fromNodeStream(stream) {
        return pump(fromNodeStream(stream));
    },
    // @ts-ignore
    toDOMStream(source, options) {
        throw new Error(`"toDOMStream" not available in this environment`);
    },
    // @ts-ignore
    toNodeStream(source, options) {
        throw new Error(`"toNodeStream" not available in this environment`);
    },
};
/** @ignore */
const pump = (iterator) => { iterator.next(); return iterator; };
/** @ignore */
function* fromIterable(source) {
    let done, threw = false;
    let buffers = [], buffer;
    let cmd, size, bufferLength = 0;
    function byteRange() {
        if (cmd === 'peek') {
            return (0, buffer_js_1.joinUint8Arrays)(buffers, size)[0];
        }
        [buffer, buffers, bufferLength] = (0, buffer_js_1.joinUint8Arrays)(buffers, size);
        return buffer;
    }
    // Yield so the caller can inject the read command before creating the source Iterator
    ({ cmd, size } = (yield (() => null)()) || { cmd: 'read', size: 0 });
    // initialize the iterator
    const it = (0, buffer_js_1.toUint8ArrayIterator)(source)[Symbol.iterator]();
    try {
        do {
            // read the next value
            ({ done, value: buffer } = Number.isNaN(size - bufferLength) ?
                it.next() : it.next(size - bufferLength));
            // if chunk is not null or empty, push it onto the queue
            if (!done && buffer.byteLength > 0) {
                buffers.push(buffer);
                bufferLength += buffer.byteLength;
            }
            // If we have enough bytes in our buffer, yield chunks until we don't
            if (done || size <= bufferLength) {
                do {
                    ({ cmd, size } = yield byteRange());
                } while (size < bufferLength);
            }
        } while (!done);
    }
    catch (e) {
        (threw = true) && (typeof it.throw === 'function') && (it.throw(e));
    }
    finally {
        (threw === false) && (typeof it.return === 'function') && (it.return(null));
    }
    return null;
}
/** @ignore */
function fromAsyncIterable(source) {
    return tslib_1.__asyncGenerator(this, arguments, function* fromAsyncIterable_1() {
        let done, threw = false;
        let buffers = [], buffer;
        let cmd, size, bufferLength = 0;
        function byteRange() {
            if (cmd === 'peek') {
                return (0, buffer_js_1.joinUint8Arrays)(buffers, size)[0];
            }
            [buffer, buffers, bufferLength] = (0, buffer_js_1.joinUint8Arrays)(buffers, size);
            return buffer;
        }
        // Yield so the caller can inject the read command before creating the source AsyncIterator
        ({ cmd, size } = (yield yield tslib_1.__await((() => null)())) || { cmd: 'read', size: 0 });
        // initialize the iterator
        const it = (0, buffer_js_1.toUint8ArrayAsyncIterator)(source)[Symbol.asyncIterator]();
        try {
            do {
                // read the next value
                ({ done, value: buffer } = Number.isNaN(size - bufferLength)
                    ? yield tslib_1.__await(it.next())
                    : yield tslib_1.__await(it.next(size - bufferLength)));
                // if chunk is not null or empty, push it onto the queue
                if (!done && buffer.byteLength > 0) {
                    buffers.push(buffer);
                    bufferLength += buffer.byteLength;
                }
                // If we have enough bytes in our buffer, yield chunks until we don't
                if (done || size <= bufferLength) {
                    do {
                        ({ cmd, size } = yield yield tslib_1.__await(byteRange()));
                    } while (size < bufferLength);
                }
            } while (!done);
        }
        catch (e) {
            (threw = true) && (typeof it.throw === 'function') && (yield tslib_1.__await(it.throw(e)));
        }
        finally {
            (threw === false) && (typeof it.return === 'function') && (yield tslib_1.__await(it.return(new Uint8Array(0))));
        }
        return yield tslib_1.__await(null);
    });
}
// All this manual Uint8Array chunk management can be avoided if/when engines
// add support for ArrayBuffer.transfer() or ArrayBuffer.prototype.realloc():
// https://github.com/domenic/proposal-arraybuffer-transfer
/** @ignore */
function fromDOMStream(source) {
    return tslib_1.__asyncGenerator(this, arguments, function* fromDOMStream_1() {
        let done = false, threw = false;
        let buffers = [], buffer;
        let cmd, size, bufferLength = 0;
        function byteRange() {
            if (cmd === 'peek') {
                return (0, buffer_js_1.joinUint8Arrays)(buffers, size)[0];
            }
            [buffer, buffers, bufferLength] = (0, buffer_js_1.joinUint8Arrays)(buffers, size);
            return buffer;
        }
        // Yield so the caller can inject the read command before we establish the ReadableStream lock
        ({ cmd, size } = (yield yield tslib_1.__await((() => null)())) || { cmd: 'read', size: 0 });
        // initialize the reader and lock the stream
        const it = new AdaptiveByteReader(source);
        try {
            do {
                // read the next value
                ({ done, value: buffer } = Number.isNaN(size - bufferLength)
                    ? yield tslib_1.__await(it['read']())
                    : yield tslib_1.__await(it['read'](size - bufferLength)));
                // if chunk is not null or empty, push it onto the queue
                if (!done && buffer.byteLength > 0) {
                    buffers.push((0, buffer_js_1.toUint8Array)(buffer));
                    bufferLength += buffer.byteLength;
                }
                // If we have enough bytes in our buffer, yield chunks until we don't
                if (done || size <= bufferLength) {
                    do {
                        ({ cmd, size } = yield yield tslib_1.__await(byteRange()));
                    } while (size < bufferLength);
                }
            } while (!done);
        }
        catch (e) {
            (threw = true) && (yield tslib_1.__await(it['cancel'](e)));
        }
        finally {
            (threw === false) ? (yield tslib_1.__await(it['cancel']()))
                : source['locked'] && it.releaseLock();
        }
        return yield tslib_1.__await(null);
    });
}
/** @ignore */
class AdaptiveByteReader {
    constructor(source) {
        this.source = source;
        this.reader = null;
        this.reader = this.source['getReader']();
        // We have to catch and swallow errors here to avoid uncaught promise rejection exceptions
        // that seem to be raised when we call `releaseLock()` on this reader. I'm still mystified
        // about why these errors are raised, but I'm sure there's some important spec reason that
        // I haven't considered. I hate to employ such an anti-pattern here, but it seems like the
        // only solution in this case :/
        this.reader['closed'].catch(() => { });
    }
    get closed() {
        return this.reader ? this.reader['closed'].catch(() => { }) : Promise.resolve();
    }
    releaseLock() {
        if (this.reader) {
            this.reader.releaseLock();
        }
        this.reader = null;
    }
    cancel(reason) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { reader, source } = this;
            reader && (yield reader['cancel'](reason).catch(() => { }));
            source && (source['locked'] && this.releaseLock());
        });
    }
    read(size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (size === 0) {
                return { done: this.reader == null, value: new Uint8Array(0) };
            }
            const result = yield this.reader.read();
            !result.done && (result.value = (0, buffer_js_1.toUint8Array)(result));
            return result;
        });
    }
}
/** @ignore */
const onEvent = (stream, event) => {
    const handler = (_) => resolve([event, _]);
    let resolve;
    return [event, handler, new Promise((r) => (resolve = r) && stream['once'](event, handler))];
};
/** @ignore */
function fromNodeStream(stream) {
    return tslib_1.__asyncGenerator(this, arguments, function* fromNodeStream_1() {
        const events = [];
        let event = 'error';
        let done = false, err = null;
        let cmd, size, bufferLength = 0;
        let buffers = [], buffer;
        function byteRange() {
            if (cmd === 'peek') {
                return (0, buffer_js_1.joinUint8Arrays)(buffers, size)[0];
            }
            [buffer, buffers, bufferLength] = (0, buffer_js_1.joinUint8Arrays)(buffers, size);
            return buffer;
        }
        // Yield so the caller can inject the read command before we
        // add the listener for the source stream's 'readable' event.
        ({ cmd, size } = (yield yield tslib_1.__await((() => null)())) || { cmd: 'read', size: 0 });
        // ignore stdin if it's a TTY
        if (stream['isTTY']) {
            yield yield tslib_1.__await(new Uint8Array(0));
            return yield tslib_1.__await(null);
        }
        try {
            // initialize the stream event handlers
            events[0] = onEvent(stream, 'end');
            events[1] = onEvent(stream, 'error');
            do {
                events[2] = onEvent(stream, 'readable');
                // wait on the first message event from the stream
                [event, err] = yield tslib_1.__await(Promise.race(events.map((x) => x[2])));
                // if the stream emitted an Error, rethrow it
                if (event === 'error') {
                    break;
                }
                if (!(done = event === 'end')) {
                    // If the size is NaN, request to read everything in the stream's internal buffer
                    if (!Number.isFinite(size - bufferLength)) {
                        buffer = (0, buffer_js_1.toUint8Array)(stream['read']());
                    }
                    else {
                        buffer = (0, buffer_js_1.toUint8Array)(stream['read'](size - bufferLength));
                        // If the byteLength is 0, then the requested amount is more than the stream has
                        // in its internal buffer. In this case the stream needs a "kick" to tell it to
                        // continue emitting readable events, so request to read everything the stream
                        // has in its internal buffer right now.
                        if (buffer.byteLength < (size - bufferLength)) {
                            buffer = (0, buffer_js_1.toUint8Array)(stream['read']());
                        }
                    }
                    // if chunk is not null or empty, push it onto the queue
                    if (buffer.byteLength > 0) {
                        buffers.push(buffer);
                        bufferLength += buffer.byteLength;
                    }
                }
                // If we have enough bytes in our buffer, yield chunks until we don't
                if (done || size <= bufferLength) {
                    do {
                        ({ cmd, size } = yield yield tslib_1.__await(byteRange()));
                    } while (size < bufferLength);
                }
            } while (!done);
        }
        finally {
            yield tslib_1.__await(cleanup(events, event === 'error' ? err : null));
        }
        return yield tslib_1.__await(null);
        function cleanup(events, err) {
            buffer = buffers = null;
            return new Promise((resolve, reject) => {
                for (const [evt, fn] of events) {
                    stream['off'](evt, fn);
                }
                try {
                    // Some stream implementations don't call the destroy callback,
                    // because it's really a node-internal API. Just calling `destroy`
                    // here should be enough to conform to the ReadableStream contract
                    const destroy = stream['destroy'];
                    destroy && destroy.call(stream, err);
                    err = undefined;
                }
                catch (e) {
                    err = e || err;
                }
                finally {
                    err != null ? reject(err) : resolve();
                }
            });
        }
    });
}

//# sourceMappingURL=adapters.js.map
