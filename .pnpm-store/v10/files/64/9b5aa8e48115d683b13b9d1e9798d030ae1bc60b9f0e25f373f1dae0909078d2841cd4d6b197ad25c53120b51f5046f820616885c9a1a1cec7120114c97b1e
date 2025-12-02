'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const webCrypto = globalThis.crypto;
const subtle = webCrypto.subtle;
const randomUUID = () => {
  return webCrypto.randomUUID();
};
const getRandomValues = (array) => {
  return webCrypto.getRandomValues(array);
};
const _crypto = {
  randomUUID,
  getRandomValues,
  subtle
};

exports.default = _crypto;
exports.getRandomValues = getRandomValues;
exports.randomUUID = randomUUID;
exports.subtle = subtle;
