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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const test_utils_1 = require("../common/utils/test-utils");
const workos_1 = require("../workos");
const conflict_exception_1 = require("../common/exceptions/conflict.exception");
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
describe('Vault', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('createSecret', () => {
        it('creates secret', () => __awaiter(void 0, void 0, void 0, function* () {
            const secretName = 'charger';
            (0, test_utils_1.fetchOnce)({
                id: 's1',
                context: {
                    type: 'spore',
                },
                environment_id: 'xxx',
                key_id: 'k1',
                updated_at: '2029-03-17T04:37:46.748303Z',
                updated_by: {
                    id: 'key_xxx',
                    name: 'Local Test Key',
                },
                version_id: 'v1',
            });
            const resource = yield workos.vault.createSecret({
                name: secretName,
                context: { type: 'spore' },
                value: 'Full speed ahead',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv`);
            expect((0, test_utils_1.fetchMethod)()).toBe('POST');
            expect(resource).toStrictEqual({
                id: 's1',
                context: {
                    type: 'spore',
                },
                environmentId: 'xxx',
                keyId: 'k1',
                updatedAt: new Date(Date.parse('2029-03-17T04:37:46.748303Z')),
                updatedBy: {
                    id: 'key_xxx',
                    name: 'Local Test Key',
                },
                versionId: 'v1',
            });
        }));
        it('throws an error if secret exists', () => __awaiter(void 0, void 0, void 0, function* () {
            const secretName = 'charger';
            (0, test_utils_1.fetchOnce)({
                error: 'Item already exists',
            }, { status: 409 });
            yield expect(workos.vault.createSecret({
                name: secretName,
                context: { type: 'spore' },
                value: 'Full speed ahead',
            })).rejects.toThrow(conflict_exception_1.ConflictException);
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv`);
            expect((0, test_utils_1.fetchMethod)()).toBe('POST');
        }));
    });
    describe('readSecret', () => {
        it('reads a secret by id', () => __awaiter(void 0, void 0, void 0, function* () {
            const secretName = 'lima';
            const secretId = 'secret1';
            (0, test_utils_1.fetchOnce)({
                id: secretId,
                metadata: {
                    id: secretId,
                    context: {
                        emporer: 'groove',
                    },
                    environment_id: 'environment_d',
                    key_id: 'key1',
                    updated_at: '2025-03-11T02:18:54.250931Z',
                    updated_by: {
                        id: 'key_xxx',
                        name: 'Local Test Key',
                    },
                    version_id: 'version1',
                },
                name: secretName,
                value: 'Pull the lever Gronk',
            });
            const resource = yield workos.vault.readSecret({
                id: secretId,
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv/${secretId}`);
            expect((0, test_utils_1.fetchMethod)()).toBe('GET');
            expect(resource).toStrictEqual({
                id: secretId,
                metadata: {
                    id: secretId,
                    context: {
                        emporer: 'groove',
                    },
                    environmentId: 'environment_d',
                    keyId: 'key1',
                    updatedAt: new Date(Date.parse('2025-03-11T02:18:54.250931Z')),
                    updatedBy: {
                        id: 'key_xxx',
                        name: 'Local Test Key',
                    },
                    versionId: 'version1',
                },
                name: secretName,
                value: 'Pull the lever Gronk',
            });
        }));
    });
    describe('listSecrets', () => {
        it('gets a paginated list of secrets', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        id: 's1',
                        name: 'charger',
                        updated_at: '2029-03-17T04:37:46.748303Z',
                    },
                ],
                list_metadata: {
                    after: null,
                    before: 'charger',
                },
            });
            const resource = yield workos.vault.listSecrets();
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv`);
            expect((0, test_utils_1.fetchMethod)()).toBe('GET');
            expect(resource).toStrictEqual({
                object: 'list',
                data: [
                    {
                        id: 's1',
                        name: 'charger',
                        updatedAt: new Date(Date.parse('2029-03-17T04:37:46.748303Z')),
                    },
                ],
                listMetadata: {
                    after: undefined,
                    before: 'charger',
                },
            });
        }));
    });
    describe('listSecretVersions', () => {
        it('gets a paginated list of secret versions', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        id: 'raZUqoHteQkLihH6AG5bj6sYAqMcJS76',
                        size: 270,
                        etag: '"5147c963627323edcb15910ceea573bf"',
                        created_at: '2029-03-17T15:51:57.000000Z',
                        current_version: true,
                    },
                ],
                list_metadata: {
                    after: null,
                    before: 'raZUqoHteQkLihH6AG5bj6sYAqMcJS76',
                },
            });
            const resource = yield workos.vault.listSecretVersions({ id: 'secret1' });
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv/secret1/versions`);
            expect((0, test_utils_1.fetchMethod)()).toBe('GET');
            expect(resource).toStrictEqual([
                {
                    createdAt: new Date(Date.parse('2029-03-17T15:51:57.000000Z')),
                    currentVersion: true,
                    id: 'raZUqoHteQkLihH6AG5bj6sYAqMcJS76',
                },
            ]);
        }));
    });
    describe('updateSecret', () => {
        it('updates secret', () => __awaiter(void 0, void 0, void 0, function* () {
            const secretId = 's1';
            (0, test_utils_1.fetchOnce)({
                id: secretId,
                name: 'charger',
                metadata: {
                    id: secretId,
                    context: {
                        type: 'spore',
                    },
                    environment_id: 'xxx',
                    key_id: 'k1',
                    updated_at: '2029-03-17T04:37:46.748303Z',
                    updated_by: {
                        id: 'key_xxx',
                        name: 'Local Test Key',
                    },
                    version_id: 'v1',
                },
            });
            const resource = yield workos.vault.updateSecret({
                id: secretId,
                value: 'Full speed ahead',
            });
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv/${secretId}`);
            expect((0, test_utils_1.fetchMethod)()).toBe('PUT');
            expect(resource).toStrictEqual({
                id: secretId,
                name: 'charger',
                metadata: {
                    id: secretId,
                    context: {
                        type: 'spore',
                    },
                    environmentId: 'xxx',
                    keyId: 'k1',
                    updatedAt: new Date(Date.parse('2029-03-17T04:37:46.748303Z')),
                    updatedBy: {
                        id: 'key_xxx',
                        name: 'Local Test Key',
                    },
                    versionId: 'v1',
                },
                value: undefined,
            });
        }));
        it('throws an error if secret version check fails', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                error: 'Item already exists',
            }, { status: 409 });
            yield expect(workos.vault.updateSecret({
                id: 'secret1',
                value: 'Full speed ahead',
                versionCheck: 'notaversion',
            })).rejects.toThrow(conflict_exception_1.ConflictException);
            expect((0, test_utils_1.fetchURL)()).toContain(`/vault/v1/kv/secret1`);
            expect((0, test_utils_1.fetchMethod)()).toBe('PUT');
        }));
    });
    describe('encrypt and decrypt', () => {
        it('correctly encrypts and decrypts data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Generate a valid 32-byte (256-bit) key for AES-256-GCM
            const validKey = Buffer.alloc(32).fill('A').toString('base64');
            // Mock createDataKey to return a valid key for testing
            (0, test_utils_1.fetchOnce)({
                data_key: validKey,
                encrypted_keys: 'ZW5jcnlwdGVkX2tleXM=',
                id: 'key123',
                context: { type: 'test' },
            });
            // Mock decryptDataKey to return same key
            (0, test_utils_1.fetchOnce)({
                data_key: validKey,
                id: 'key123',
            });
            const originalText = 'This is a secret message';
            const context = { type: 'test' };
            const associatedData = 'additional-auth-data';
            // Encrypt the data
            const encrypted = yield workos.vault.encrypt(originalText, context, associatedData);
            // Verify encrypt API call
            expect((0, test_utils_1.fetchURL)()).toContain('/vault/v1/keys/data-key');
            expect((0, test_utils_1.fetchMethod)()).toBe('POST');
            // Reset fetch for the decrypt call
            jest_fetch_mock_1.default.resetMocks();
            (0, test_utils_1.fetchOnce)({
                data_key: validKey,
                id: 'key123',
            });
            // Decrypt the data
            const decrypted = yield workos.vault.decrypt(encrypted, associatedData);
            // Verify decrypt API call
            expect((0, test_utils_1.fetchURL)()).toContain('/vault/v1/keys/decrypt');
            expect((0, test_utils_1.fetchMethod)()).toBe('POST');
            // Verify the decrypted text matches the original
            expect(decrypted).toBe(originalText);
        }));
    });
});
