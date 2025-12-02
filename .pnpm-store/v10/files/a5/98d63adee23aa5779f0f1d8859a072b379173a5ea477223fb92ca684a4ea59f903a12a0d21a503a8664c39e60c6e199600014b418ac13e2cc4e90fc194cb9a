"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureHeaders = exports.GuardedHeaders = exports.Headers = void 0;
const utils_1 = require("./utils");
const forbiddenHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "date",
    "dnt",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "via",
];
function isForbiddenHeader(name) {
    if (name.startsWith("proxy-") || name.startsWith("sec-"))
        // Safe headers
        return false;
    return forbiddenHeaders.includes(name);
}
function isForbiddenResponseHeader(name) {
    return ["set-cookie", "set-cookie2"].includes(name);
}
function isSimpleHeader(name, value) {
    const simpleHeaders = [
        "accept",
        "accept-language",
        "content-language",
        "dpr",
        "downlink",
        "save-data",
        "viewport-width",
        "width",
    ];
    if (simpleHeaders.includes(name))
        return true;
    if (name !== "content-type")
        return false;
    if (value == null)
        return false;
    const mimeType = value.replace(/;.*/, "").toLowerCase();
    return [
        "application/x-www-form-urlencoded",
        "multipart/form-data",
        "text/plain",
    ].includes(mimeType);
}
function filterName(name) {
    if (/[^A-Za-z0-9\-#$%&'*+.\^_`|~]/.test(name))
        throw new TypeError("Invalid character in header field name: " + name);
    return name.toLowerCase();
}
function _ensureGuard(guard, name, value) {
    if (guard === "immutable")
        throw new TypeError("Header guard error: Cannot change immutable header");
    if (!name)
        return;
    if (guard === "request" && isForbiddenHeader(name))
        throw new TypeError("Header guard error: " +
            "Cannot set forbidden header for requests" +
            ` (${name})`);
    if (guard === "request-no-cors" && !isSimpleHeader(name, value))
        throw new TypeError("Header guard error: " +
            "Cannot set non-simple header for no-cors requests" +
            ` (${name})`);
    if (guard === "response" && isForbiddenResponseHeader(name))
        throw new TypeError("Header guard error: " +
            "Cannot set forbidden response header for response" +
            ` (${name})`);
}
let _guard = null;
class Headers {
    constructor(init) {
        this._guard = _guard || "none";
        _guard = null;
        this._data = new Map();
        const set = (name, values) => {
            if (values.length === 1)
                this.set(name, values[0]);
            else
                for (const value of values)
                    this.append(name, value);
        };
        if (!init)
            return;
        else if (init instanceof Headers) {
            for (const [name, values] of init._data.entries())
                set(name, values);
        }
        else {
            for (const _name of Object.keys(init)) {
                const name = filterName(_name);
                const value = (0, utils_1.arrayify)(init[_name])
                    .map(val => `${val}`);
                set(name, [...value]);
            }
        }
    }
    get [Symbol.toStringTag]() {
        return "Map"; // This causes unit test libraries to treat this as a Map
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    append(name, value) {
        const _name = filterName(name);
        _ensureGuard(this._guard, _name, value);
        if (!this._data.has(_name))
            this._data.set(_name, [value]);
        else
            this._data.get(_name).push(value);
    }
    delete(name) {
        const _name = filterName(name);
        _ensureGuard(this._guard);
        this._data.delete(_name);
    }
    *entries() {
        for (const [name, value] of this._data.entries())
            yield [name, value.join(",")];
    }
    get(name) {
        const _name = filterName(name);
        return this._data.has(_name)
            ? this._data.get(_name).join(",")
            : null;
    }
    has(name) {
        return this._data.has(filterName(name));
    }
    keys() {
        return this._data.keys();
    }
    set(name, value) {
        const _name = filterName(name);
        _ensureGuard(this._guard, _name, value);
        this._data.set(_name, [value]);
    }
    *values() {
        for (const value of this._data.values())
            yield value.join(",");
    }
    // This is non-standard, but useful
    toJSON() {
        return [...this.entries()]
            .reduce((prev, [key, val]) => Object.assign(prev, { [key]: val }), {});
    }
}
exports.Headers = Headers;
class GuardedHeaders extends Headers {
    constructor(guard, init) {
        super((_guard = guard, init));
        _guard = null;
    }
}
exports.GuardedHeaders = GuardedHeaders;
function ensureHeaders(headers) {
    return headers instanceof Headers ? headers : new Headers(headers);
}
exports.ensureHeaders = ensureHeaders;
//# sourceMappingURL=headers.js.map