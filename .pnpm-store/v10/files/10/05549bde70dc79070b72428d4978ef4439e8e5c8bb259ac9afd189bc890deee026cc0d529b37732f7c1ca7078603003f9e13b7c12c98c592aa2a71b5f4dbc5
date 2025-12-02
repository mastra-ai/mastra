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
exports.InvalidPathError = void 0;
exports.buildPath = buildPath;
exports.parsePath = parsePath;
exports.pathToString = pathToString;
const descriptors_js_1 = require("../descriptors.js");
/**
 * Create a PathBuilder.
 */
function buildPath(schema) {
    return new PathBuilderImpl(schema, schema, []);
}
/**
 * Parse a Path from a string.
 *
 * Throws an InvalidPathError if the path is invalid.
 *
 * Note that a Registry must be provided via the options argument to parse
 * paths that refer to an extension.
 */
function parsePath(schema, path, options) {
    var _a, _b;
    const builder = new PathBuilderImpl(schema, schema, []);
    const err = (message, i) => new InvalidPathError(schema, message + " at column " + (i + 1), path);
    for (let i = 0; i < path.length;) {
        const token = nextToken(i, path);
        const left = builder.getLeft();
        let right = undefined;
        if ("field" in token) {
            right =
                (left === null || left === void 0 ? void 0 : left.kind) != "message"
                    ? undefined
                    : ((_a = left.fields.find((field) => field.name === token.field)) !== null && _a !== void 0 ? _a : left.oneofs.find((oneof) => oneof.name === token.field));
            if (!right) {
                throw err(`Unknown field "${token.field}"`, i);
            }
        }
        else if ("ext" in token) {
            right = (_b = options === null || options === void 0 ? void 0 : options.registry) === null || _b === void 0 ? void 0 : _b.getExtension(token.ext);
            if (!right) {
                throw err(`Unknown extension "${token.ext}"`, i);
            }
        }
        else if ("val" in token) {
            // list or map
            right =
                (left === null || left === void 0 ? void 0 : left.kind) == "field" &&
                    left.fieldKind == "list" &&
                    typeof token.val == "bigint"
                    ? { kind: "list_sub", index: Number(token.val) }
                    : { kind: "map_sub", key: token.val };
        }
        else if ("err" in token) {
            throw err(token.err, token.i);
        }
        if (right) {
            try {
                builder.add([right]);
            }
            catch (e) {
                throw err(e instanceof InvalidPathError ? e.message : String(e), i);
            }
        }
        i = token.i;
    }
    return builder.toPath();
}
/**
 * Stringify a path.
 */
function pathToString(path) {
    const str = [];
    for (const ele of path) {
        switch (ele.kind) {
            case "field":
            case "oneof":
                if (str.length > 0) {
                    str.push(".");
                }
                str.push(ele.name);
                break;
            case "extension":
                str.push("[", ele.typeName, "]");
                break;
            case "list_sub":
                str.push("[", ele.index, "]");
                break;
            case "map_sub":
                if (typeof ele.key == "string") {
                    str.push('["', ele.key
                        .split("\\")
                        .join("\\\\")
                        .split('"')
                        .join('\\"')
                        .split("\r")
                        .join("\\r")
                        .split("\n")
                        .join("\\n"), '"]');
                }
                else {
                    str.push("[", ele.key, "]");
                }
                break;
        }
    }
    return str.join("");
}
/**
 * InvalidPathError is thrown for invalid Paths, for example during parsing from
 * a string, or when a new Path is built.
 */
class InvalidPathError extends Error {
    constructor(schema, message, path) {
        super(message);
        this.name = "InvalidPathError";
        this.schema = schema;
        this.path = path;
        // see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#example
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.InvalidPathError = InvalidPathError;
class PathBuilderImpl {
    constructor(schema, left, path) {
        this.schema = schema;
        this.left = left;
        this.path = path;
    }
    getLeft() {
        return this.left;
    }
    field(field) {
        return this.push(field);
    }
    oneof(oneof) {
        return this.push(oneof);
    }
    extension(extension) {
        return this.push(extension);
    }
    list(index) {
        return this.push({ kind: "list_sub", index });
    }
    map(key) {
        return this.push({ kind: "map_sub", key });
    }
    add(pathOrBuilder) {
        const path = Array.isArray(pathOrBuilder)
            ? pathOrBuilder
            : pathOrBuilder.toPath();
        const l = this.path.length;
        try {
            for (const ele of path) {
                this.push(ele);
            }
        }
        catch (e) {
            // undo pushes
            this.path.splice(l);
            throw e;
        }
        return this;
    }
    toPath() {
        return this.path.concat();
    }
    clone() {
        return new PathBuilderImpl(this.schema, this.left, this.path.concat());
    }
    push(ele) {
        switch (ele.kind) {
            case "field":
                if (!this.left ||
                    this.left.kind != "message" ||
                    this.left.typeName != ele.parent.typeName) {
                    throw this.err("field access");
                }
                this.path.push(ele);
                this.left =
                    ele.fieldKind == "message"
                        ? ele.message
                        : ele.fieldKind == "list" || ele.fieldKind == "map"
                            ? ele
                            : undefined;
                return this;
            case "oneof":
                if (!this.left ||
                    this.left.kind != "message" ||
                    this.left.typeName != ele.parent.typeName) {
                    throw this.err("oneof access");
                }
                this.path.push(ele);
                this.left = undefined;
                return this;
            case "extension":
                if (!this.left ||
                    this.left.kind != "message" ||
                    this.left.typeName != ele.extendee.typeName) {
                    throw this.err("extension access");
                }
                this.path.push(ele);
                this.left = ele.fieldKind == "message" ? ele.message : undefined;
                return this;
            case "list_sub":
                if (!this.left ||
                    this.left.kind != "field" ||
                    this.left.fieldKind != "list") {
                    throw this.err("list access");
                }
                if (ele.index < 0 || !Number.isInteger(ele.index)) {
                    throw this.err("list index");
                }
                this.path.push(ele);
                this.left =
                    this.left.listKind == "message" ? this.left.message : undefined;
                return this;
            case "map_sub":
                if (!this.left ||
                    this.left.kind != "field" ||
                    this.left.fieldKind != "map") {
                    throw this.err("map access");
                }
                if (!checkKeyType(ele.key, this.left.mapKey)) {
                    throw this.err("map key");
                }
                this.path.push(ele);
                this.left =
                    this.left.mapKind == "message" ? this.left.message : undefined;
                return this;
        }
    }
    err(what) {
        return new InvalidPathError(this.schema, "Invalid " + what, this.path);
    }
}
function checkKeyType(key, type) {
    switch (type) {
        case descriptors_js_1.ScalarType.STRING:
            return typeof key == "string";
        case descriptors_js_1.ScalarType.INT32:
        case descriptors_js_1.ScalarType.UINT32:
        case descriptors_js_1.ScalarType.SINT32:
        case descriptors_js_1.ScalarType.SFIXED32:
        case descriptors_js_1.ScalarType.FIXED32:
            return typeof key == "number";
        case descriptors_js_1.ScalarType.UINT64:
        case descriptors_js_1.ScalarType.INT64:
        case descriptors_js_1.ScalarType.FIXED64:
        case descriptors_js_1.ScalarType.SFIXED64:
        case descriptors_js_1.ScalarType.SINT64:
            return typeof key == "bigint";
        case descriptors_js_1.ScalarType.BOOL:
            return typeof key == "boolean";
    }
}
function nextToken(i, path) {
    const re_extension = /^[A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*$/;
    const re_field = /^[A-Za-z_][A-Za-z_0-9]*$/;
    if (path[i] == "[") {
        i++;
        while (path[i] == " ") {
            // skip leading whitespace
            i++;
        }
        if (i >= path.length) {
            return { err: "Premature end", i: path.length - 1 };
        }
        let token;
        if (path[i] == `"`) {
            // string literal
            i++;
            let val = "";
            for (;;) {
                if (path[i] == `"`) {
                    // end of string literal
                    i++;
                    break;
                }
                if (path[i] == "\\") {
                    switch (path[i + 1]) {
                        case `"`:
                        case "\\":
                            val += path[i + 1];
                            break;
                        case "r":
                            val += "\r";
                            break;
                        case "n":
                            val += "\n";
                            break;
                        default:
                            return { err: "Invalid escape sequence", i };
                    }
                    i++;
                }
                else {
                    val += path[i];
                }
                if (i >= path.length) {
                    return { err: "Premature end of string", i: path.length - 1 };
                }
                i++;
            }
            token = { val };
        }
        else if (path[i].match(/\d/)) {
            // integer literal
            const start = i;
            while (i < path.length && /\d/.test(path[i])) {
                i++;
            }
            token = { val: BigInt(path.substring(start, i)) };
        }
        else if (path[i] == "]") {
            return { err: "Premature ]", i };
        }
        else {
            // extension identifier or bool literal
            const start = i;
            while (i < path.length && path[i] != " " && path[i] != "]") {
                i++;
            }
            const name = path.substring(start, i);
            if (name === "true") {
                token = { val: true };
            }
            else if (name === "false") {
                token = { val: false };
            }
            else if (re_extension.test(name)) {
                token = { ext: name };
            }
            else {
                return { err: "Invalid ident", i: start };
            }
        }
        while (path[i] == " ") {
            // skip trailing whitespace
            i++;
        }
        if (path[i] != "]") {
            return { err: "Missing ]", i };
        }
        i++;
        return Object.assign(Object.assign({}, token), { i });
    }
    // field identifier
    if (i > 0) {
        if (path[i] != ".") {
            return { err: `Expected "."`, i };
        }
        i++;
    }
    const start = i;
    while (i < path.length && path[i] != "." && path[i] != "[") {
        i++;
    }
    const field = path.substring(start, i);
    return re_field.test(field)
        ? { field, i }
        : { err: "Invalid ident", i: start };
}
