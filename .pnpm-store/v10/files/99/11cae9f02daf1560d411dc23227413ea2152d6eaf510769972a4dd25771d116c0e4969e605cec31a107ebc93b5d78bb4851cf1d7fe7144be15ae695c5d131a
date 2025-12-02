"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const parse = (jwk) => {
    return (jwk.d ? node_crypto_1.createPrivateKey : node_crypto_1.createPublicKey)({ format: 'jwk', key: jwk });
};
exports.default = parse;
