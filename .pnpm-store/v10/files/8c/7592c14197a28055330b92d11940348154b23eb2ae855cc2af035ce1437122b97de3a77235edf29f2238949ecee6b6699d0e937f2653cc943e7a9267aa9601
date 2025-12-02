"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var streams_exports = {};
__export(streams_exports, {
  StringWriteStream: () => StringWriteStream
});
module.exports = __toCommonJS(streams_exports);
var import_stream = require("stream");
class StringWriteStream extends import_stream.Writable {
  constructor(progress) {
    super();
    this._progress = progress;
  }
  _write(chunk, encoding, callback) {
    const text = chunk.toString();
    this._progress({ message: text.endsWith("\n") ? text.slice(0, -1) : text });
    callback();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StringWriteStream
});
