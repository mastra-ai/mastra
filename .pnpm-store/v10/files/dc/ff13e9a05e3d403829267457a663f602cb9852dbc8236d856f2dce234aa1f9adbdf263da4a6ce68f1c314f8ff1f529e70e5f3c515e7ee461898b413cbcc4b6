/*!
 Copyright (c) Peculiar Ventures, LLC
*/

import * as core from 'webcrypto-core';
import { BufferSourceConverter as BufferSourceConverter$1 } from 'webcrypto-core';
export { CryptoKey } from 'webcrypto-core';
import { Buffer as Buffer$1 } from 'buffer';
import crypto from 'crypto';
import * as process from 'process';
import { __decorate } from 'tslib';
import { JsonProp, JsonPropTypes, JsonSerializer, JsonParser } from '@peculiar/json-schema';
import { Convert, BufferSourceConverter } from 'pvtsutils';
import { AsnParser, AsnSerializer, AsnConvert } from '@peculiar/asn1-schema';

const JsonBase64UrlConverter = {
    fromJSON: (value) => Buffer$1.from(Convert.FromBase64Url(value)),
    toJSON: (value) => Convert.ToBase64Url(value),
};

class CryptoKey extends core.CryptoKey {
    constructor() {
        super(...arguments);
        this.data = Buffer$1.alloc(0);
        this.algorithm = { name: "" };
        this.extractable = false;
        this.type = "secret";
        this.usages = [];
        this.kty = "oct";
        this.alg = "";
    }
}
__decorate([
    JsonProp({ name: "ext", type: JsonPropTypes.Boolean, optional: true })
], CryptoKey.prototype, "extractable", void 0);
__decorate([
    JsonProp({ name: "key_ops", type: JsonPropTypes.String, repeated: true, optional: true })
], CryptoKey.prototype, "usages", void 0);
__decorate([
    JsonProp({ type: JsonPropTypes.String })
], CryptoKey.prototype, "kty", void 0);
__decorate([
    JsonProp({ type: JsonPropTypes.String, optional: true })
], CryptoKey.prototype, "alg", void 0);

class SymmetricKey extends CryptoKey {
    constructor() {
        super(...arguments);
        this.kty = "oct";
        this.type = "secret";
    }
}

class AsymmetricKey extends CryptoKey {
}

class AesCryptoKey extends SymmetricKey {
    get alg() {
        switch (this.algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return `A${this.algorithm.length}CBC`;
            case "AES-CTR":
                return `A${this.algorithm.length}CTR`;
            case "AES-GCM":
                return `A${this.algorithm.length}GCM`;
            case "AES-KW":
                return `A${this.algorithm.length}KW`;
            case "AES-CMAC":
                return `A${this.algorithm.length}CMAC`;
            case "AES-ECB":
                return `A${this.algorithm.length}ECB`;
            default:
                throw new core.AlgorithmError("Unsupported algorithm name");
        }
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], AesCryptoKey.prototype, "data", void 0);

class AesCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const key = new AesCryptoKey();
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto.randomBytes(algorithm.length >> 3);
        return key;
    }
    static async exportKey(format, key) {
        if (!(key instanceof AesCryptoKey)) {
            throw new Error("key: Is not AesCryptoKey");
        }
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "raw":
                return new Uint8Array(key.data).buffer;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: AesCryptoKey });
                break;
            case "raw":
                key = new AesCryptoKey();
                key.data = Buffer$1.from(keyData);
                break;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = algorithm;
        key.algorithm.length = key.data.length << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        switch (key.algorithm.length) {
            case 128:
            case 192:
            case 256:
                break;
            default:
                throw new core.OperationError("keyData: Is wrong key length");
        }
        return key;
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return this.encryptAesCBC(algorithm, key, Buffer$1.from(data));
            case "AES-CTR":
                return this.encryptAesCTR(algorithm, key, Buffer$1.from(data));
            case "AES-GCM":
                return this.encryptAesGCM(algorithm, key, Buffer$1.from(data));
            case "AES-KW":
                return this.encryptAesKW(algorithm, key, Buffer$1.from(data));
            case "AES-ECB":
                return this.encryptAesECB(algorithm, key, Buffer$1.from(data));
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        if (!(key instanceof AesCryptoKey)) {
            throw new Error("key: Is not AesCryptoKey");
        }
        switch (algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return this.decryptAesCBC(algorithm, key, Buffer$1.from(data));
            case "AES-CTR":
                return this.decryptAesCTR(algorithm, key, Buffer$1.from(data));
            case "AES-GCM":
                return this.decryptAesGCM(algorithm, key, Buffer$1.from(data));
            case "AES-KW":
                return this.decryptAesKW(algorithm, key, Buffer$1.from(data));
            case "AES-ECB":
                return this.decryptAesECB(algorithm, key, Buffer$1.from(data));
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async encryptAesCBC(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`aes-${key.algorithm.length}-cbc`, key.data, new Uint8Array(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesCBC(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`aes-${key.algorithm.length}-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesCTR(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`aes-${key.algorithm.length}-ctr`, key.data, Buffer$1.from(algorithm.counter));
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesCTR(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`aes-${key.algorithm.length}-ctr`, key.data, new Uint8Array(algorithm.counter));
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesGCM(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`aes-${key.algorithm.length}-gcm`, key.data, Buffer$1.from(algorithm.iv), {
            authTagLength: (algorithm.tagLength || 128) >> 3,
        });
        if (algorithm.additionalData) {
            cipher.setAAD(Buffer$1.from(algorithm.additionalData));
        }
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final(), cipher.getAuthTag()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesGCM(algorithm, key, data) {
        const tagLength = (algorithm.tagLength || 128) >> 3;
        const decipher = crypto.createDecipheriv(`aes-${key.algorithm.length}-gcm`, key.data, new Uint8Array(algorithm.iv), {
            authTagLength: tagLength,
        });
        const enc = data.slice(0, data.length - tagLength);
        const tag = data.slice(data.length - tagLength);
        if (algorithm.additionalData) {
            decipher.setAAD(Buffer$1.from(algorithm.additionalData));
        }
        decipher.setAuthTag(tag);
        let dec = decipher.update(enc);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesKW(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`id-aes${key.algorithm.length}-wrap`, key.data, this.AES_KW_IV);
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        return new Uint8Array(enc).buffer;
    }
    static async decryptAesKW(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`id-aes${key.algorithm.length}-wrap`, key.data, this.AES_KW_IV);
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesECB(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`aes-${key.algorithm.length}-ecb`, key.data, new Uint8Array(0));
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesECB(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`aes-${key.algorithm.length}-ecb`, key.data, new Uint8Array(0));
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
}
AesCrypto.AES_KW_IV = Buffer$1.from("A6A6A6A6A6A6A6A6", "hex");

const keyStorage = new WeakMap();
function getCryptoKey(key) {
    const res = keyStorage.get(key);
    if (!res) {
        throw new core.OperationError("Cannot get CryptoKey from secure storage");
    }
    return res;
}
function setCryptoKey(value) {
    const key = core.CryptoKey.create(value.algorithm, value.type, value.extractable, value.usages);
    Object.freeze(key);
    keyStorage.set(key, value);
    return key;
}

class AesCbcProvider extends core.AesCbcProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

const zero = Buffer$1.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const rb = Buffer$1.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 135]);
const blockSize = 16;
function bitShiftLeft(buffer) {
    const shifted = Buffer$1.alloc(buffer.length);
    const last = buffer.length - 1;
    for (let index = 0; index < last; index++) {
        shifted[index] = buffer[index] << 1;
        if (buffer[index + 1] & 0x80) {
            shifted[index] += 0x01;
        }
    }
    shifted[last] = buffer[last] << 1;
    return shifted;
}
function xor(a, b) {
    const length = Math.min(a.length, b.length);
    const output = Buffer$1.alloc(length);
    for (let index = 0; index < length; index++) {
        output[index] = a[index] ^ b[index];
    }
    return output;
}
function aes(key, message) {
    const cipher = crypto.createCipheriv(`aes${key.length << 3}`, key, zero);
    const result = cipher.update(message);
    cipher.final();
    return result;
}
function getMessageBlock(message, blockIndex) {
    const block = Buffer$1.alloc(blockSize);
    const start = blockIndex * blockSize;
    const end = start + blockSize;
    message.copy(block, 0, start, end);
    return block;
}
function getPaddedMessageBlock(message, blockIndex) {
    const block = Buffer$1.alloc(blockSize);
    const start = blockIndex * blockSize;
    const end = message.length;
    block.fill(0);
    message.copy(block, 0, start, end);
    block[end - start] = 0x80;
    return block;
}
function generateSubkeys(key) {
    const l = aes(key, zero);
    let subkey1 = bitShiftLeft(l);
    if (l[0] & 0x80) {
        subkey1 = xor(subkey1, rb);
    }
    let subkey2 = bitShiftLeft(subkey1);
    if (subkey1[0] & 0x80) {
        subkey2 = xor(subkey2, rb);
    }
    return { subkey1, subkey2 };
}
function aesCmac(key, message) {
    const subkeys = generateSubkeys(key);
    let blockCount = Math.ceil(message.length / blockSize);
    let lastBlockCompleteFlag;
    let lastBlock;
    if (blockCount === 0) {
        blockCount = 1;
        lastBlockCompleteFlag = false;
    }
    else {
        lastBlockCompleteFlag = (message.length % blockSize === 0);
    }
    const lastBlockIndex = blockCount - 1;
    if (lastBlockCompleteFlag) {
        lastBlock = xor(getMessageBlock(message, lastBlockIndex), subkeys.subkey1);
    }
    else {
        lastBlock = xor(getPaddedMessageBlock(message, lastBlockIndex), subkeys.subkey2);
    }
    let x = zero;
    let y;
    for (let index = 0; index < lastBlockIndex; index++) {
        y = xor(x, getMessageBlock(message, index));
        x = aes(key, y);
    }
    y = xor(lastBlock, x);
    return aes(key, y);
}
class AesCmacProvider extends core.AesCmacProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onSign(algorithm, key, data) {
        const result = aesCmac(getCryptoKey(key).data, Buffer$1.from(data));
        return new Uint8Array(result).buffer;
    }
    async onVerify(algorithm, key, signature, data) {
        const signature2 = await this.sign(algorithm, key, data);
        return Buffer$1.from(signature).compare(Buffer$1.from(signature2)) === 0;
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesCtrProvider extends core.AesCtrProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesGcmProvider extends core.AesGcmProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesKwProvider extends core.AesKwProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const res = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesEcbProvider extends core.AesEcbProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class DesCryptoKey extends SymmetricKey {
    get alg() {
        switch (this.algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return `DES-CBC`;
            case "DES-EDE3-CBC":
                return `3DES-CBC`;
            default:
                throw new core.AlgorithmError("Unsupported algorithm name");
        }
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], DesCryptoKey.prototype, "data", void 0);

class DesCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const key = new DesCryptoKey();
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto.randomBytes(algorithm.length >> 3);
        return key;
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "raw":
                return new Uint8Array(key.data).buffer;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: DesCryptoKey });
                break;
            case "raw":
                key = new DesCryptoKey();
                key.data = Buffer$1.from(keyData);
                break;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return this.encryptDesCBC(algorithm, key, Buffer$1.from(data));
            case "DES-EDE3-CBC":
                return this.encryptDesEDE3CBC(algorithm, key, Buffer$1.from(data));
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        if (!(key instanceof DesCryptoKey)) {
            throw new Error("key: Is not DesCryptoKey");
        }
        switch (algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return this.decryptDesCBC(algorithm, key, Buffer$1.from(data));
            case "DES-EDE3-CBC":
                return this.decryptDesEDE3CBC(algorithm, key, Buffer$1.from(data));
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async encryptDesCBC(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`des-cbc`, key.data, new Uint8Array(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptDesCBC(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`des-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptDesEDE3CBC(algorithm, key, data) {
        const cipher = crypto.createCipheriv(`des-ede3-cbc`, key.data, Buffer$1.from(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer$1.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptDesEDE3CBC(algorithm, key, data) {
        const decipher = crypto.createDecipheriv(`des-ede3-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer$1.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
}

class DesCbcProvider extends core.DesProvider {
    constructor() {
        super(...arguments);
        this.keySizeBits = 64;
        this.ivSize = 8;
        this.name = "DES-CBC";
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await DesCrypto.generateKey({
            name: this.name,
            length: this.keySizeBits,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return DesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return DesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return DesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await DesCrypto.importKey(format, keyData, { name: this.name, length: this.keySizeBits }, extractable, keyUsages);
        if (key.data.length !== (this.keySizeBits >> 3)) {
            throw new core.OperationError("keyData: Wrong key size");
        }
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof DesCryptoKey)) {
            throw new TypeError("key: Is not a DesCryptoKey");
        }
    }
}

class DesEde3CbcProvider extends core.DesProvider {
    constructor() {
        super(...arguments);
        this.keySizeBits = 192;
        this.ivSize = 8;
        this.name = "DES-EDE3-CBC";
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await DesCrypto.generateKey({
            name: this.name,
            length: this.keySizeBits,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return DesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return DesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return DesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await DesCrypto.importKey(format, keyData, { name: this.name, length: this.keySizeBits }, extractable, keyUsages);
        if (key.data.length !== (this.keySizeBits >> 3)) {
            throw new core.OperationError("keyData: Wrong key size");
        }
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof DesCryptoKey)) {
            throw new TypeError("key: Is not a DesCryptoKey");
        }
    }
}

function getJwkAlgorithm(algorithm) {
    switch (algorithm.name.toUpperCase()) {
        case "RSA-OAEP": {
            const mdSize = /(\d+)$/.exec(algorithm.hash.name)[1];
            return `RSA-OAEP${mdSize !== "1" ? `-${mdSize}` : ""}`;
        }
        case "RSASSA-PKCS1-V1_5":
            return `RS${/(\d+)$/.exec(algorithm.hash.name)[1]}`;
        case "RSA-PSS":
            return `PS${/(\d+)$/.exec(algorithm.hash.name)[1]}`;
        case "RSA-PKCS1":
            return `RS1`;
        default:
            throw new core.OperationError("algorithm: Is not recognized");
    }
}

class RsaPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, core.asn1.RsaPrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "RSA",
            alg: getJwkAlgorithm(this.algorithm),
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        const key = JsonParser.fromJSON(json, { targetSchema: core.asn1.RsaPrivateKey });
        const keyInfo = new core.asn1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.privateKeyAlgorithm.parameters = null;
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
    }
}

class RsaPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PublicKeyInfo);
        return AsnParser.parse(keyInfo.publicKey, core.asn1.RsaPublicKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "RSA",
            alg: getJwkAlgorithm(this.algorithm),
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        const key = JsonParser.fromJSON(json, { targetSchema: core.asn1.RsaPublicKey });
        const keyInfo = new core.asn1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.publicKeyAlgorithm.parameters = null;
        keyInfo.publicKey = AsnSerializer.serialize(key);
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
    }
}

class RsaCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new RsaPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new RsaPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const publicExponent = Buffer$1.concat([
            Buffer$1.alloc(4 - algorithm.publicExponent.byteLength, 0),
            Buffer$1.from(algorithm.publicExponent),
        ]).readInt32BE(0);
        const keys = crypto.generateKeyPairSync("rsa", {
            modulusLength: algorithm.modulusLength,
            publicExponent,
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            default:
                throw new core.OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: core.asn1.RsaPrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: core.asn1.RsaPublicKey });
                    return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
                }
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PublicKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.publicKey, core.asn1.RsaPublicKey);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, core.asn1.RsaPrivateKey);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new core.OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
        }
    }
    static async sign(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-PSS":
            case "RSASSA-PKCS1-V1_5":
                return this.signRsa(algorithm, key, data);
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async verify(algorithm, key, signature, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-PSS":
            case "RSASSA-PKCS1-V1_5":
                return this.verifySSA(algorithm, key, data, signature);
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-OAEP":
                return this.encryptOAEP(algorithm, key, data);
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-OAEP":
                return this.decryptOAEP(algorithm, key, data);
            default:
                throw new core.OperationError("algorithm: Is not recognized");
        }
    }
    static importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new core.asn1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.privateKeyAlgorithm.parameters = null;
        keyInfo.privateKey = AsnSerializer.serialize(asnKey);
        const key = new RsaPrivateKey();
        key.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.algorithm.publicExponent = new Uint8Array(asnKey.publicExponent);
        key.algorithm.modulusLength = asnKey.modulus.byteLength << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new core.asn1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.publicKeyAlgorithm.parameters = null;
        keyInfo.publicKey = AsnSerializer.serialize(asnKey);
        const key = new RsaPublicKey();
        key.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.algorithm.publicExponent = new Uint8Array(asnKey.publicExponent);
        key.algorithm.modulusLength = asnKey.modulus.byteLength << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static getCryptoAlgorithm(alg) {
        switch (alg.hash.name.toUpperCase()) {
            case "SHA-1":
                return "RSA-SHA1";
            case "SHA-256":
                return "RSA-SHA256";
            case "SHA-384":
                return "RSA-SHA384";
            case "SHA-512":
                return "RSA-SHA512";
            case "SHA3-256":
                return "RSA-SHA3-256";
            case "SHA3-384":
                return "RSA-SHA3-384";
            case "SHA3-512":
                return "RSA-SHA3-512";
            default:
                throw new core.OperationError("algorithm.hash: Is not recognized");
        }
    }
    static signRsa(algorithm, key, data) {
        const cryptoAlg = this.getCryptoAlgorithm(key.algorithm);
        const signer = crypto.createSign(cryptoAlg);
        signer.update(Buffer$1.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        if (algorithm.name.toUpperCase() === "RSA-PSS") {
            options.padding = crypto.constants.RSA_PKCS1_PSS_PADDING;
            options.saltLength = algorithm.saltLength;
        }
        const signature = signer.sign(options);
        return new Uint8Array(signature).buffer;
    }
    static verifySSA(algorithm, key, data, signature) {
        const cryptoAlg = this.getCryptoAlgorithm(key.algorithm);
        const signer = crypto.createVerify(cryptoAlg);
        signer.update(Buffer$1.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        if (algorithm.name.toUpperCase() === "RSA-PSS") {
            options.padding = crypto.constants.RSA_PKCS1_PSS_PADDING;
            options.saltLength = algorithm.saltLength;
        }
        const ok = signer.verify(options, signature);
        return ok;
    }
    static encryptOAEP(algorithm, key, data) {
        const options = {
            key: `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        };
        if (algorithm.label) ;
        return new Uint8Array(crypto.publicEncrypt(options, data)).buffer;
    }
    static decryptOAEP(algorithm, key, data) {
        const options = {
            key: `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        };
        if (algorithm.label) ;
        return new Uint8Array(crypto.privateDecrypt(options, data)).buffer;
    }
}
RsaCrypto.publicKeyUsages = ["verify", "encrypt", "wrapKey"];
RsaCrypto.privateKeyUsages = ["sign", "decrypt", "unwrapKey"];

class RsaSsaProvider extends core.RsaSsaProvider {
    constructor() {
        super(...arguments);
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return RsaCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return RsaCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
}

class RsaPssProvider extends core.RsaPssProvider {
    constructor() {
        super(...arguments);
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return RsaCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return RsaCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
}

class ShaCrypto {
    static size(algorithm) {
        switch (algorithm.name.toUpperCase()) {
            case "SHA-1":
                return 160;
            case "SHA-256":
            case "SHA3-256":
                return 256;
            case "SHA-384":
            case "SHA3-384":
                return 384;
            case "SHA-512":
            case "SHA3-512":
                return 512;
            default:
                throw new Error("Unrecognized name");
        }
    }
    static getAlgorithmName(algorithm) {
        switch (algorithm.name.toUpperCase()) {
            case "SHA-1":
                return "sha1";
            case "SHA-256":
                return "sha256";
            case "SHA-384":
                return "sha384";
            case "SHA-512":
                return "sha512";
            case "SHA3-256":
                return "sha3-256";
            case "SHA3-384":
                return "sha3-384";
            case "SHA3-512":
                return "sha3-512";
            default:
                throw new Error("Unrecognized name");
        }
    }
    static digest(algorithm, data) {
        const hashAlg = this.getAlgorithmName(algorithm);
        const hash = crypto.createHash(hashAlg)
            .update(Buffer$1.from(data)).digest();
        return new Uint8Array(hash).buffer;
    }
}

class RsaOaepProvider extends core.RsaOaepProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onEncrypt(algorithm, key, data) {
        const internalKey = getCryptoKey(key);
        const dataView = new Uint8Array(data);
        const keySize = Math.ceil(internalKey.algorithm.modulusLength >> 3);
        const hashSize = ShaCrypto.size(internalKey.algorithm.hash) >> 3;
        const dataLength = dataView.byteLength;
        const psLength = keySize - dataLength - 2 * hashSize - 2;
        if (dataLength > keySize - 2 * hashSize - 2) {
            throw new Error("Data too large");
        }
        const message = new Uint8Array(keySize);
        const seed = message.subarray(1, hashSize + 1);
        const dataBlock = message.subarray(hashSize + 1);
        dataBlock.set(dataView, hashSize + psLength + 1);
        const labelHash = crypto.createHash(internalKey.algorithm.hash.name.replace("-", ""))
            .update(core.BufferSourceConverter.toUint8Array(algorithm.label || new Uint8Array(0)))
            .digest();
        dataBlock.set(labelHash, 0);
        dataBlock[hashSize + psLength] = 1;
        crypto.randomFillSync(seed);
        const dataBlockMask = this.mgf1(internalKey.algorithm.hash, seed, dataBlock.length);
        for (let i = 0; i < dataBlock.length; i++) {
            dataBlock[i] ^= dataBlockMask[i];
        }
        const seedMask = this.mgf1(internalKey.algorithm.hash, dataBlock, seed.length);
        for (let i = 0; i < seed.length; i++) {
            seed[i] ^= seedMask[i];
        }
        if (!internalKey.pem) {
            internalKey.pem = `-----BEGIN PUBLIC KEY-----\n${internalKey.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const pkcs0 = crypto.publicEncrypt({
            key: internalKey.pem,
            padding: crypto.constants.RSA_NO_PADDING,
        }, Buffer$1.from(message));
        return new Uint8Array(pkcs0).buffer;
    }
    async onDecrypt(algorithm, key, data) {
        const internalKey = getCryptoKey(key);
        const keySize = Math.ceil(internalKey.algorithm.modulusLength >> 3);
        const hashSize = ShaCrypto.size(internalKey.algorithm.hash) >> 3;
        const dataLength = data.byteLength;
        if (dataLength !== keySize) {
            throw new Error("Bad data");
        }
        if (!internalKey.pem) {
            internalKey.pem = `-----BEGIN PRIVATE KEY-----\n${internalKey.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        let pkcs0 = crypto.privateDecrypt({
            key: internalKey.pem,
            padding: crypto.constants.RSA_NO_PADDING,
        }, Buffer$1.from(data));
        const z = pkcs0[0];
        const seed = pkcs0.subarray(1, hashSize + 1);
        const dataBlock = pkcs0.subarray(hashSize + 1);
        if (z !== 0) {
            throw new Error("Decryption failed");
        }
        const seedMask = this.mgf1(internalKey.algorithm.hash, dataBlock, seed.length);
        for (let i = 0; i < seed.length; i++) {
            seed[i] ^= seedMask[i];
        }
        const dataBlockMask = this.mgf1(internalKey.algorithm.hash, seed, dataBlock.length);
        for (let i = 0; i < dataBlock.length; i++) {
            dataBlock[i] ^= dataBlockMask[i];
        }
        const labelHash = crypto.createHash(internalKey.algorithm.hash.name.replace("-", ""))
            .update(core.BufferSourceConverter.toUint8Array(algorithm.label || new Uint8Array(0)))
            .digest();
        for (let i = 0; i < hashSize; i++) {
            if (labelHash[i] !== dataBlock[i]) {
                throw new Error("Decryption failed");
            }
        }
        let psEnd = hashSize;
        for (; psEnd < dataBlock.length; psEnd++) {
            const psz = dataBlock[psEnd];
            if (psz === 1) {
                break;
            }
            if (psz !== 0) {
                throw new Error("Decryption failed");
            }
        }
        if (psEnd === dataBlock.length) {
            throw new Error("Decryption failed");
        }
        pkcs0 = dataBlock.subarray(psEnd + 1);
        return new Uint8Array(pkcs0).buffer;
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
    mgf1(algorithm, seed, length = 0) {
        const hashSize = ShaCrypto.size(algorithm) >> 3;
        const mask = new Uint8Array(length);
        const counter = new Uint8Array(4);
        const chunks = Math.ceil(length / hashSize);
        for (let i = 0; i < chunks; i++) {
            counter[0] = i >>> 24;
            counter[1] = (i >>> 16) & 255;
            counter[2] = (i >>> 8) & 255;
            counter[3] = i & 255;
            const submask = mask.subarray(i * hashSize);
            let chunk = crypto.createHash(algorithm.name.replace("-", ""))
                .update(seed)
                .update(counter)
                .digest();
            if (chunk.length > submask.length) {
                chunk = chunk.subarray(0, submask.length);
            }
            submask.set(chunk);
        }
        return mask;
    }
}

class RsaEsProvider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "RSAES-PKCS1-v1_5";
        this.usages = {
            publicKey: ["encrypt", "wrapKey"],
            privateKey: ["decrypt", "unwrapKey"],
        };
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "publicExponent");
        if (!(algorithm.publicExponent && algorithm.publicExponent instanceof Uint8Array)) {
            throw new TypeError("publicExponent: Missing or not a Uint8Array");
        }
        const publicExponent = Convert.ToBase64(algorithm.publicExponent);
        if (!(publicExponent === "Aw==" || publicExponent === "AQAB")) {
            throw new TypeError("publicExponent: Must be [3] or [1,0,1]");
        }
        this.checkRequiredProperty(algorithm, "modulusLength");
        switch (algorithm.modulusLength) {
            case 1024:
            case 2048:
            case 4096:
                break;
            default:
                throw new TypeError("modulusLength: Must be 1024, 2048, or 4096");
        }
    }
    async onEncrypt(algorithm, key, data) {
        const options = this.toCryptoOptions(key);
        const enc = crypto.publicEncrypt(options, new Uint8Array(data));
        return new Uint8Array(enc).buffer;
    }
    async onDecrypt(algorithm, key, data) {
        const options = this.toCryptoOptions(key);
        const dec = crypto.privateDecrypt(options, new Uint8Array(data));
        return new Uint8Array(dec).buffer;
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
    toCryptoOptions(key) {
        const type = key.type.toUpperCase();
        return {
            key: `-----BEGIN ${type} KEY-----\n${getCryptoKey(key).data.toString("base64")}\n-----END ${type} KEY-----`,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        };
    }
}

const namedOIDs = {
    "1.2.840.10045.3.1.7": "P-256",
    "P-256": "1.2.840.10045.3.1.7",
    "1.3.132.0.34": "P-384",
    "P-384": "1.3.132.0.34",
    "1.3.132.0.35": "P-521",
    "P-521": "1.3.132.0.35",
    "1.3.132.0.10": "K-256",
    "K-256": "1.3.132.0.10",
    "brainpoolP160r1": "1.3.36.3.3.2.8.1.1.1",
    "1.3.36.3.3.2.8.1.1.1": "brainpoolP160r1",
    "brainpoolP160t1": "1.3.36.3.3.2.8.1.1.2",
    "1.3.36.3.3.2.8.1.1.2": "brainpoolP160t1",
    "brainpoolP192r1": "1.3.36.3.3.2.8.1.1.3",
    "1.3.36.3.3.2.8.1.1.3": "brainpoolP192r1",
    "brainpoolP192t1": "1.3.36.3.3.2.8.1.1.4",
    "1.3.36.3.3.2.8.1.1.4": "brainpoolP192t1",
    "brainpoolP224r1": "1.3.36.3.3.2.8.1.1.5",
    "1.3.36.3.3.2.8.1.1.5": "brainpoolP224r1",
    "brainpoolP224t1": "1.3.36.3.3.2.8.1.1.6",
    "1.3.36.3.3.2.8.1.1.6": "brainpoolP224t1",
    "brainpoolP256r1": "1.3.36.3.3.2.8.1.1.7",
    "1.3.36.3.3.2.8.1.1.7": "brainpoolP256r1",
    "brainpoolP256t1": "1.3.36.3.3.2.8.1.1.8",
    "1.3.36.3.3.2.8.1.1.8": "brainpoolP256t1",
    "brainpoolP320r1": "1.3.36.3.3.2.8.1.1.9",
    "1.3.36.3.3.2.8.1.1.9": "brainpoolP320r1",
    "brainpoolP320t1": "1.3.36.3.3.2.8.1.1.10",
    "1.3.36.3.3.2.8.1.1.10": "brainpoolP320t1",
    "brainpoolP384r1": "1.3.36.3.3.2.8.1.1.11",
    "1.3.36.3.3.2.8.1.1.11": "brainpoolP384r1",
    "brainpoolP384t1": "1.3.36.3.3.2.8.1.1.12",
    "1.3.36.3.3.2.8.1.1.12": "brainpoolP384t1",
    "brainpoolP512r1": "1.3.36.3.3.2.8.1.1.13",
    "1.3.36.3.3.2.8.1.1.13": "brainpoolP512r1",
    "brainpoolP512t1": "1.3.36.3.3.2.8.1.1.14",
    "1.3.36.3.3.2.8.1.1.14": "brainpoolP512t1",
};
function getOidByNamedCurve$1(namedCurve) {
    const oid = namedOIDs[namedCurve];
    if (!oid) {
        throw new core.OperationError(`Cannot convert WebCrypto named curve '${namedCurve}' to OID`);
    }
    return oid;
}

class EcPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, core.asn1.EcPrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "EC",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new core.OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const keyInfo = new core.asn1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.privateKeyAlgorithm.parameters = AsnSerializer.serialize(new core.asn1.ObjectIdentifier(getOidByNamedCurve$1(json.crv)));
        const key = JsonParser.fromJSON(json, { targetSchema: core.asn1.EcPrivateKey });
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EcPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PublicKeyInfo);
        return new core.asn1.EcPublicKey(keyInfo.publicKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "EC",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new core.OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const key = JsonParser.fromJSON(json, { targetSchema: core.asn1.EcPublicKey });
        const keyInfo = new core.asn1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.publicKeyAlgorithm.parameters = AsnSerializer.serialize(new core.asn1.ObjectIdentifier(getOidByNamedCurve$1(json.crv)));
        keyInfo.publicKey = AsnSerializer.toASN(key).valueHex;
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class Sha1Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-1";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha256Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-256";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha384Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-384";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha512Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-512";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3256Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-256";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3384Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-384";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3512Provider extends core.ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-512";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class EcCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new EcPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new EcPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const keys = crypto.generateKeyPairSync("ec", {
            namedCurve: this.getOpenSSLNamedCurve(algorithm.namedCurve),
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async sign(algorithm, key, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(algorithm.hash);
        const signer = crypto.createSign(cryptoAlg);
        signer.update(Buffer$1.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const signature = signer.sign(options);
        const ecSignature = AsnParser.parse(signature, core.asn1.EcDsaSignature);
        const signatureRaw = core.EcUtils.encodeSignature(ecSignature, core.EcCurves.get(key.algorithm.namedCurve).size);
        return signatureRaw.buffer;
    }
    static async verify(algorithm, key, signature, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(algorithm.hash);
        const signer = crypto.createVerify(cryptoAlg);
        signer.update(Buffer$1.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const ecSignature = new core.asn1.EcDsaSignature();
        const namedCurve = core.EcCurves.get(key.algorithm.namedCurve);
        const signaturePoint = core.EcUtils.decodeSignature(signature, namedCurve.size);
        ecSignature.r = BufferSourceConverter.toArrayBuffer(signaturePoint.r);
        ecSignature.s = BufferSourceConverter.toArrayBuffer(signaturePoint.s);
        const ecSignatureRaw = Buffer$1.from(AsnSerializer.serialize(ecSignature));
        const ok = signer.verify(options, ecSignatureRaw);
        return ok;
    }
    static async deriveBits(algorithm, baseKey, length) {
        const cryptoAlg = this.getOpenSSLNamedCurve(baseKey.algorithm.namedCurve);
        const ecdh = crypto.createECDH(cryptoAlg);
        const asnPrivateKey = AsnParser.parse(baseKey.data, core.asn1.PrivateKeyInfo);
        const asnEcPrivateKey = AsnParser.parse(asnPrivateKey.privateKey, core.asn1.EcPrivateKey);
        ecdh.setPrivateKey(Buffer$1.from(asnEcPrivateKey.privateKey));
        const asnPublicKey = AsnParser.parse(algorithm.public.data, core.asn1.PublicKeyInfo);
        const bits = ecdh.computeSecret(Buffer$1.from(asnPublicKey.publicKey));
        if (length === null) {
            return bits;
        }
        return new Uint8Array(bits).buffer.slice(0, length >> 3);
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            case "raw": {
                const publicKeyInfo = AsnParser.parse(key.data, core.asn1.PublicKeyInfo);
                return publicKeyInfo.publicKey;
            }
            default:
                throw new core.OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: core.asn1.EcPrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: core.asn1.EcPublicKey });
                    return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
                }
            }
            case "raw": {
                const asnKey = new core.asn1.EcPublicKey(keyData);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PublicKeyInfo);
                const asnKey = new core.asn1.EcPublicKey(keyInfo.publicKey);
                this.assertKeyParameters(keyInfo.publicKeyAlgorithm.parameters, algorithm.namedCurve);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, core.asn1.EcPrivateKey);
                this.assertKeyParameters(keyInfo.privateKeyAlgorithm.parameters, algorithm.namedCurve);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new core.OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
        }
    }
    static assertKeyParameters(parameters, namedCurve) {
        if (!parameters) {
            throw new core.CryptoError("Key info doesn't have required parameters");
        }
        let namedCurveIdentifier = "";
        try {
            namedCurveIdentifier = AsnParser.parse(parameters, core.asn1.ObjectIdentifier).value;
        }
        catch (e) {
            throw new core.CryptoError("Cannot read key info parameters");
        }
        if (getOidByNamedCurve$1(namedCurve) !== namedCurveIdentifier) {
            throw new core.CryptoError("Key info parameter doesn't match to named curve");
        }
    }
    static async importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new core.asn1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.privateKeyAlgorithm.parameters = AsnSerializer.serialize(new core.asn1.ObjectIdentifier(getOidByNamedCurve$1(algorithm.namedCurve)));
        keyInfo.privateKey = AsnSerializer.serialize(asnKey);
        const key = new EcPrivateKey();
        key.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new core.asn1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        const namedCurve = getOidByNamedCurve$1(algorithm.namedCurve);
        keyInfo.publicKeyAlgorithm.parameters = AsnSerializer.serialize(new core.asn1.ObjectIdentifier(namedCurve));
        keyInfo.publicKey = asnKey.value;
        const key = new EcPublicKey();
        key.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static getOpenSSLNamedCurve(curve) {
        switch (curve.toUpperCase()) {
            case "P-256":
                return "prime256v1";
            case "K-256":
                return "secp256k1";
            case "P-384":
                return "secp384r1";
            case "P-521":
                return "secp521r1";
            default:
                return curve;
        }
    }
}
EcCrypto.publicKeyUsages = ["verify"];
EcCrypto.privateKeyUsages = ["sign", "deriveKey", "deriveBits"];

class EcdsaProvider extends core.EcdsaProvider {
    constructor() {
        super(...arguments);
        this.namedCurves = core.EcCurves.names;
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EcCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return EcCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return EcCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return EcCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EcCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof EcPrivateKey || internalKey instanceof EcPublicKey)) {
            throw new TypeError("key: Is not EC CryptoKey");
        }
    }
}

class EcdhProvider extends core.EcdhProvider {
    constructor() {
        super(...arguments);
        this.namedCurves = core.EcCurves.names;
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EcCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onExportKey(format, key) {
        return EcCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EcCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof EcPrivateKey || internalKey instanceof EcPublicKey)) {
            throw new TypeError("key: Is not EC CryptoKey");
        }
    }
    async onDeriveBits(algorithm, baseKey, length) {
        const bits = await EcCrypto.deriveBits({ ...algorithm, public: getCryptoKey(algorithm.public) }, getCryptoKey(baseKey), length);
        return bits;
    }
}

const edOIDs = {
    [core.asn1.idEd448]: "Ed448",
    "ed448": core.asn1.idEd448,
    [core.asn1.idX448]: "X448",
    "x448": core.asn1.idX448,
    [core.asn1.idEd25519]: "Ed25519",
    "ed25519": core.asn1.idEd25519,
    [core.asn1.idX25519]: "X25519",
    "x25519": core.asn1.idX25519,
};
function getOidByNamedCurve(namedCurve) {
    const oid = edOIDs[namedCurve.toLowerCase()];
    if (!oid) {
        throw new core.OperationError(`Cannot convert WebCrypto named curve '${namedCurve}' to OID`);
    }
    return oid;
}

class EdPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, core.asn1.CurvePrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "OKP",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new core.OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const keyInfo = new core.asn1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = getOidByNamedCurve(json.crv);
        const key = JsonParser.fromJSON(json, { targetSchema: core.asn1.CurvePrivateKey });
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EdPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, core.asn1.PublicKeyInfo);
        return keyInfo.publicKey;
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "OKP",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, {
            x: Convert.ToBase64Url(key)
        });
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new core.OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        if (!json.x) {
            throw new core.OperationError(`Cannot get property from JWK. Property 'x' is required`);
        }
        const keyInfo = new core.asn1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = getOidByNamedCurve(json.crv);
        keyInfo.publicKey = Convert.FromBase64Url(json.x);
        this.data = Buffer$1.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EdCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new EdPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new EdPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const type = algorithm.namedCurve.toLowerCase();
        const keys = crypto.generateKeyPairSync(type, {
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async sign(algorithm, key, data) {
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const signature = crypto.sign(null, Buffer$1.from(data), options);
        return core.BufferSourceConverter.toArrayBuffer(signature);
    }
    static async verify(algorithm, key, signature, data) {
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const ok = crypto.verify(null, Buffer$1.from(data), options, Buffer$1.from(signature));
        return ok;
    }
    static async deriveBits(algorithm, baseKey, length) {
        const publicKey = crypto.createPublicKey({
            key: algorithm.public.data,
            format: "der",
            type: "spki",
        });
        const privateKey = crypto.createPrivateKey({
            key: baseKey.data,
            format: "der",
            type: "pkcs8",
        });
        const bits = crypto.diffieHellman({
            publicKey,
            privateKey,
        });
        return new Uint8Array(bits).buffer.slice(0, length >> 3);
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            case "raw": {
                const publicKeyInfo = AsnParser.parse(key.data, core.asn1.PublicKeyInfo);
                return publicKeyInfo.publicKey;
            }
            default:
                throw new core.OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: core.asn1.CurvePrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    if (!jwk.x) {
                        throw new TypeError("keyData: Cannot get required 'x' filed");
                    }
                    return this.importPublicKey(Convert.FromBase64Url(jwk.x), algorithm, extractable, keyUsages);
                }
            }
            case "raw": {
                return this.importPublicKey(keyData, algorithm, extractable, keyUsages);
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PublicKeyInfo);
                return this.importPublicKey(keyInfo.publicKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), core.asn1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, core.asn1.CurvePrivateKey);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new core.OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
        }
    }
    static importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const key = new EdPrivateKey();
        key.fromJSON({
            crv: algorithm.namedCurve,
            d: Convert.ToBase64Url(asnKey.d),
        });
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const key = new EdPublicKey();
        key.fromJSON({
            crv: algorithm.namedCurve,
            x: Convert.ToBase64Url(asnKey),
        });
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
}
EdCrypto.publicKeyUsages = ["verify"];
EdCrypto.privateKeyUsages = ["sign", "deriveKey", "deriveBits"];

class EdDsaProvider extends core.EdDsaProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EdCrypto.generateKey({
            name: this.name,
            namedCurve: algorithm.namedCurve.replace(/^ed/i, "Ed"),
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return EdCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return EdCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return EdCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EdCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
}

class EcdhEsProvider extends core.EcdhEsProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EdCrypto.generateKey({
            name: this.name,
            namedCurve: algorithm.namedCurve.toUpperCase(),
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onDeriveBits(algorithm, baseKey, length) {
        const bits = await EdCrypto.deriveBits({ ...algorithm, public: getCryptoKey(algorithm.public) }, getCryptoKey(baseKey), length);
        return bits;
    }
    async onExportKey(format, key) {
        return EdCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EdCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
}

class Ed25519CryptoKey extends CryptoKey {
    constructor(algorithm, extractable, usages, data) {
        super();
        this.algorithm = algorithm;
        this.extractable = extractable;
        this.usages = usages;
        this.data = Buffer.from(data);
    }
    toJWK() {
        return {
            kty: "OKP",
            crv: this.algorithm.name,
            key_ops: this.usages,
            ext: this.extractable,
        };
    }
}

class Ed25519PrivateKey extends Ed25519CryptoKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    toJWK() {
        const pubJwk = crypto.createPublicKey({
            key: this.data,
            format: "pem",
        }).export({ format: "jwk" });
        const raw = core.PemConverter.toUint8Array(this.data.toString());
        const pkcs8 = AsnConvert.parse(raw, core.asn1.PrivateKeyInfo);
        const d = AsnConvert.parse(pkcs8.privateKey, core.asn1.EdPrivateKey).value;
        return {
            ...super.toJWK(),
            ...pubJwk,
            d: Buffer.from(new Uint8Array(d)).toString("base64url"),
        };
    }
}

class Ed25519PublicKey extends Ed25519CryptoKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    toJWK() {
        const jwk = crypto.createPublicKey({
            key: this.data,
            format: "pem",
        }).export({ format: "jwk" });
        return {
            ...super.toJWK(),
            ...jwk,
        };
    }
}

class Ed25519Crypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const type = algorithm.name.toLowerCase();
        const keys = crypto.generateKeyPairSync(type, {
            publicKeyEncoding: {
                format: "pem",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "pem",
                type: "pkcs8",
            },
        });
        const keyAlg = {
            name: type === "ed25519" ? "Ed25519" : "X25519",
        };
        const privateKeyUsages = keyUsages.filter((usage) => this.privateKeyUsages.includes(usage));
        const publicKeyUsages = keyUsages.filter((usage) => this.publicKeyUsages.includes(usage));
        return {
            privateKey: new Ed25519PrivateKey(keyAlg, extractable, privateKeyUsages, keys.privateKey),
            publicKey: new Ed25519PublicKey(keyAlg, true, publicKeyUsages, keys.publicKey),
        };
    }
    static async sign(algorithm, key, data) {
        const signature = crypto.sign(null, Buffer.from(data), key.data);
        return core.BufferSourceConverter.toArrayBuffer(signature);
    }
    static async verify(algorithm, key, signature, data) {
        return crypto.verify(null, Buffer.from(data), key.data, signature);
    }
    static async exportKey(format, key) {
        switch (format) {
            case "jwk":
                return key.toJWK();
            case "pkcs8": {
                return core.PemConverter.toArrayBuffer(key.data.toString());
            }
            case "spki": {
                return core.PemConverter.toArrayBuffer(key.data.toString());
            }
            case "raw": {
                const jwk = key.toJWK();
                return Convert.FromBase64Url(jwk.x);
            }
            default:
                return Promise.reject(new core.OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'"));
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const privateData = new core.asn1.EdPrivateKey();
                    privateData.value = core.BufferSourceConverter.toArrayBuffer(Buffer.from(jwk.d, "base64url"));
                    const pkcs8 = new core.asn1.PrivateKeyInfo();
                    pkcs8.privateKeyAlgorithm.algorithm = algorithm.name.toLowerCase() === "ed25519"
                        ? core.asn1.idEd25519
                        : core.asn1.idX25519;
                    pkcs8.privateKey = AsnConvert.serialize(privateData);
                    const raw = AsnConvert.serialize(pkcs8);
                    const pem = core.PemConverter.fromBufferSource(raw, "PRIVATE KEY");
                    return new Ed25519PrivateKey(algorithm, extractable, keyUsages, pem);
                }
                else if (jwk.x) {
                    const pubKey = crypto.createPublicKey({
                        format: "jwk",
                        key: jwk,
                    });
                    const pem = pubKey.export({ format: "pem", type: "spki" });
                    return new Ed25519PublicKey(algorithm, extractable, keyUsages, pem);
                }
                else {
                    throw new core.OperationError("keyData: Cannot import JWK. 'd' or 'x' must be presented");
                }
            }
            case "pkcs8": {
                const pem = core.PemConverter.fromBufferSource(keyData, "PRIVATE KEY");
                return new Ed25519PrivateKey(algorithm, extractable, keyUsages, pem);
            }
            case "spki": {
                const pem = core.PemConverter.fromBufferSource(keyData, "PUBLIC KEY");
                return new Ed25519PublicKey(algorithm, extractable, keyUsages, pem);
            }
            case "raw": {
                const raw = keyData;
                const key = crypto.createPublicKey({
                    format: "jwk",
                    key: {
                        kty: "OKP",
                        crv: algorithm.name.toLowerCase() === "ed25519" ? "Ed25519" : "X25519",
                        x: Convert.ToBase64Url(raw),
                    },
                });
                const pem = key.export({ format: "pem", type: "spki" });
                return new Ed25519PublicKey(algorithm, extractable, keyUsages, pem);
            }
            default:
                return Promise.reject(new core.OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'"));
        }
    }
}
Ed25519Crypto.privateKeyUsages = ["sign", "deriveBits", "deriveKey"];
Ed25519Crypto.publicKeyUsages = ["verify"];

class Ed25519Provider extends core.Ed25519Provider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await Ed25519Crypto.generateKey(algorithm, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        const internalKey = getCryptoKey(key);
        const signature = Ed25519Crypto.sign(algorithm, internalKey, new Uint8Array(data));
        return signature;
    }
    onVerify(algorithm, key, signature, data) {
        const internalKey = getCryptoKey(key);
        return Ed25519Crypto.verify(algorithm, internalKey, new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        const internalKey = getCryptoKey(key);
        return Ed25519Crypto.exportKey(format, internalKey);
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const internalKey = await Ed25519Crypto.importKey(format, keyData, algorithm, extractable, keyUsages);
        return setCryptoKey(internalKey);
    }
}

class X25519Provider extends core.X25519Provider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await Ed25519Crypto.generateKey(algorithm, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onDeriveBits(algorithm, baseKey, length) {
        const internalBaseKey = getCryptoKey(baseKey);
        const internalPublicKey = getCryptoKey(algorithm.public);
        const publicKey = crypto.createPublicKey({
            key: internalPublicKey.data.toString(),
            format: "pem",
            type: "spki",
        });
        const privateKey = crypto.createPrivateKey({
            key: internalBaseKey.data.toString(),
            format: "pem",
            type: "pkcs8",
        });
        const bits = crypto.diffieHellman({
            publicKey,
            privateKey,
        });
        return new Uint8Array(bits).buffer.slice(0, length >> 3);
    }
    async onExportKey(format, key) {
        const internalKey = getCryptoKey(key);
        return Ed25519Crypto.exportKey(format, internalKey);
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await Ed25519Crypto.importKey(format, keyData, algorithm, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof Ed25519CryptoKey)) {
            throw new TypeError("key: Is not a Ed25519CryptoKey");
        }
    }
}

class PbkdfCryptoKey extends CryptoKey {
}

class Pbkdf2Provider extends core.Pbkdf2Provider {
    async onDeriveBits(algorithm, baseKey, length) {
        return new Promise((resolve, reject) => {
            const salt = core.BufferSourceConverter.toArrayBuffer(algorithm.salt);
            const hash = algorithm.hash.name.replace("-", "");
            crypto.pbkdf2(getCryptoKey(baseKey).data, Buffer$1.from(salt), algorithm.iterations, length >> 3, hash, (err, derivedBits) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(new Uint8Array(derivedBits).buffer);
                }
            });
        });
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        if (format === "raw") {
            const key = new PbkdfCryptoKey();
            key.data = Buffer$1.from(keyData);
            key.algorithm = { name: this.name };
            key.extractable = false;
            key.usages = keyUsages;
            return setCryptoKey(key);
        }
        throw new core.OperationError("format: Must be 'raw'");
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof PbkdfCryptoKey)) {
            throw new TypeError("key: Is not PBKDF CryptoKey");
        }
    }
}

class HmacCryptoKey extends CryptoKey {
    get alg() {
        const hash = this.algorithm.hash.name.toUpperCase();
        return `HS${hash.replace("SHA-", "")}`;
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], HmacCryptoKey.prototype, "data", void 0);

class HmacProvider extends core.HmacProvider {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const length = (algorithm.length || this.getDefaultLength(algorithm.hash.name)) >> 3 << 3;
        const key = new HmacCryptoKey();
        key.algorithm = {
            ...algorithm,
            length,
            name: this.name,
        };
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto.randomBytes(length >> 3);
        return setCryptoKey(key);
    }
    async onSign(algorithm, key, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
        const hmac = crypto.createHmac(cryptoAlg, getCryptoKey(key).data)
            .update(Buffer$1.from(data)).digest();
        return new Uint8Array(hmac).buffer;
    }
    async onVerify(algorithm, key, signature, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
        const hmac = crypto.createHmac(cryptoAlg, getCryptoKey(key).data)
            .update(Buffer$1.from(data)).digest();
        return hmac.compare(Buffer$1.from(signature)) === 0;
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: HmacCryptoKey });
                break;
            case "raw":
                key = new HmacCryptoKey();
                key.data = Buffer$1.from(keyData);
                break;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = {
            hash: { name: algorithm.hash.name },
            name: this.name,
            length: key.data.length << 3,
        };
        key.extractable = extractable;
        key.usages = keyUsages;
        return setCryptoKey(key);
    }
    async onExportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(getCryptoKey(key));
            case "raw":
                return new Uint8Array(getCryptoKey(key).data).buffer;
            default:
                throw new core.OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof HmacCryptoKey)) {
            throw new TypeError("key: Is not HMAC CryptoKey");
        }
    }
}

class HkdfCryptoKey extends CryptoKey {
}

class HkdfProvider extends core.HkdfProvider {
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        if (format.toLowerCase() !== "raw") {
            throw new core.OperationError("Operation not supported");
        }
        const key = new HkdfCryptoKey();
        key.data = Buffer$1.from(keyData);
        key.algorithm = { name: this.name };
        key.extractable = extractable;
        key.usages = keyUsages;
        return setCryptoKey(key);
    }
    async onDeriveBits(params, baseKey, length) {
        const hash = params.hash.name.replace("-", "");
        const hashLength = crypto.createHash(hash).digest().length;
        const byteLength = length / 8;
        const info = BufferSourceConverter$1.toUint8Array(params.info);
        const PRK = crypto.createHmac(hash, BufferSourceConverter$1.toUint8Array(params.salt))
            .update(BufferSourceConverter$1.toUint8Array(getCryptoKey(baseKey).data))
            .digest();
        const blocks = [Buffer$1.alloc(0)];
        const blockCount = Math.ceil(byteLength / hashLength) + 1;
        for (let i = 1; i < blockCount; ++i) {
            blocks.push(crypto.createHmac(hash, PRK)
                .update(Buffer$1.concat([blocks[i - 1], info, Buffer$1.from([i])]))
                .digest());
        }
        return Buffer$1.concat(blocks).slice(0, byteLength);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof HkdfCryptoKey)) {
            throw new TypeError("key: Is not HKDF CryptoKey");
        }
    }
}

class ShakeCrypto {
    static digest(algorithm, data) {
        const hash = crypto.createHash(algorithm.name.toLowerCase(), { outputLength: algorithm.length })
            .update(Buffer$1.from(data)).digest();
        return new Uint8Array(hash).buffer;
    }
}

class Shake128Provider extends core.Shake128Provider {
    async onDigest(algorithm, data) {
        return ShakeCrypto.digest(algorithm, data);
    }
}

class Shake256Provider extends core.Shake256Provider {
    async onDigest(algorithm, data) {
        return ShakeCrypto.digest(algorithm, data);
    }
}

class SubtleCrypto extends core.SubtleCrypto {
    constructor() {
        var _a;
        super();
        this.providers.set(new AesCbcProvider());
        this.providers.set(new AesCtrProvider());
        this.providers.set(new AesGcmProvider());
        this.providers.set(new AesCmacProvider());
        this.providers.set(new AesKwProvider());
        this.providers.set(new AesEcbProvider());
        const ciphers = crypto.getCiphers();
        if (ciphers.includes("des-cbc")) {
            this.providers.set(new DesCbcProvider());
        }
        this.providers.set(new DesEde3CbcProvider());
        this.providers.set(new RsaSsaProvider());
        this.providers.set(new RsaPssProvider());
        this.providers.set(new RsaOaepProvider());
        this.providers.set(new RsaEsProvider());
        this.providers.set(new EcdsaProvider());
        this.providers.set(new EcdhProvider());
        this.providers.set(new Sha1Provider());
        this.providers.set(new Sha256Provider());
        this.providers.set(new Sha384Provider());
        this.providers.set(new Sha512Provider());
        this.providers.set(new Pbkdf2Provider());
        this.providers.set(new HmacProvider());
        this.providers.set(new HkdfProvider());
        const nodeMajorVersion = (_a = /^v(\d+)/.exec(process.version)) === null || _a === void 0 ? void 0 : _a[1];
        if (nodeMajorVersion && parseInt(nodeMajorVersion, 10) >= 12) {
            this.providers.set(new Shake128Provider());
            this.providers.set(new Shake256Provider());
        }
        const hashes = crypto.getHashes();
        if (hashes.includes("sha3-256")) {
            this.providers.set(new Sha3256Provider());
        }
        if (hashes.includes("sha3-384")) {
            this.providers.set(new Sha3384Provider());
        }
        if (hashes.includes("sha3-512")) {
            this.providers.set(new Sha3512Provider());
        }
        if (nodeMajorVersion && parseInt(nodeMajorVersion, 10) >= 14) {
            this.providers.set(new EdDsaProvider());
            this.providers.set(new EcdhEsProvider());
            this.providers.set(new Ed25519Provider());
            this.providers.set(new X25519Provider());
        }
    }
}

class Crypto extends core.Crypto {
    constructor() {
        super(...arguments);
        this.subtle = new SubtleCrypto();
    }
    getRandomValues(array) {
        if (!ArrayBuffer.isView(array)) {
            throw new TypeError("Failed to execute 'getRandomValues' on 'Crypto': parameter 1 is not of type 'ArrayBufferView'");
        }
        const buffer = Buffer$1.from(array.buffer, array.byteOffset, array.byteLength);
        crypto.randomFillSync(buffer);
        return array;
    }
}

export { Crypto };
