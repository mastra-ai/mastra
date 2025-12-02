"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = void 0;
const Error_js_1 = require("./Error.js");
const Guid_js_1 = require("./Guid.js");
const Queue_js_1 = require("./Queue.js");
class Stream {
    constructor(streamId) {
        this.privIsWriteEnded = false;
        this.privIsReadEnded = false;
        this.privId = streamId ? streamId : (0, Guid_js_1.createNoDashGuid)();
        this.privReaderQueue = new Queue_js_1.Queue();
    }
    get isClosed() {
        return this.privIsWriteEnded;
    }
    get isReadEnded() {
        return this.privIsReadEnded;
    }
    get id() {
        return this.privId;
    }
    close() {
        if (!this.privIsWriteEnded) {
            this.writeStreamChunk({
                buffer: null,
                isEnd: true,
                timeReceived: Date.now(),
            });
            this.privIsWriteEnded = true;
        }
    }
    writeStreamChunk(streamChunk) {
        this.throwIfClosed();
        if (!this.privReaderQueue.isDisposed()) {
            try {
                this.privReaderQueue.enqueue(streamChunk);
            }
            catch (e) {
                // Do nothing
            }
        }
    }
    read() {
        if (this.privIsReadEnded) {
            throw new Error_js_1.InvalidOperationError("Stream read has already finished");
        }
        return this.privReaderQueue
            .dequeue()
            .then(async (streamChunk) => {
            if (streamChunk === undefined || streamChunk.isEnd) {
                await this.privReaderQueue.dispose("End of stream reached");
            }
            return streamChunk;
        });
    }
    readEnded() {
        if (!this.privIsReadEnded) {
            this.privIsReadEnded = true;
            this.privReaderQueue = new Queue_js_1.Queue();
        }
    }
    throwIfClosed() {
        if (this.privIsWriteEnded) {
            throw new Error_js_1.InvalidOperationError("Stream closed");
        }
    }
}
exports.Stream = Stream;

//# sourceMappingURL=Stream.js.map
