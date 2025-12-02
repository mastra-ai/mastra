'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const nodeCrypto = require('node:crypto');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const nodeCrypto__default = /*#__PURE__*/_interopDefaultCompat(nodeCrypto);

const subtle = nodeCrypto__default.webcrypto?.subtle || {};
const randomUUID = () => {
  return nodeCrypto__default.randomUUID();
};
const getRandomValues = (array) => {
  return nodeCrypto__default.webcrypto.getRandomValues(array);
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
