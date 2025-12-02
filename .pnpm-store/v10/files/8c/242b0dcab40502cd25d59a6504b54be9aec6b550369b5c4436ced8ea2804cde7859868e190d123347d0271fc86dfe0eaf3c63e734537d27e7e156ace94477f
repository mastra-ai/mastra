"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmRecordDecoder = void 0;
const StreamingReader_1 = require("@jsonjoy.com/buffers/lib/StreamingReader");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const concat_1 = require("@jsonjoy.com/buffers/lib/concat");
class RmRecordDecoder {
    constructor() {
        this.reader = new StreamingReader_1.StreamingReader();
        this.fragments = [];
    }
    push(uint8) {
        this.reader.push(uint8);
    }
    readRecord() {
        const reader = this.reader;
        let size = reader.size();
        if (size < 4)
            return undefined;
        const x = reader.x;
        READ_FRAGMENT: {
            try {
                const header = reader.u32();
                size -= 4;
                const fin = !!(header & 2147483648);
                const len = header & 2147483647;
                if (size < len)
                    break READ_FRAGMENT;
                reader.consume();
                const fragments = this.fragments;
                if (fin) {
                    if (!fragments.length)
                        return reader.cut(len);
                    fragments.push(reader.buf(len));
                    const record = (0, concat_1.concatList)(fragments);
                    this.fragments = [];
                    return record.length ? new Reader_1.Reader(record) : undefined;
                }
                else {
                    fragments.push(reader.buf(len));
                    return undefined;
                }
            }
            catch (err) {
                reader.x = x;
                if (err instanceof RangeError)
                    return undefined;
                else
                    throw err;
            }
        }
        reader.x = x;
        return undefined;
    }
}
exports.RmRecordDecoder = RmRecordDecoder;
//# sourceMappingURL=RmRecordDecoder.js.map