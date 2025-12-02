"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidPointerError = exports.TimeoutError = exports.MissingPointerError = exports.UnmatchedResolverError = exports.ResolverError = exports.UnmatchedParserError = exports.ParserError = exports.JSONParserErrorGroup = exports.JSONParserError = void 0;
exports.toJSON = toJSON;
exports.getDeepKeys = getDeepKeys;
exports.isHandledError = isHandledError;
exports.normalizeError = normalizeError;
const url_js_1 = require("./url.js");
const nonJsonTypes = ["function", "symbol", "undefined"];
const protectedProps = ["constructor", "prototype", "__proto__"];
const objectPrototype = Object.getPrototypeOf({});
/**
 * Custom JSON serializer for Error objects.
 * Returns all built-in error properties, as well as extended properties.
 */
function toJSON() {
    // HACK: We have to cast the objects to `any` so we can use symbol indexers.
    // see https://github.com/Microsoft/TypeScript/issues/1863
    const pojo = {};
    const error = this;
    for (const key of getDeepKeys(error)) {
        if (typeof key === "string") {
            const value = error[key];
            const type = typeof value;
            if (!nonJsonTypes.includes(type)) {
                pojo[key] = value;
            }
        }
    }
    return pojo;
}
/**
 * Returns own, inherited, enumerable, non-enumerable, string, and symbol keys of `obj`.
 * Does NOT return members of the base Object prototype, or the specified omitted keys.
 */
function getDeepKeys(obj, omit = []) {
    let keys = [];
    // Crawl the prototype chain, finding all the string and symbol keys
    while (obj && obj !== objectPrototype) {
        keys = keys.concat(Object.getOwnPropertyNames(obj), Object.getOwnPropertySymbols(obj));
        obj = Object.getPrototypeOf(obj);
    }
    // De-duplicate the list of keys
    const uniqueKeys = new Set(keys);
    // Remove any omitted keys
    for (const key of omit.concat(protectedProps)) {
        uniqueKeys.delete(key);
    }
    return uniqueKeys;
}
class JSONParserError extends Error {
    name;
    message;
    source;
    path;
    code;
    constructor(message, source) {
        super();
        this.code = "EUNKNOWN";
        this.name = "JSONParserError";
        this.message = message;
        this.source = source;
        this.path = null;
    }
    toJSON = toJSON.bind(this);
    get footprint() {
        return `${this.path}+${this.source}+${this.code}+${this.message}`;
    }
}
exports.JSONParserError = JSONParserError;
class JSONParserErrorGroup extends Error {
    files;
    constructor(parser) {
        super();
        this.files = parser;
        this.name = "JSONParserErrorGroup";
        this.message = `${this.errors.length} error${this.errors.length > 1 ? "s" : ""} occurred while reading '${(0, url_js_1.toFileSystemPath)(parser.$refs._root$Ref.path)}'`;
    }
    toJSON = toJSON.bind(this);
    static getParserErrors(parser) {
        const errors = [];
        for (const $ref of Object.values(parser.$refs._$refs)) {
            if ($ref.errors) {
                errors.push(...$ref.errors);
            }
        }
        return errors;
    }
    get errors() {
        return JSONParserErrorGroup.getParserErrors(this.files);
    }
}
exports.JSONParserErrorGroup = JSONParserErrorGroup;
class ParserError extends JSONParserError {
    code = "EPARSER";
    name = "ParserError";
    constructor(message, source) {
        super(`Error parsing ${source}: ${message}`, source);
    }
}
exports.ParserError = ParserError;
class UnmatchedParserError extends JSONParserError {
    code = "EUNMATCHEDPARSER";
    name = "UnmatchedParserError";
    constructor(source) {
        super(`Could not find parser for "${source}"`, source);
    }
}
exports.UnmatchedParserError = UnmatchedParserError;
class ResolverError extends JSONParserError {
    code = "ERESOLVER";
    name = "ResolverError";
    ioErrorCode;
    constructor(ex, source) {
        super(ex.message || `Error reading file "${source}"`, source);
        if ("code" in ex) {
            this.ioErrorCode = String(ex.code);
        }
    }
}
exports.ResolverError = ResolverError;
class UnmatchedResolverError extends JSONParserError {
    code = "EUNMATCHEDRESOLVER";
    name = "UnmatchedResolverError";
    constructor(source) {
        super(`Could not find resolver for "${source}"`, source);
    }
}
exports.UnmatchedResolverError = UnmatchedResolverError;
class MissingPointerError extends JSONParserError {
    code = "EMISSINGPOINTER";
    name = "MissingPointerError";
    targetToken;
    targetRef;
    targetFound;
    parentPath;
    constructor(token, path, targetRef, targetFound, parentPath) {
        super(`Missing $ref pointer "${(0, url_js_1.getHash)(path)}". Token "${token}" does not exist.`, (0, url_js_1.stripHash)(path));
        this.targetToken = token;
        this.targetRef = targetRef;
        this.targetFound = targetFound;
        this.parentPath = parentPath;
    }
}
exports.MissingPointerError = MissingPointerError;
class TimeoutError extends JSONParserError {
    code = "ETIMEOUT";
    name = "TimeoutError";
    constructor(timeout) {
        super(`Dereferencing timeout reached: ${timeout}ms`);
    }
}
exports.TimeoutError = TimeoutError;
class InvalidPointerError extends JSONParserError {
    code = "EUNMATCHEDRESOLVER";
    name = "InvalidPointerError";
    constructor(pointer, path) {
        super(`Invalid $ref pointer "${pointer}". Pointers must begin with "#/"`, (0, url_js_1.stripHash)(path));
    }
}
exports.InvalidPointerError = InvalidPointerError;
function isHandledError(err) {
    return err instanceof JSONParserError || err instanceof JSONParserErrorGroup;
}
function normalizeError(err) {
    if (err.path === null) {
        err.path = [];
    }
    return err;
}
