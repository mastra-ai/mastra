"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weakMap = void 0;
const node_crypto_1 = require("node:crypto");
const errors_js_1 = require("../util/errors.js");
const webcrypto_js_1 = require("./webcrypto.js");
const is_key_object_js_1 = require("./is_key_object.js");
const invalid_key_input_js_1 = require("../lib/invalid_key_input.js");
const is_key_like_js_1 = require("./is_key_like.js");
exports.weakMap = new WeakMap();
const namedCurveToJOSE = (namedCurve) => {
    switch (namedCurve) {
        case 'prime256v1':
            return 'P-256';
        case 'secp384r1':
            return 'P-384';
        case 'secp521r1':
            return 'P-521';
        case 'secp256k1':
            return 'secp256k1';
        default:
            throw new errors_js_1.JOSENotSupported('Unsupported key curve for this operation');
    }
};
const getNamedCurve = (kee, raw) => {
    let key;
    if ((0, webcrypto_js_1.isCryptoKey)(kee)) {
        key = node_crypto_1.KeyObject.from(kee);
    }
    else if ((0, is_key_object_js_1.default)(kee)) {
        key = kee;
    }
    else {
        throw new TypeError((0, invalid_key_input_js_1.default)(kee, ...is_key_like_js_1.types));
    }
    if (key.type === 'secret') {
        throw new TypeError('only "private" or "public" type keys can be used for this operation');
    }
    switch (key.asymmetricKeyType) {
        case 'ed25519':
        case 'ed448':
            return `Ed${key.asymmetricKeyType.slice(2)}`;
        case 'x25519':
        case 'x448':
            return `X${key.asymmetricKeyType.slice(1)}`;
        case 'ec': {
            const namedCurve = key.asymmetricKeyDetails.namedCurve;
            if (raw) {
                return namedCurve;
            }
            return namedCurveToJOSE(namedCurve);
        }
        default:
            throw new TypeError('Invalid asymmetric key type for this operation');
    }
};
exports.default = getNamedCurve;
