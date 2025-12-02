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
const interfaces_1 = require("./interfaces");
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
describe('FGA', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('check', () => {
        it('makes check request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                result: 'authorized',
                is_implicit: false,
                warrant_token: 'abc',
            });
            const checkResult = yield workos.fga.check({
                checks: [
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'admin',
                        },
                        relation: 'member',
                        subject: {
                            resourceType: 'user',
                            resourceId: 'user_123',
                        },
                    },
                ],
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/check');
            expect(checkResult).toMatchObject({
                result: 'authorized',
                isImplicit: false,
                warrantToken: 'abc',
            });
        }));
        it('deserializes warnings in check response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                result: 'authorized',
                is_implicit: false,
                warrant_token: 'abc',
                warnings: [
                    {
                        code: 'missing_context_keys',
                        message: 'Missing required context keys',
                        keys: ['tenant_id', 'region'],
                    },
                    {
                        code: 'some_other_warning',
                        message: 'Some other warning message',
                    },
                ],
            });
            const checkResult = yield workos.fga.check({
                checks: [
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'admin',
                        },
                        relation: 'member',
                        subject: {
                            resourceType: 'user',
                            resourceId: 'user_123',
                        },
                    },
                ],
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/check');
            expect(checkResult).toMatchObject({
                result: 'authorized',
                isImplicit: false,
                warrantToken: 'abc',
                warnings: [
                    {
                        code: 'missing_context_keys',
                        message: 'Missing required context keys',
                        keys: ['tenant_id', 'region'],
                    },
                    {
                        code: 'some_other_warning',
                        message: 'Some other warning message',
                    },
                ],
            });
        }));
    });
    describe('createResource', () => {
        it('creates resource', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                resource_type: 'role',
                resource_id: 'admin',
            });
            const resource = yield workos.fga.createResource({
                resource: {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources');
            expect(resource).toMatchObject({
                resourceType: 'role',
                resourceId: 'admin',
            });
        }));
        it('creates resource with metadata', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                resource_type: 'role',
                resource_id: 'admin',
                meta: {
                    description: 'The admin role',
                },
            });
            const resource = yield workos.fga.createResource({
                resource: {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                meta: {
                    description: 'The admin role',
                },
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources');
            expect(resource).toMatchObject({
                resourceType: 'role',
                resourceId: 'admin',
                meta: {
                    description: 'The admin role',
                },
            });
        }));
    });
    describe('getResource', () => {
        it('gets resource', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                resource_type: 'role',
                resource_id: 'admin',
            });
            const resource = yield workos.fga.getResource({
                resourceType: 'role',
                resourceId: 'admin',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources/role/admin');
            expect(resource).toMatchObject({
                resourceType: 'role',
                resourceId: 'admin',
            });
        }));
    });
    describe('listResources', () => {
        it('lists resources', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'manager',
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            const { data: resources } = yield workos.fga.listResources();
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources');
            expect(resources).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                {
                    resourceType: 'role',
                    resourceId: 'manager',
                },
            ]);
        }));
        it('sends correct params when filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'manager',
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            yield workos.fga.listResources({
                resourceType: 'role',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources');
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                resource_type: 'role',
                order: 'desc',
            });
        }));
    });
    describe('deleteResource', () => {
        it('should delete resource', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const response = yield workos.fga.deleteResource({
                resourceType: 'role',
                resourceId: 'admin',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources/role/admin');
            expect(response).toBeUndefined();
        }));
    });
    describe('batchWriteResources', () => {
        it('batch create resources', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        meta: {
                            description: 'The admin role',
                        },
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'manager',
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'employee',
                    },
                ],
            });
            const createdResources = yield workos.fga.batchWriteResources({
                op: interfaces_1.ResourceOp.Create,
                resources: [
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'admin',
                        },
                        meta: {
                            description: 'The admin role',
                        },
                    },
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'manager',
                        },
                    },
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'employee',
                        },
                    },
                ],
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources/batch');
            expect(createdResources).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                    meta: {
                        description: 'The admin role',
                    },
                },
                {
                    resourceType: 'role',
                    resourceId: 'manager',
                },
                {
                    resourceType: 'role',
                    resourceId: 'employee',
                },
            ]);
        }));
        it('batch delete resources', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'manager',
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'employee',
                    },
                ],
            });
            const deletedResources = yield workos.fga.batchWriteResources({
                op: interfaces_1.ResourceOp.Delete,
                resources: [
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'admin',
                        },
                        meta: {
                            description: 'The admin role',
                        },
                    },
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'manager',
                        },
                    },
                    {
                        resource: {
                            resourceType: 'role',
                            resourceId: 'employee',
                        },
                    },
                ],
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/resources/batch');
            expect(deletedResources).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                {
                    resourceType: 'role',
                    resourceId: 'manager',
                },
                {
                    resourceType: 'role',
                    resourceId: 'employee',
                },
            ]);
        }));
    });
    describe('writeWarrant', () => {
        it('should create warrant with no op', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                warrant_token: 'some_token',
            });
            const warrantToken = yield workos.fga.writeWarrant({
                resource: {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                relation: 'member',
                subject: {
                    resourceType: 'user',
                    resourceId: 'user_123',
                },
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                resource_type: 'role',
                resource_id: 'admin',
                relation: 'member',
                subject: {
                    resource_type: 'user',
                    resource_id: 'user_123',
                },
            });
            expect(warrantToken).toMatchObject({
                warrantToken: 'some_token',
            });
        }));
        it('should create warrant with create op', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                warrant_token: 'some_token',
            });
            const warrantToken = yield workos.fga.writeWarrant({
                op: interfaces_1.WarrantOp.Create,
                resource: {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                relation: 'member',
                subject: {
                    resourceType: 'user',
                    resourceId: 'user_123',
                },
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                op: 'create',
                resource_type: 'role',
                resource_id: 'admin',
                relation: 'member',
                subject: {
                    resource_type: 'user',
                    resource_id: 'user_123',
                },
            });
            expect(warrantToken).toMatchObject({
                warrantToken: 'some_token',
            });
        }));
        it('should delete warrant with delete op', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                warrant_token: 'some_token',
            });
            const warrantToken = yield workos.fga.writeWarrant({
                op: interfaces_1.WarrantOp.Delete,
                resource: {
                    resourceType: 'role',
                    resourceId: 'admin',
                },
                relation: 'member',
                subject: {
                    resourceType: 'user',
                    resourceId: 'user_123',
                },
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                op: 'delete',
                resource_type: 'role',
                resource_id: 'admin',
                relation: 'member',
                subject: {
                    resource_type: 'user',
                    resource_id: 'user_123',
                },
            });
            expect(warrantToken).toMatchObject({
                warrantToken: 'some_token',
            });
        }));
    });
    describe('batchWriteWarrants', () => {
        it('should create warrants with no op or create op and delete warrants with delete op', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                warrant_token: 'some_token',
            });
            const warrantToken = yield workos.fga.batchWriteWarrants([
                {
                    resource: {
                        resourceType: 'role',
                        resourceId: 'admin',
                    },
                    relation: 'member',
                    subject: {
                        resourceType: 'user',
                        resourceId: 'user_123',
                    },
                },
                {
                    op: interfaces_1.WarrantOp.Create,
                    resource: {
                        resourceType: 'role',
                        resourceId: 'admin',
                    },
                    relation: 'member',
                    subject: {
                        resourceType: 'user',
                        resourceId: 'user_124',
                    },
                },
                {
                    op: interfaces_1.WarrantOp.Delete,
                    resource: {
                        resourceType: 'role',
                        resourceId: 'admin',
                    },
                    relation: 'member',
                    subject: {
                        resourceType: 'user',
                        resourceId: 'user_125',
                    },
                },
            ]);
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect((0, test_utils_1.fetchBody)()).toEqual([
                {
                    resource_type: 'role',
                    resource_id: 'admin',
                    relation: 'member',
                    subject: {
                        resource_type: 'user',
                        resource_id: 'user_123',
                    },
                },
                {
                    op: 'create',
                    resource_type: 'role',
                    resource_id: 'admin',
                    relation: 'member',
                    subject: {
                        resource_type: 'user',
                        resource_id: 'user_124',
                    },
                },
                {
                    op: 'delete',
                    resource_type: 'role',
                    resource_id: 'admin',
                    relation: 'member',
                    subject: {
                        resource_type: 'user',
                        resource_id: 'user_125',
                    },
                },
            ]);
            expect(warrantToken).toMatchObject({
                warrantToken: 'some_token',
            });
        }));
    });
    describe('listWarrants', () => {
        it('should list warrants', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        relation: 'member',
                        subject: {
                            resource_type: 'user',
                            resource_id: 'user_123',
                        },
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        relation: 'member',
                        subject: {
                            resource_type: 'user',
                            resource_id: 'user_124',
                        },
                        policy: 'region == "us"',
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            const { data: warrants } = yield workos.fga.listWarrants();
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect(warrants).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                    relation: 'member',
                    subject: {
                        resourceType: 'user',
                        resourceId: 'user_123',
                    },
                },
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                    relation: 'member',
                    subject: {
                        resourceType: 'user',
                        resourceId: 'user_124',
                    },
                    policy: 'region == "us"',
                },
            ]);
        }));
        it('sends correct params when filtering', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        relation: 'member',
                        subject: {
                            resource_type: 'user',
                            resource_id: 'user_123',
                        },
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            yield workos.fga.listWarrants({
                subjectType: 'user',
                subjectId: 'user_123',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/warrants');
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                subject_type: 'user',
                subject_id: 'user_123',
                order: 'desc',
            });
        }));
    });
    describe('query', () => {
        it('makes query request', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        warrant: {
                            resource_type: 'role',
                            resource_id: 'admin',
                            relation: 'member',
                            subject: {
                                resource_type: 'user',
                                resource_id: 'user_123',
                            },
                        },
                        is_implicit: false,
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            const { data: queryResults } = yield workos.fga.query({
                q: 'select role where user:user_123 is member',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/query');
            expect(queryResults).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                    warrant: {
                        resourceType: 'role',
                        resourceId: 'admin',
                        relation: 'member',
                        subject: {
                            resourceType: 'user',
                            resourceId: 'user_123',
                        },
                    },
                    isImplicit: false,
                },
            ]);
        }));
        it('deserializes warnings in query response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resource_type: 'role',
                        resource_id: 'admin',
                        warrant: {
                            resource_type: 'role',
                            resource_id: 'admin',
                            relation: 'member',
                            subject: {
                                resource_type: 'user',
                                resource_id: 'user_123',
                            },
                        },
                        is_implicit: false,
                    },
                    {
                        resource_type: 'role',
                        resource_id: 'manager',
                        warrant: {
                            resource_type: 'role',
                            resource_id: 'manager',
                            relation: 'member',
                            subject: {
                                resource_type: 'user',
                                resource_id: 'user_123',
                            },
                        },
                        is_implicit: true,
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
                warnings: [
                    {
                        code: 'missing_context_keys',
                        message: 'Missing required context keys',
                        keys: ['tenant_id'],
                    },
                    {
                        code: 'some_other_warning',
                        message: 'Some other warning message',
                    },
                ],
            });
            const result = yield workos.fga.query({
                q: 'select role where user:user_123 is member',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/query');
            expect(result.data).toMatchObject([
                {
                    resourceType: 'role',
                    resourceId: 'admin',
                    warrant: {
                        resourceType: 'role',
                        resourceId: 'admin',
                        relation: 'member',
                        subject: {
                            resourceType: 'user',
                            resourceId: 'user_123',
                        },
                    },
                    isImplicit: false,
                },
                {
                    resourceType: 'role',
                    resourceId: 'manager',
                    warrant: {
                        resourceType: 'role',
                        resourceId: 'manager',
                        relation: 'member',
                        subject: {
                            resourceType: 'user',
                            resourceId: 'user_123',
                        },
                    },
                    isImplicit: true,
                },
            ]);
            expect(result.warnings).toMatchObject([
                {
                    code: 'missing_context_keys',
                    message: 'Missing required context keys',
                    keys: ['tenant_id'],
                },
                {
                    code: 'some_other_warning',
                    message: 'Some other warning message',
                },
            ]);
        }));
        it('sends correct params and options', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({
                data: [
                    {
                        resourceType: 'role',
                        resourceId: 'admin',
                        warrant: {
                            resourceType: 'role',
                            resourceId: 'admin',
                            relation: 'member',
                            subject: {
                                resourceType: 'user',
                                resourceId: 'user_123',
                            },
                        },
                        isImplicit: false,
                    },
                ],
                list_metadata: {
                    before: null,
                    after: null,
                },
            });
            yield workos.fga.query({
                q: 'select role where user:user_123 is member',
                order: 'asc',
            }, {
                warrantToken: 'some_token',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/fga/v1/query');
            expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                q: 'select role where user:user_123 is member',
                order: 'asc',
            });
            expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                'Warrant-Token': 'some_token',
            });
        }));
    });
});
