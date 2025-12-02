import { KeyObject } from 'node:crypto';
import { JOSENotSupported } from '../util/errors.js';
import { isCryptoKey } from './webcrypto.js';
import isKeyObject from './is_key_object.js';
import invalidKeyInput from '../lib/invalid_key_input.js';
import { types } from './is_key_like.js';
export const weakMap = new WeakMap();
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
            throw new JOSENotSupported('Unsupported key curve for this operation');
    }
};
const getNamedCurve = (kee, raw) => {
    let key;
    if (isCryptoKey(kee)) {
        key = KeyObject.from(kee);
    }
    else if (isKeyObject(kee)) {
        key = kee;
    }
    else {
        throw new TypeError(invalidKeyInput(kee, ...types));
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
export default getNamedCurve;
