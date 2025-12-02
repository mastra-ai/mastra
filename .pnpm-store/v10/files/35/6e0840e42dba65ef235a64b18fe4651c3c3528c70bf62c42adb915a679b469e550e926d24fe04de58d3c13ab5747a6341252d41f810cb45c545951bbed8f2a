"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64Decode = base64Decode;
exports.base64Encode = base64Encode;
/**
 * Decodes a base64 string to a byte array.
 *
 * - ignores white-space, including line breaks and tabs
 * - allows inner padding (can decode concatenated base64 strings)
 * - does not require padding
 * - understands base64url encoding:
 *   "-" instead of "+",
 *   "_" instead of "/",
 *   no padding
 */
function base64Decode(base64Str) {
    const table = getDecodeTable();
    // estimate byte size, not accounting for inner padding and whitespace
    let es = (base64Str.length * 3) / 4;
    if (base64Str[base64Str.length - 2] == "=")
        es -= 2;
    else if (base64Str[base64Str.length - 1] == "=")
        es -= 1;
    let bytes = new Uint8Array(es), bytePos = 0, // position in byte array
    groupPos = 0, // position in base64 group
    b, // current byte
    p = 0; // previous byte
    for (let i = 0; i < base64Str.length; i++) {
        b = table[base64Str.charCodeAt(i)];
        if (b === undefined) {
            switch (base64Str[i]) {
                // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
                case "=":
                    groupPos = 0; // reset state when padding found
                case "\n":
                case "\r":
                case "\t":
                case " ":
                    continue; // skip white-space, and padding
                default:
                    throw Error("invalid base64 string");
            }
        }
        switch (groupPos) {
            case 0:
                p = b;
                groupPos = 1;
                break;
            case 1:
                bytes[bytePos++] = (p << 2) | ((b & 48) >> 4);
                p = b;
                groupPos = 2;
                break;
            case 2:
                bytes[bytePos++] = ((p & 15) << 4) | ((b & 60) >> 2);
                p = b;
                groupPos = 3;
                break;
            case 3:
                bytes[bytePos++] = ((p & 3) << 6) | b;
                groupPos = 0;
                break;
        }
    }
    if (groupPos == 1)
        throw Error("invalid base64 string");
    return bytes.subarray(0, bytePos);
}
/**
 * Encode a byte array to a base64 string.
 *
 * By default, this function uses the standard base64 encoding with padding.
 *
 * To encode without padding, use encoding = "std_raw".
 *
 * To encode with the URL encoding, use encoding = "url", which replaces the
 * characters +/ by their URL-safe counterparts -_, and omits padding.
 */
function base64Encode(bytes, encoding = "std") {
    const table = getEncodeTable(encoding);
    const pad = encoding == "std";
    let base64 = "", groupPos = 0, // position in base64 group
    b, // current byte
    p = 0; // carry over from previous byte
    for (let i = 0; i < bytes.length; i++) {
        b = bytes[i];
        switch (groupPos) {
            case 0:
                base64 += table[b >> 2];
                p = (b & 3) << 4;
                groupPos = 1;
                break;
            case 1:
                base64 += table[p | (b >> 4)];
                p = (b & 15) << 2;
                groupPos = 2;
                break;
            case 2:
                base64 += table[p | (b >> 6)];
                base64 += table[b & 63];
                groupPos = 0;
                break;
        }
    }
    // add output padding
    if (groupPos) {
        base64 += table[p];
        if (pad) {
            base64 += "=";
            if (groupPos == 1)
                base64 += "=";
        }
    }
    return base64;
}
// lookup table from base64 character to byte
let encodeTableStd;
let encodeTableUrl;
// lookup table from base64 character *code* to byte because lookup by number is fast
let decodeTable;
function getEncodeTable(encoding) {
    if (!encodeTableStd) {
        encodeTableStd =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
        encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_");
    }
    return encoding == "url"
        ? // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
            encodeTableUrl
        : encodeTableStd;
}
function getDecodeTable() {
    if (!decodeTable) {
        decodeTable = [];
        const encodeTable = getEncodeTable("std");
        for (let i = 0; i < encodeTable.length; i++)
            decodeTable[encodeTable[i].charCodeAt(0)] = i;
        // support base64url variants
        decodeTable["-".charCodeAt(0)] = encodeTable.indexOf("+");
        decodeTable["_".charCodeAt(0)] = encodeTable.indexOf("/");
    }
    return decodeTable;
}
