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
var buffer_exports = {};
__export(buffer_exports, {
  bufferToFormData: () => bufferToFormData,
  bufferToString: () => bufferToString,
  equal: () => equal,
  timingSafeEqual: () => timingSafeEqual
});
module.exports = __toCommonJS(buffer_exports);
var import_crypto = require("./crypto");
const equal = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  const va = new DataView(a);
  const vb = new DataView(b);
  let i = va.byteLength;
  while (i--) {
    if (va.getUint8(i) !== vb.getUint8(i)) {
      return false;
    }
  }
  return true;
};
const timingSafeEqual = async (a, b, hashFunction) => {
  if (!hashFunction) {
    hashFunction = import_crypto.sha256;
  }
  const [sa, sb] = await Promise.all([hashFunction(a), hashFunction(b)]);
  if (!sa || !sb) {
    return false;
  }
  return sa === sb && a === b;
};
const bufferToString = (buffer) => {
  if (buffer instanceof ArrayBuffer) {
    const enc = new TextDecoder("utf-8");
    return enc.decode(buffer);
  }
  return buffer;
};
const bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      "Content-Type": contentType
    }
  });
  return response.formData();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bufferToFormData,
  bufferToString,
  equal,
  timingSafeEqual
});
