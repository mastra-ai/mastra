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
const jest_fetch_mock_1 = require("jest-fetch-mock");
const workos_1 = require("../workos");
const crypto_1 = require("crypto");
const index_worker_1 = require("../index.worker");
const conflict_exception_1 = require("../common/exceptions/conflict.exception");
describe.skip('Vault Live Test', () => {
    let workos;
    const objectPrefix = (0, crypto_1.randomUUID)();
    beforeAll(() => {
        (0, jest_fetch_mock_1.disableFetchMocks)();
        workos = new workos_1.WorkOS('API_KEY');
    });
    afterAll(() => {
        (0, jest_fetch_mock_1.enableFetchMocks)();
    });
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        let listLimit = 0;
        let before;
        do {
            const allObjects = yield workos.vault.listObjects({ after: before });
            for (const object of allObjects.data) {
                if (object.name.startsWith(objectPrefix)) {
                    yield workos.vault.deleteObject({ id: object.id });
                }
            }
            before = allObjects.listMetadata.before;
            listLimit++;
        } while (listLimit < 100 && before !== undefined);
    }));
    describe('CRUD objects', () => {
        it('Creates objects', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-lima`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Huacaya 27.7 micron',
                context: { fiber: 'Alpalca' },
            });
            const expectedMetadata = {
                id: expect.any(String),
                context: {
                    fiber: 'Alpalca',
                },
                environmentId: expect.any(String),
                keyId: expect.any(String),
                updatedAt: expect.any(Date),
                updatedBy: {
                    id: expect.any(String),
                    name: expect.any(String),
                },
                versionId: expect.any(String),
            };
            expect(newObject).toStrictEqual(expectedMetadata);
            const objectValue = yield workos.vault.readObject({ id: newObject.id });
            expect(objectValue).toStrictEqual({
                id: newObject.id,
                name: objectName,
                value: 'Huacaya 27.7 micron',
                metadata: expectedMetadata,
            });
        }));
        it('Fails to create objects with the same name', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-lima`;
            yield workos.vault.createObject({
                name: objectName,
                value: 'Huacaya 27.7 micron',
                context: { fiber: 'Alpalca' },
            });
            yield expect(workos.vault.createObject({
                name: objectName,
                value: 'Huacaya 27.7 micron',
                context: { fiber: 'Alpalca' },
            })).rejects.toThrow(conflict_exception_1.ConflictException);
        }));
        it('Updates objects', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-cusco`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Tapada 20-30 micron',
                context: { fiber: 'Alpalca' },
            });
            const updatedObject = yield workos.vault.updateObject({
                id: newObject.id,
                value: 'Ccara 30-40 micron',
            });
            const expectedMetadata = {
                id: expect.any(String),
                context: {
                    fiber: 'Alpalca',
                },
                environmentId: expect.any(String),
                keyId: expect.any(String),
                updatedAt: expect.any(Date),
                updatedBy: {
                    id: expect.any(String),
                    name: expect.any(String),
                },
                versionId: expect.any(String),
            };
            expect(updatedObject).toStrictEqual({
                id: newObject.id,
                name: objectName,
                value: undefined,
                metadata: expectedMetadata,
            });
            const objectValue = yield workos.vault.readObject({ id: newObject.id });
            expect(objectValue).toStrictEqual({
                id: newObject.id,
                name: objectName,
                value: 'Ccara 30-40 micron',
                metadata: expectedMetadata,
            });
        }));
        it('Fails to update objects with wrong version check', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-cusco`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Tapada 20-30 micron',
                context: { fiber: 'Alpalca' },
            });
            yield workos.vault.updateObject({
                id: newObject.id,
                value: 'Ccara 30-40 micron',
            });
            yield expect(workos.vault.updateObject({
                id: newObject.id,
                value: 'Ccara 30-40 micron',
                versionCheck: newObject.versionId,
            })).rejects.toThrow(conflict_exception_1.ConflictException);
        }));
        it('Deletes objects', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-machu`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Tapada 20-30 micron',
                context: { fiber: 'Alpalca' },
            });
            yield workos.vault.deleteObject({ id: newObject.id });
            yield expect(workos.vault.readObject({ id: newObject.id })).rejects.toThrow(index_worker_1.NotFoundException);
        }));
        it('Describes objects', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${(0, crypto_1.randomUUID)()}-trujillo`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Qiviut 11-13 micron',
                context: { fiber: 'Musk Ox' },
            });
            const objectDescription = yield workos.vault.describeObject({
                id: newObject.id,
            });
            const expectedMetadata = {
                id: expect.any(String),
                context: {
                    fiber: 'Musk Ox',
                },
                environmentId: expect.any(String),
                keyId: expect.any(String),
                updatedAt: expect.any(Date),
                updatedBy: {
                    id: expect.any(String),
                    name: expect.any(String),
                },
                versionId: expect.any(String),
            };
            expect(objectDescription).toStrictEqual({
                id: newObject.id,
                name: objectName,
                metadata: expectedMetadata,
                value: undefined,
            });
        }));
        it('Lists objects with pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectNames = [];
            const numObjects = 6;
            const listPrefix = `${objectPrefix}-${(0, crypto_1.randomUUID)()}`;
            for (let i = 0; i < numObjects; i++) {
                const objectName = `${listPrefix}-${i}`;
                yield workos.vault.createObject({
                    name: objectName,
                    value: 'Qiviut 11-13 micron',
                    context: { fiber: 'Musk Ox' },
                });
                objectNames.push(objectName);
            }
            const allObjectNames = [];
            let before;
            do {
                const list = yield workos.vault.listObjects({
                    limit: 2,
                    after: before,
                });
                for (const object of list.data) {
                    if (object.name.startsWith(listPrefix)) {
                        allObjectNames.push(object.name);
                    }
                }
                before = list.listMetadata.before;
            } while (before !== undefined);
            const missingObjects = objectNames.filter((name) => !allObjectNames.includes(name));
            expect(allObjectNames.length).toEqual(numObjects);
            expect(missingObjects).toStrictEqual([]);
        }));
        it('Lists object versions', () => __awaiter(void 0, void 0, void 0, function* () {
            const objectName = `${objectPrefix}-arequipa`;
            const newObject = yield workos.vault.createObject({
                name: objectName,
                value: 'Tapada 20-30 micron',
                context: { fiber: 'Alpalca' },
            });
            const updatedObject = yield workos.vault.updateObject({
                id: newObject.id,
                value: 'Ccara 30-40 micron',
            });
            const versions = yield workos.vault.listObjectVersions({
                id: newObject.id,
            });
            expect(versions.length).toBe(2);
            const currentVersion = versions.find((v) => v.currentVersion);
            expect(currentVersion === null || currentVersion === void 0 ? void 0 : currentVersion.id).toBe(updatedObject.metadata.versionId);
            const firstVersion = versions.find((v) => v.id === newObject.versionId);
            expect(firstVersion === null || firstVersion === void 0 ? void 0 : firstVersion.currentVersion).toBe(false);
        }));
    });
    describe('encrypt and decrypt', () => {
        it('encrypts and decrypts data', () => __awaiter(void 0, void 0, void 0, function* () {
            const superObject = 'hot water freezes faster than cold water';
            const keyContext = {
                everything: 'everywhere',
            };
            const encrypted = yield workos.vault.encrypt(superObject, keyContext);
            const decrypted = yield workos.vault.decrypt(encrypted);
            expect(decrypted).toBe(superObject);
        }));
        it('authenticates additional data', () => __awaiter(void 0, void 0, void 0, function* () {
            const data = 'hot water freezes faster than cold water';
            const keyContext = { everything: 'everywhere' };
            const aad = 'seq1';
            const encrypted = yield workos.vault.encrypt(data, keyContext, aad);
            const decrypted = yield workos.vault.decrypt(encrypted, aad);
            expect(decrypted).toBe(data);
        }));
        it('fails with invalid AD', () => __awaiter(void 0, void 0, void 0, function* () {
            const data = 'hot water freezes faster than cold water';
            const keyContext = { everything: 'everywhere' };
            const aad = 'seq1';
            const encrypted = yield workos.vault.encrypt(data, keyContext, aad);
            yield expect(() => workos.vault.decrypt(encrypted)).rejects.toThrow('unable to authenticate data');
        }));
    });
});
