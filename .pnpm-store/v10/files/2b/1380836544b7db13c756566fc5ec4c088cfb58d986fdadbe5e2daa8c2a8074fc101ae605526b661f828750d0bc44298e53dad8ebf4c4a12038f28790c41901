"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vault = void 0;
const leb_1 = require("leb");
const base64_1 = require("../common/utils/base64");
const vault_key_serializer_1 = require("./serializers/vault-key.serializer");
const vault_object_serializer_1 = require("./serializers/vault-object.serializer");
class Vault {
    constructor(workos) {
        this.workos = workos;
        /*
         * @deprecated Use `createObject` instead.
         */
        this.createSecret = this.createObject;
        /*
         * @deprecated Use `listObjects` instead.
         */
        this.listSecrets = this.listObjects;
        /*
         * @deprecated Use `listObjectVersions` instead.
         */
        this.listSecretVersions = this.listObjectVersions;
        /*
         * @deprecated Use `readObject` instead.
         */
        this.readSecret = this.readObject;
        /*
         * @deprecated Use `describeObject` instead.
         */
        this.describeSecret = this.describeObject;
        /*
         * @deprecated Use `updateObject` instead.
         */
        this.updateSecret = this.updateObject;
        /*
         * @deprecated Use `deleteObject` instead.
         */
        this.deleteSecret = this.deleteObject;
        this.cryptoProvider = workos.getCryptoProvider();
    }
    decode(payload) {
        const inputData = (0, base64_1.base64ToUint8Array)(payload);
        // Use 12 bytes for IV (standard for AES-GCM)
        const iv = new Uint8Array(inputData.subarray(0, 12));
        const tag = new Uint8Array(inputData.subarray(12, 28));
        const { value: keyLen, nextIndex } = (0, leb_1.decodeUInt32)(inputData, 28);
        // Use subarray instead of slice and convert directly to base64
        const keysBuffer = inputData.subarray(nextIndex, nextIndex + keyLen);
        const keys = (0, base64_1.uint8ArrayToBase64)(keysBuffer);
        const ciphertext = new Uint8Array(inputData.subarray(nextIndex + keyLen));
        return {
            iv,
            tag,
            keys,
            ciphertext,
        };
    }
    createObject(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/vault/v1/kv`, (0, vault_object_serializer_1.serializeCreateObjectEntity)(options));
            return (0, vault_object_serializer_1.deserializeObjectMetadata)(data);
        });
    }
    listObjects(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = new URL('/vault/v1/kv', this.workos.baseURL);
            if (options === null || options === void 0 ? void 0 : options.after) {
                url.searchParams.set('after', options.after);
            }
            if (options === null || options === void 0 ? void 0 : options.limit) {
                url.searchParams.set('limit', options.limit.toString());
            }
            const { data } = yield this.workos.get(url.toString());
            return (0, vault_object_serializer_1.deserializeListObjects)(data);
        });
    }
    listObjectVersions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/vault/v1/kv/${encodeURIComponent(options.id)}/versions`);
            return (0, vault_object_serializer_1.desrializeListObjectVersions)(data);
        });
    }
    readObject(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/vault/v1/kv/${encodeURIComponent(options.id)}`);
            return (0, vault_object_serializer_1.deserializeObject)(data);
        });
    }
    describeObject(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/vault/v1/kv/${encodeURIComponent(options.id)}/metadata`);
            return (0, vault_object_serializer_1.deserializeObject)(data);
        });
    }
    updateObject(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.put(`/vault/v1/kv/${encodeURIComponent(options.id)}`, (0, vault_object_serializer_1.serializeUpdateObjectEntity)(options));
            return (0, vault_object_serializer_1.deserializeObject)(data);
        });
    }
    deleteObject(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.workos.delete(`/vault/v1/kv/${encodeURIComponent(options.id)}`);
        });
    }
    createDataKey(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/vault/v1/keys/data-key`, options);
            return (0, vault_key_serializer_1.deserializeCreateDataKeyResponse)(data);
        });
    }
    decryptDataKey(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.post(`/vault/v1/keys/decrypt`, options);
            return (0, vault_key_serializer_1.deserializeDecryptDataKeyResponse)(data);
        });
    }
    encrypt(data, context, associatedData) {
        return __awaiter(this, void 0, void 0, function* () {
            const keyPair = yield this.createDataKey({
                context,
            });
            // Convert base64 key to Uint8Array
            const encoder = new TextEncoder();
            // Use our cross-runtime base64 utility
            const key = (0, base64_1.base64ToUint8Array)(keyPair.dataKey.key);
            const keyBlob = (0, base64_1.base64ToUint8Array)(keyPair.encryptedKeys);
            const prefixLenBuffer = (0, leb_1.encodeUInt32)(keyBlob.length);
            const aadBuffer = associatedData
                ? encoder.encode(associatedData)
                : undefined;
            // Use a 12-byte IV for AES-GCM (industry standard)
            const iv = this.cryptoProvider.randomBytes(12);
            const { ciphertext, iv: resultIv, tag, } = yield this.cryptoProvider.encrypt(encoder.encode(data), key, iv, aadBuffer);
            // Concatenate all parts into a single array
            const resultArray = new Uint8Array(resultIv.length +
                tag.length +
                prefixLenBuffer.length +
                keyBlob.length +
                ciphertext.length);
            let offset = 0;
            resultArray.set(resultIv, offset);
            offset += resultIv.length;
            resultArray.set(tag, offset);
            offset += tag.length;
            resultArray.set(new Uint8Array(prefixLenBuffer), offset);
            offset += prefixLenBuffer.length;
            resultArray.set(keyBlob, offset);
            offset += keyBlob.length;
            resultArray.set(ciphertext, offset);
            // Convert to base64 using our cross-runtime utility
            return (0, base64_1.uint8ArrayToBase64)(resultArray);
        });
    }
    decrypt(encryptedData, associatedData) {
        return __awaiter(this, void 0, void 0, function* () {
            const decoded = this.decode(encryptedData);
            const dataKey = yield this.decryptDataKey({ keys: decoded.keys });
            // Convert base64 key to Uint8Array using our cross-runtime utility
            const key = (0, base64_1.base64ToUint8Array)(dataKey.key);
            const encoder = new TextEncoder();
            const aadBuffer = associatedData
                ? encoder.encode(associatedData)
                : undefined;
            const decrypted = yield this.cryptoProvider.decrypt(decoded.ciphertext, key, decoded.iv, decoded.tag, aadBuffer);
            return new TextDecoder().decode(decrypted);
        });
    }
}
exports.Vault = Vault;
