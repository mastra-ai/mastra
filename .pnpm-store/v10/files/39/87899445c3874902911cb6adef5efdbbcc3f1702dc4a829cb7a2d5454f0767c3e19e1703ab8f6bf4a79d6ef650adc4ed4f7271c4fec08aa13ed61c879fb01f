// src/utils/buffer.ts
import { sha256 } from "./crypto.js";
var equal = (a, b) => {
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
var timingSafeEqual = async (a, b, hashFunction) => {
  if (!hashFunction) {
    hashFunction = sha256;
  }
  const [sa, sb] = await Promise.all([hashFunction(a), hashFunction(b)]);
  if (!sa || !sb) {
    return false;
  }
  return sa === sb && a === b;
};
var bufferToString = (buffer) => {
  if (buffer instanceof ArrayBuffer) {
    const enc = new TextDecoder("utf-8");
    return enc.decode(buffer);
  }
  return buffer;
};
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      "Content-Type": contentType
    }
  });
  return response.formData();
};
export {
  bufferToFormData,
  bufferToString,
  equal,
  timingSafeEqual
};
