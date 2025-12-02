"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectId = exports.UUID = void 0;
const uuidv7_1 = require("uuidv7");
const common_1 = require("../common");
const uuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
class UUID {
        constructor(uuid, validate = true) {
                Object.defineProperty(this, "version", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_raw", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (validate) {
            if (typeof uuid !== 'string') {
                throw new Error('UUID must be a string');
            }
            if (uuid.length !== 36 || !uuidRegex.test(uuid)) {
                throw new Error('UUID must be a 36-character hex string');
            }
        }
        Object.defineProperty(this, '_raw', {
            value: uuid.toLowerCase(),
            writable: false,
        });
        Object.defineProperty(this, 'version', {
            value: parseInt(this._raw[14], 16),
            writable: false,
        });
    }
        equals(other) {
        if (typeof other === 'string') {
            return this._raw === other;
        }
        if (other instanceof UUID) {
            return this._raw === other._raw;
        }
        return false;
    }
        getTimestamp() {
        return timestampFromUUID(this);
    }
        toString() {
        return this._raw;
    }
        static v4() {
        return new UUID((0, uuidv7_1.uuidv4)(), false);
    }
        static v7() {
        return new UUID((0, uuidv7_1.uuidv7)(), false);
    }
        inspect() {
        return `UUID("${this.toString()}")`;
    }
        toJSON() {
        return { $uuid: this.toString() };
    }
}
exports.UUID = UUID;
const objectIdRegex = new RegExp('^[0-9a-fA-F]{24}$');
class ObjectId {
        constructor(id, validate = true) {
        Object.defineProperty(this, "_raw", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (validate) {
            if (typeof id === 'string') {
                if (id.length !== 24 || !objectIdRegex.test(id)) {
                    throw new Error('ObjectId must be a 24-character hex string');
                }
            }
            else if (typeof id !== 'number' && !(0, common_1.isNullish)(id)) {
                throw new Error('ObjectId must be a string, number, or nullish');
            }
        }
        Object.defineProperty(this, '_raw', {
            value: (typeof id === 'string') ? id.toLowerCase() : genObjectId(id),
            writable: false,
        });
    }
        equals(other) {
        if (typeof other === 'string') {
            return this._raw.localeCompare(other, undefined, { sensitivity: 'accent' }) === 0;
        }
        if (other instanceof ObjectId) {
            return this._raw.localeCompare(other._raw, undefined, { sensitivity: 'accent' }) === 0;
        }
        return false;
    }
        getTimestamp() {
        const time = parseInt(this._raw.slice(0, 8), 16);
        return new Date(~~time * 1000);
    }
        toString() {
        return this._raw;
    }
        inspect() {
        return `ObjectId("${this.toString()}")`;
    }
        toJSON() {
        return { $objectId: this.toString() };
    }
}
exports.ObjectId = ObjectId;
const RAND_ID = ~~(Math.random() * 0xFFFFFF);
const PID = ((typeof process === 'undefined' || typeof process.pid !== 'number') ? ~~(Math.random() * 100000) : process.pid) % 0xFFFF;
const hexTable = Array.from({ length: 256 }, (_, i) => {
    return (i <= 15 ? '0' : '') + i.toString(16);
});
let index = ~~(Math.random() * 0xFFFFFF);
function genObjectId(time) {
    time ?? (time = ~~(Date.now() / 1000));
    time = time % 0xFFFFFFFF;
    index = (index + 1) % 0xFFFFFF;
    let hexString = '';
    hexString += hexTable[((time >> 24) & 0xFF)];
    hexString += hexTable[((time >> 16) & 0xFF)];
    hexString += hexTable[((time >> 8) & 0xFF)];
    hexString += hexTable[(time & 0xFF)];
    hexString += hexTable[((RAND_ID >> 16) & 0xFF)];
    hexString += hexTable[((RAND_ID >> 8) & 0xFF)];
    hexString += hexTable[(RAND_ID & 0xFF)];
    hexString += hexTable[((PID >> 8) & 0xFF)];
    hexString += hexTable[(PID & 0xFF)];
    hexString += hexTable[((index >> 16) & 0xFF)];
    hexString += hexTable[((index >> 8) & 0xFF)];
    hexString += hexTable[(index & 0xFF)];
    return hexString;
}
function timestampFromUUID(uuid) {
    if (uuid.version !== 7) {
        return undefined;
    }
    const timestampBytes = new Uint8Array(8);
    timestampBytes.set(new Uint8Array(uuidv7_1.UUID.parse(uuid.toString()).bytes.buffer.slice(0, 6)), 2);
    const timestampMs = new DataView(timestampBytes.buffer).getBigUint64(0);
    return new Date(Number(timestampMs));
}
