"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
let ciphers;
exports.default = (algorithm) => {
    ciphers ||= new Set((0, node_crypto_1.getCiphers)());
    return ciphers.has(algorithm);
};
