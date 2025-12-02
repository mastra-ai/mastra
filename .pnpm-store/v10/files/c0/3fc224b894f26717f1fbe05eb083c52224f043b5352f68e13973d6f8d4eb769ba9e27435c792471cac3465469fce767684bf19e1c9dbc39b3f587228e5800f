"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasBuiltinBrotli = exports.uniq = exports.identity = exports.parseInput = exports.makeOkError = exports.isRedirectStatus = exports.parseLocation = exports.arrayify = exports.pipeline = void 0;
const url_1 = require("url");
const zlib_1 = require("zlib");
const util_1 = require("util");
const stream = require("stream");
exports.pipeline = (0, util_1.promisify)(stream.pipeline);
function arrayify(value) {
    if (value != null && Array.isArray(value))
        return value;
    return value == null
        ? []
        : Array.isArray(value)
            ? [...value]
            : [value];
}
exports.arrayify = arrayify;
function parseLocation(location, origin) {
    if ("string" !== typeof location)
        return null;
    const originUrl = new url_1.URL(origin);
    const url = new url_1.URL(location, origin);
    return {
        url: url.href,
        isRelative: originUrl.origin === url.origin,
    };
}
exports.parseLocation = parseLocation;
exports.isRedirectStatus = {
    300: true,
    301: true,
    302: true,
    303: true,
    305: true,
    307: true,
    308: true,
};
function makeOkError(err) {
    err.metaData = err.metaData || {};
    err.metaData.ok = true;
    return err;
}
exports.makeOkError = makeOkError;
function parseInput(url) {
    const explicitProtocol = (url.startsWith("http2://") || url.startsWith("http1://"))
        ? url.substr(0, 5)
        : null;
    url = url.replace(/^http[12]:\/\//, "http://");
    const { origin, hostname, port, protocol } = new url_1.URL(url);
    return {
        hostname,
        origin,
        port: port || (protocol === "https:" ? "443" : "80"),
        protocol: explicitProtocol || protocol.replace(":", ""),
        url,
    };
}
exports.parseInput = parseInput;
const identity = (t) => t;
exports.identity = identity;
function uniq(arr, pred) {
    if (!pred)
        return Array.from(new Set(arr));
    const known = new Set();
    return arr.filter(value => {
        const u = pred(value);
        const first = !known.has(u);
        known.add(u);
        return first;
    });
}
exports.uniq = uniq;
function hasBuiltinBrotli() {
    return typeof zlib_1.createBrotliCompress === "function";
}
exports.hasBuiltinBrotli = hasBuiltinBrotli;
//# sourceMappingURL=utils.js.map