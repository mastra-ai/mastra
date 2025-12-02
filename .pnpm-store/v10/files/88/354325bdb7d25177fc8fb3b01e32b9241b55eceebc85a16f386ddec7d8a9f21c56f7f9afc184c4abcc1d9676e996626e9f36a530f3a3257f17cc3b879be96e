"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const base64url_js_1 = require("./base64url.js");
const errors_js_1 = require("../util/errors.js");
const webcrypto_js_1 = require("./webcrypto.js");
const is_key_object_js_1 = require("./is_key_object.js");
const invalid_key_input_js_1 = require("../lib/invalid_key_input.js");
const is_key_like_js_1 = require("./is_key_like.js");
const keyToJWK = (key) => {
    let keyObject;
    if ((0, webcrypto_js_1.isCryptoKey)(key)) {
        if (!key.extractable) {
            throw new TypeError('CryptoKey is not extractable');
        }
        keyObject = node_crypto_1.KeyObject.from(key);
    }
    else if ((0, is_key_object_js_1.default)(key)) {
        keyObject = key;
    }
    else if (key instanceof Uint8Array) {
        return {
            kty: 'oct',
            k: (0, base64url_js_1.encode)(key),
        };
    }
    else {
        throw new TypeError((0, invalid_key_input_js_1.default)(key, ...is_key_like_js_1.types, 'Uint8Array'));
    }
    if (keyObject.type !== 'secret' &&
        !['rsa', 'ec', 'ed25519', 'x25519', 'ed448', 'x448'].includes(keyObject.asymmetricKeyType)) {
        throw new errors_js_1.JOSENotSupported('Unsupported key asymmetricKeyType');
    }
    return keyObject.export({ format: 'jwk' });
};
exports.default = keyToJWK;
