/*
 * Copyright Michael Hart
 * Licensed under the MIT license. See LICENSE file for details.
 *
 * Portions of this file Copyright Fastly, Inc. See LICENSE file for details.
 * Portions of this file Copyright Joyent, Inc. and other Node contributors. See LICENSE file for details.
 */
import util from "node:util";
/* These items copied from Node.js: node/lib/internal/errors.js */
const classRegExp = /^([A-Z][a-z0-9]*)+$/;
// Sorted by a rough estimate on most frequently used entries.
const kTypes = [
    "string",
    "function",
    "number",
    "object",
    // Accept 'Function' and 'Object' as alternative to the lower cased version.
    "Function",
    "Object",
    "boolean",
    "bigint",
    "symbol",
];
/**
 * Determine the specific type of a value for type-mismatch errors.
 * @param {*} value
 * @returns {string}
 */
function determineSpecificType(value) {
    if (value == null) {
        return "" + value;
    }
    if (typeof value === "function" && value.name) {
        return `function ${value.name}`;
    }
    if (typeof value === "object") {
        if (value.constructor?.name) {
            return `an instance of ${value.constructor.name}`;
        }
        return `${util.inspect(value, { depth: -1 })}`;
    }
    let inspected = util.inspect(value, { colors: false });
    if (inspected.length > 28) {
        inspected = `${inspected.slice(0, 25)}...`;
    }
    return `type ${typeof value} (${inspected})`;
}
// The following classes are adaptations of a subset of the ERR_* classes
// declared in Node.js in the file - node/lib/internal/errors.js.
export class ERR_HTTP_BODY_NOT_ALLOWED extends Error {
    constructor() {
        super("Adding content for this request method or response status is not allowed.");
    }
}
export class ERR_HTTP_CONTENT_LENGTH_MISMATCH extends Error {
    constructor(actual, expected) {
        super(`Response body's content-length of ${actual} byte(s) does not match the content-length of ${expected} byte(s) set in header`);
    }
}
export class ERR_HTTP_HEADERS_SENT extends Error {
    constructor(arg) {
        super(`Cannot ${arg} headers after they are sent to the client`);
    }
}
export class ERR_INVALID_ARG_VALUE extends TypeError /*, RangeError */ {
    constructor(name, value, reason = "is invalid") {
        let inspected = util.inspect(value);
        if (inspected.length > 128) {
            inspected = `${inspected.slice(0, 128)}...`;
        }
        const type = name.includes(".") ? "property" : "argument";
        super(`The ${type} '${name}' ${reason}. Received ${inspected}`);
    }
}
export class ERR_INVALID_CHAR extends TypeError {
    constructor(name, field) {
        let msg = `Invalid character in ${name}`;
        if (field !== undefined) {
            msg += ` ["${field}"]`;
        }
        super(msg);
    }
}
export class ERR_HTTP_INVALID_HEADER_VALUE extends TypeError {
    constructor(value, name) {
        super(`Invalid value "${value}" for header "${name}"`);
    }
}
export class ERR_HTTP_INVALID_STATUS_CODE extends RangeError {
    originalStatusCode;
    constructor(originalStatusCode) {
        super(`Invalid status code: ${originalStatusCode}`);
        this.originalStatusCode = originalStatusCode;
    }
}
export class ERR_HTTP_TRAILER_INVALID extends Error {
    constructor() {
        super(`Trailers are invalid with this transfer encoding`);
    }
}
export class ERR_INVALID_ARG_TYPE extends TypeError {
    constructor(name, expected, actual) {
        // assert(typeof name === 'string', "'name' must be a string");
        if (!Array.isArray(expected)) {
            expected = [expected];
        }
        let msg = "The ";
        if (name.endsWith(" argument")) {
            // For cases like 'first argument'
            msg += `${name} `;
        }
        else {
            const type = name.includes(".") ? "property" : "argument";
            msg += `"${name}" ${type} `;
        }
        msg += "must be ";
        const types = [];
        const instances = [];
        const other = [];
        for (const value of expected) {
            // assert(typeof value === 'string',
            //        'All expected entries have to be of type string');
            if (kTypes.includes(value)) {
                types.push(value.toLowerCase());
            }
            else if (classRegExp.exec(value) !== null) {
                instances.push(value);
            }
            else {
                // assert(value !== 'object',
                //        'The value "object" should be written as "Object"');
                other.push(value);
            }
        }
        // Special handle `object` in case other instances are allowed to outline
        // the differences between each other.
        if (instances.length > 0) {
            const pos = types.indexOf("object");
            if (pos !== -1) {
                types.splice(pos, 1);
                instances.push("Object");
            }
        }
        if (types.length > 0) {
            if (types.length > 2) {
                const last = types.pop();
                msg += `one of type ${types.join(", ")}, or ${last}`;
            }
            else if (types.length === 2) {
                msg += `one of type ${types[0]} or ${types[1]}`;
            }
            else {
                msg += `of type ${types[0]}`;
            }
            if (instances.length > 0 || other.length > 0)
                msg += " or ";
        }
        if (instances.length > 0) {
            if (instances.length > 2) {
                const last = instances.pop();
                msg += `an instance of ${instances.join(", ")}, or ${last}`;
            }
            else {
                msg += `an instance of ${instances[0]}`;
                if (instances.length === 2) {
                    msg += ` or ${instances[1]}`;
                }
            }
            if (other.length > 0)
                msg += " or ";
        }
        if (other.length > 0) {
            if (other.length > 2) {
                const last = other.pop();
                msg += `one of ${other.join(", ")}, or ${last}`;
            }
            else if (other.length === 2) {
                msg += `one of ${other[0]} or ${other[1]}`;
            }
            else {
                if (other[0].toLowerCase() !== other[0])
                    msg += "an ";
                msg += `${other[0]}`;
            }
        }
        msg += `. Received ${determineSpecificType(actual)}`;
        super(msg);
    }
}
export class ERR_INVALID_HTTP_TOKEN extends TypeError {
    constructor(name, field) {
        super(`${name} must be a valid HTTP token ["${field}"]`);
    }
}
export class ERR_METHOD_NOT_IMPLEMENTED extends Error {
    constructor(methodName) {
        super(`The ${methodName} method is not implemented`);
    }
}
export class ERR_STREAM_ALREADY_FINISHED extends Error {
    constructor(methodName) {
        super(`Cannot call ${methodName} after a stream was finished`);
    }
}
export class ERR_STREAM_CANNOT_PIPE extends Error {
    constructor() {
        super(`Cannot pipe, not readable`);
    }
}
export class ERR_STREAM_DESTROYED extends Error {
    constructor(methodName) {
        super(`Cannot call ${methodName} after a stream was destroyed`);
    }
}
export class ERR_STREAM_NULL_VALUES extends TypeError {
    constructor() {
        super(`May not write null values to stream`);
    }
}
export class ERR_STREAM_WRITE_AFTER_END extends Error {
    constructor() {
        super(`write after end`);
    }
}
