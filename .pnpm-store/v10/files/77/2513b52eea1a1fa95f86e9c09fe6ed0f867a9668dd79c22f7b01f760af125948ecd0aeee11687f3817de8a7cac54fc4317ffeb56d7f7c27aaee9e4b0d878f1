"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeDecryptDataKeyResponse = exports.deserializeCreateDataKeyResponse = void 0;
const deserializeCreateDataKeyResponse = (key) => ({
    context: key.context,
    dataKey: {
        key: key.data_key,
        id: key.id,
    },
    encryptedKeys: key.encrypted_keys,
});
exports.deserializeCreateDataKeyResponse = deserializeCreateDataKeyResponse;
const deserializeDecryptDataKeyResponse = (key) => ({
    key: key.data_key,
    id: key.id,
});
exports.deserializeDecryptDataKeyResponse = deserializeDecryptDataKeyResponse;
