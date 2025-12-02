"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTLCache = void 0;
exports.toSQL = toSQL;
exports.packBits = packBits;
function toSQL(value) {
    if (typeof value === "string") {
        return `'${value.replace(/'/g, "''")}'`;
    }
    else if (typeof value === "number") {
        return value.toString();
    }
    else if (typeof value === "boolean") {
        return value ? "TRUE" : "FALSE";
    }
    else if (value === null) {
        return "NULL";
    }
    else if (value instanceof Date) {
        return `'${value.toISOString()}'`;
    }
    else if (Array.isArray(value)) {
        return `[${value.map(toSQL).join(", ")}]`;
    }
    else if (Buffer.isBuffer(value)) {
        return `X'${value.toString("hex")}'`;
    }
    else if (value instanceof ArrayBuffer) {
        return `X'${Buffer.from(value).toString("hex")}'`;
    }
    else {
        throw new Error(`Unsupported value type: ${typeof value} value: (${value})`);
    }
}
function packBits(data) {
    const packed = Array(data.length >> 3).fill(0);
    for (let i = 0; i < data.length; i++) {
        const byte = i >> 3;
        const bit = i & 7;
        packed[byte] |= data[i] << bit;
    }
    return packed;
}
class TTLCache {
    ttl;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    cache;
    /**
     * @param ttl Time to live in milliseconds
     */
    constructor(ttl) {
        this.ttl = ttl;
        this.cache = new Map();
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    get(key) {
        const entry = this.cache.get(key);
        if (entry === undefined) {
            return undefined;
        }
        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.value;
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    set(key, value) {
        this.cache.set(key, { value, expires: Date.now() + this.ttl });
    }
    delete(key) {
        this.cache.delete(key);
    }
}
exports.TTLCache = TTLCache;
