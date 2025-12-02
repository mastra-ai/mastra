"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlattenedEncrypt = exports.unprotected = void 0;
const base64url_js_1 = require("../../runtime/base64url.js");
const encrypt_js_1 = require("../../runtime/encrypt.js");
const encrypt_key_management_js_1 = require("../../lib/encrypt_key_management.js");
const errors_js_1 = require("../../util/errors.js");
const is_disjoint_js_1 = require("../../lib/is_disjoint.js");
const buffer_utils_js_1 = require("../../lib/buffer_utils.js");
const validate_crit_js_1 = require("../../lib/validate_crit.js");
exports.unprotected = Symbol();
class FlattenedEncrypt {
    _plaintext;
    _protectedHeader;
    _sharedUnprotectedHeader;
    _unprotectedHeader;
    _aad;
    _cek;
    _iv;
    _keyManagementParameters;
    constructor(plaintext) {
        if (!(plaintext instanceof Uint8Array)) {
            throw new TypeError('plaintext must be an instance of Uint8Array');
        }
        this._plaintext = plaintext;
    }
    setKeyManagementParameters(parameters) {
        if (this._keyManagementParameters) {
            throw new TypeError('setKeyManagementParameters can only be called once');
        }
        this._keyManagementParameters = parameters;
        return this;
    }
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setSharedUnprotectedHeader(sharedUnprotectedHeader) {
        if (this._sharedUnprotectedHeader) {
            throw new TypeError('setSharedUnprotectedHeader can only be called once');
        }
        this._sharedUnprotectedHeader = sharedUnprotectedHeader;
        return this;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this._unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this._unprotectedHeader = unprotectedHeader;
        return this;
    }
    setAdditionalAuthenticatedData(aad) {
        this._aad = aad;
        return this;
    }
    setContentEncryptionKey(cek) {
        if (this._cek) {
            throw new TypeError('setContentEncryptionKey can only be called once');
        }
        this._cek = cek;
        return this;
    }
    setInitializationVector(iv) {
        if (this._iv) {
            throw new TypeError('setInitializationVector can only be called once');
        }
        this._iv = iv;
        return this;
    }
    async encrypt(key, options) {
        if (!this._protectedHeader && !this._unprotectedHeader && !this._sharedUnprotectedHeader) {
            throw new errors_js_1.JWEInvalid('either setProtectedHeader, setUnprotectedHeader, or sharedUnprotectedHeader must be called before #encrypt()');
        }
        if (!(0, is_disjoint_js_1.default)(this._protectedHeader, this._unprotectedHeader, this._sharedUnprotectedHeader)) {
            throw new errors_js_1.JWEInvalid('JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint');
        }
        const joseHeader = {
            ...this._protectedHeader,
            ...this._unprotectedHeader,
            ...this._sharedUnprotectedHeader,
        };
        (0, validate_crit_js_1.default)(errors_js_1.JWEInvalid, new Map(), options?.crit, this._protectedHeader, joseHeader);
        if (joseHeader.zip !== undefined) {
            throw new errors_js_1.JOSENotSupported('JWE "zip" (Compression Algorithm) Header Parameter is not supported.');
        }
        const { alg, enc } = joseHeader;
        if (typeof alg !== 'string' || !alg) {
            throw new errors_js_1.JWEInvalid('JWE "alg" (Algorithm) Header Parameter missing or invalid');
        }
        if (typeof enc !== 'string' || !enc) {
            throw new errors_js_1.JWEInvalid('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
        }
        let encryptedKey;
        if (this._cek && (alg === 'dir' || alg === 'ECDH-ES')) {
            throw new TypeError(`setContentEncryptionKey cannot be called with JWE "alg" (Algorithm) Header ${alg}`);
        }
        let cek;
        {
            let parameters;
            ({ cek, encryptedKey, parameters } = await (0, encrypt_key_management_js_1.default)(alg, enc, key, this._cek, this._keyManagementParameters));
            if (parameters) {
                if (options && exports.unprotected in options) {
                    if (!this._unprotectedHeader) {
                        this.setUnprotectedHeader(parameters);
                    }
                    else {
                        this._unprotectedHeader = { ...this._unprotectedHeader, ...parameters };
                    }
                }
                else if (!this._protectedHeader) {
                    this.setProtectedHeader(parameters);
                }
                else {
                    this._protectedHeader = { ...this._protectedHeader, ...parameters };
                }
            }
        }
        let additionalData;
        let protectedHeader;
        let aadMember;
        if (this._protectedHeader) {
            protectedHeader = buffer_utils_js_1.encoder.encode((0, base64url_js_1.encode)(JSON.stringify(this._protectedHeader)));
        }
        else {
            protectedHeader = buffer_utils_js_1.encoder.encode('');
        }
        if (this._aad) {
            aadMember = (0, base64url_js_1.encode)(this._aad);
            additionalData = (0, buffer_utils_js_1.concat)(protectedHeader, buffer_utils_js_1.encoder.encode('.'), buffer_utils_js_1.encoder.encode(aadMember));
        }
        else {
            additionalData = protectedHeader;
        }
        const { ciphertext, tag, iv } = await (0, encrypt_js_1.default)(enc, this._plaintext, cek, this._iv, additionalData);
        const jwe = {
            ciphertext: (0, base64url_js_1.encode)(ciphertext),
        };
        if (iv) {
            jwe.iv = (0, base64url_js_1.encode)(iv);
        }
        if (tag) {
            jwe.tag = (0, base64url_js_1.encode)(tag);
        }
        if (encryptedKey) {
            jwe.encrypted_key = (0, base64url_js_1.encode)(encryptedKey);
        }
        if (aadMember) {
            jwe.aad = aadMember;
        }
        if (this._protectedHeader) {
            jwe.protected = buffer_utils_js_1.decoder.decode(protectedHeader);
        }
        if (this._sharedUnprotectedHeader) {
            jwe.unprotected = this._sharedUnprotectedHeader;
        }
        if (this._unprotectedHeader) {
            jwe.header = this._unprotectedHeader;
        }
        return jwe;
    }
}
exports.FlattenedEncrypt = FlattenedEncrypt;
