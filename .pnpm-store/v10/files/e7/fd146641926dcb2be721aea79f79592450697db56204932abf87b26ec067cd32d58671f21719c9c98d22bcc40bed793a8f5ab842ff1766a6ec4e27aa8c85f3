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
import { ScalarType } from "../descriptors.js";
import { protoInt64 } from "../proto-int64.js";
/**
 * Parse an enum value from the Protobuf text format.
 *
 * @private
 */
export function parseTextFormatEnumValue(descEnum, value) {
    const enumValue = descEnum.values.find((v) => v.name === value);
    if (!enumValue) {
        throw new Error(`cannot parse ${descEnum} default value: ${value}`);
    }
    return enumValue.number;
}
/**
 * Parse a scalar value from the Protobuf text format.
 *
 * @private
 */
export function parseTextFormatScalarValue(type, value) {
    switch (type) {
        case ScalarType.STRING:
            return value;
        case ScalarType.BYTES: {
            const u = unescapeBytesDefaultValue(value);
            if (u === false) {
                throw new Error(`cannot parse ${ScalarType[type]} default value: ${value}`);
            }
            return u;
        }
        case ScalarType.INT64:
        case ScalarType.SFIXED64:
        case ScalarType.SINT64:
            return protoInt64.parse(value);
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
            return protoInt64.uParse(value);
        case ScalarType.DOUBLE:
        case ScalarType.FLOAT:
            switch (value) {
                case "inf":
                    return Number.POSITIVE_INFINITY;
                case "-inf":
                    return Number.NEGATIVE_INFINITY;
                case "nan":
                    return Number.NaN;
                default:
                    return parseFloat(value);
            }
        case ScalarType.BOOL:
            return value === "true";
        case ScalarType.INT32:
        case ScalarType.UINT32:
        case ScalarType.SINT32:
        case ScalarType.FIXED32:
        case ScalarType.SFIXED32:
            return parseInt(value, 10);
    }
}
/**
 * Parses a text-encoded default value (proto2) of a BYTES field.
 */
function unescapeBytesDefaultValue(str) {
    const b = [];
    const input = {
        tail: str,
        c: "",
        next() {
            if (this.tail.length == 0) {
                return false;
            }
            this.c = this.tail[0];
            this.tail = this.tail.substring(1);
            return true;
        },
        take(n) {
            if (this.tail.length >= n) {
                const r = this.tail.substring(0, n);
                this.tail = this.tail.substring(n);
                return r;
            }
            return false;
        },
    };
    while (input.next()) {
        switch (input.c) {
            case "\\":
                if (input.next()) {
                    switch (input.c) {
                        case "\\":
                            b.push(input.c.charCodeAt(0));
                            break;
                        case "b":
                            b.push(0x08);
                            break;
                        case "f":
                            b.push(0x0c);
                            break;
                        case "n":
                            b.push(0x0a);
                            break;
                        case "r":
                            b.push(0x0d);
                            break;
                        case "t":
                            b.push(0x09);
                            break;
                        case "v":
                            b.push(0x0b);
                            break;
                        case "0":
                        case "1":
                        case "2":
                        case "3":
                        case "4":
                        case "5":
                        case "6":
                        case "7": {
                            const s = input.c;
                            const t = input.take(2);
                            if (t === false) {
                                return false;
                            }
                            const n = parseInt(s + t, 8);
                            if (Number.isNaN(n)) {
                                return false;
                            }
                            b.push(n);
                            break;
                        }
                        case "x": {
                            const s = input.c;
                            const t = input.take(2);
                            if (t === false) {
                                return false;
                            }
                            const n = parseInt(s + t, 16);
                            if (Number.isNaN(n)) {
                                return false;
                            }
                            b.push(n);
                            break;
                        }
                        case "u": {
                            const s = input.c;
                            const t = input.take(4);
                            if (t === false) {
                                return false;
                            }
                            const n = parseInt(s + t, 16);
                            if (Number.isNaN(n)) {
                                return false;
                            }
                            const chunk = new Uint8Array(4);
                            const view = new DataView(chunk.buffer);
                            view.setInt32(0, n, true);
                            b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
                            break;
                        }
                        case "U": {
                            const s = input.c;
                            const t = input.take(8);
                            if (t === false) {
                                return false;
                            }
                            const tc = protoInt64.uEnc(s + t);
                            const chunk = new Uint8Array(8);
                            const view = new DataView(chunk.buffer);
                            view.setInt32(0, tc.lo, true);
                            view.setInt32(4, tc.hi, true);
                            b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
                            break;
                        }
                    }
                }
                break;
            default:
                b.push(input.c.charCodeAt(0));
        }
    }
    return new Uint8Array(b);
}
