"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorAttr = exports.GelError = void 0;
exports.prettyPrintError = prettyPrintError;
const buffer_1 = require("../primitives/buffer");
class GelError extends Error {
    static tags = {};
    _message;
    _query;
    _attrs;
    constructor(message, options) {
        super(undefined, options);
        Object.defineProperties(this, {
            _message: { writable: true, enumerable: false },
            _query: { writable: true, enumerable: false },
            _attrs: { writable: true, enumerable: false },
        });
        this._message = message ?? "";
    }
    get message() {
        return (this._message +
            (this._query && this._attrs
                ? prettyPrintError(this._attrs, this._query)
                : ""));
    }
    get name() {
        return this.constructor.name;
    }
    hasTag(tag) {
        const error_type = this.constructor;
        return error_type.tags[tag] ?? false;
    }
}
exports.GelError = GelError;
var ErrorAttr;
(function (ErrorAttr) {
    ErrorAttr[ErrorAttr["hint"] = 1] = "hint";
    ErrorAttr[ErrorAttr["details"] = 2] = "details";
    ErrorAttr[ErrorAttr["serverTraceback"] = 257] = "serverTraceback";
    ErrorAttr[ErrorAttr["positionStart"] = -15] = "positionStart";
    ErrorAttr[ErrorAttr["positionEnd"] = -14] = "positionEnd";
    ErrorAttr[ErrorAttr["lineStart"] = -13] = "lineStart";
    ErrorAttr[ErrorAttr["columnStart"] = -12] = "columnStart";
    ErrorAttr[ErrorAttr["utf16ColumnStart"] = -11] = "utf16ColumnStart";
    ErrorAttr[ErrorAttr["lineEnd"] = -10] = "lineEnd";
    ErrorAttr[ErrorAttr["columnEnd"] = -9] = "columnEnd";
    ErrorAttr[ErrorAttr["utf16ColumnEnd"] = -8] = "utf16ColumnEnd";
    ErrorAttr[ErrorAttr["characterStart"] = -7] = "characterStart";
    ErrorAttr[ErrorAttr["characterEnd"] = -6] = "characterEnd";
})(ErrorAttr || (exports.ErrorAttr = ErrorAttr = {}));
function tryParseInt(val) {
    if (val == null)
        return null;
    try {
        return parseInt(val instanceof Uint8Array ? buffer_1.utf8Decoder.decode(val) : val, 10);
    }
    catch {
        return null;
    }
}
function readAttrStr(val) {
    return val instanceof Uint8Array ? buffer_1.utf8Decoder.decode(val) : val ?? "";
}
function prettyPrintError(attrs, query) {
    let errMessage = "\n";
    const lineStart = tryParseInt(attrs.get(ErrorAttr.lineStart));
    const lineEnd = tryParseInt(attrs.get(ErrorAttr.lineEnd));
    const colStart = tryParseInt(attrs.get(ErrorAttr.utf16ColumnStart));
    const colEnd = tryParseInt(attrs.get(ErrorAttr.utf16ColumnEnd));
    if (lineStart != null &&
        lineEnd != null &&
        colStart != null &&
        colEnd != null) {
        const queryLines = query.split("\n");
        const lineNoWidth = lineEnd.toString().length;
        errMessage += "|".padStart(lineNoWidth + 3) + "\n";
        for (let i = lineStart; i < lineEnd + 1; i++) {
            const line = queryLines[i - 1];
            const start = i === lineStart ? colStart : 0;
            const end = i === lineEnd ? colEnd : line.length;
            errMessage += ` ${i.toString().padStart(lineNoWidth)} | ${line}\n`;
            errMessage += `${"|".padStart(lineNoWidth + 3)} ${""
                .padStart(end - start, "^")
                .padStart(end)}\n`;
        }
    }
    if (attrs.has(ErrorAttr.details)) {
        errMessage += `Details: ${readAttrStr(attrs.get(ErrorAttr.details))}\n`;
    }
    if (attrs.has(ErrorAttr.hint)) {
        errMessage += `Hint: ${readAttrStr(attrs.get(ErrorAttr.hint))}\n`;
    }
    return errMessage;
}
