import { KeyObject } from 'node:crypto';
import { encode as base64url } from './base64url.js';
import { JOSENotSupported } from '../util/errors.js';
import { isCryptoKey } from './webcrypto.js';
import isKeyObject from './is_key_object.js';
import invalidKeyInput from '../lib/invalid_key_input.js';
import { types } from './is_key_like.js';
const keyToJWK = (key) => {
    let keyObject;
    if (isCryptoKey(key)) {
        if (!key.extractable) {
            throw new TypeError('CryptoKey is not extractable');
        }
        keyObject = KeyObject.from(key);
    }
    else if (isKeyObject(key)) {
        keyObject = key;
    }
    else if (key instanceof Uint8Array) {
        return {
            kty: 'oct',
            k: base64url(key),
        };
    }
    else {
        throw new TypeError(invalidKeyInput(key, ...types, 'Uint8Array'));
    }
    if (keyObject.type !== 'secret' &&
        !['rsa', 'ec', 'ed25519', 'x25519', 'ed448', 'x448'].includes(keyObject.asymmetricKeyType)) {
        throw new JOSENotSupported('Unsupported key asymmetricKeyType');
    }
    return keyObject.export({ format: 'jwk' });
};
export default keyToJWK;
