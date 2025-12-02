"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RmRecordEncoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const RM_HEADER_SIZE = 4;
const MAX_SINGLE_FRAME_SIZE = 0x7fffffff;
class RmRecordEncoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
    }
    encodeHdr(fin, length) {
        this.writeHdr(fin, length);
        return this.writer.flush();
    }
    encodeRecord(record) {
        this.writeRecord(record);
        return this.writer.flush();
    }
    writeHdr(fin, length) {
        this.writer.u32((fin ? 2147483648 : 0) + length);
    }
    writeRecord(record) {
        const length = record.length;
        if (length <= 2147483647) {
            const writer = this.writer;
            writer.u32(2147483648 + length);
            writer.buf(record, length);
            return;
        }
        let offset = 0;
        while (offset < length) {
            const fragmentLength = Math.min(length - offset, 0x7fffffff);
            const fin = fragmentLength + offset >= length ? 1 : 0;
            this.writeFragment(record, offset, fragmentLength, fin);
            offset += fragmentLength;
        }
    }
    writeFragment(record, offset, length, fin) {
        this.writeHdr(fin, length);
        const fragment = record.subarray(offset, offset + length);
        this.writer.buf(fragment, length);
    }
    startRecord() {
        const writer = this.writer;
        const rmHeaderPosition = writer.x;
        writer.x += RM_HEADER_SIZE;
        return rmHeaderPosition;
    }
    endRecord(rmHeaderPosition) {
        const writer = this.writer;
        const totalSize = writer.x - rmHeaderPosition - RM_HEADER_SIZE;
        if (totalSize <= MAX_SINGLE_FRAME_SIZE) {
            const currentX = writer.x;
            writer.x = rmHeaderPosition;
            this.writeHdr(1, totalSize);
            writer.x = currentX;
        }
        else {
            const currentX = writer.x;
            writer.x = rmHeaderPosition;
            const data = writer.uint8.subarray(rmHeaderPosition + RM_HEADER_SIZE, currentX);
            writer.reset();
            this.writeRecord(data);
        }
    }
}
exports.RmRecordEncoder = RmRecordEncoder;
//# sourceMappingURL=RmRecordEncoder.js.map