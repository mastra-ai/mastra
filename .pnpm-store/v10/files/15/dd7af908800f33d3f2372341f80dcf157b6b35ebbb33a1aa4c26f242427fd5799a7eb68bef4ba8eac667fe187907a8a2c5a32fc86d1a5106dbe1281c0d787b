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
const exceptions_1 = require("../common/exceptions");
const bad_request_exception_1 = require("../common/exceptions/bad-request.exception");
const workos_mock_response_1 = require("../common/utils/workos-mock-response");
const workos_1 = require("../workos");
const serializers_1 = require("./serializers");
const fetch_error_1 = require("../common/utils/fetch-error");
const event = {
    action: 'document.updated',
    occurredAt: new Date(),
    actor: {
        id: 'user_1',
        name: 'Jon Smith',
        type: 'user',
    },
    targets: [
        {
            id: 'document_39127',
            type: 'document',
        },
    ],
    context: {
        location: '192.0.0.8',
        userAgent: 'Firefox',
    },
    metadata: {
        successful: true,
    },
};
const schema = {
    action: 'user.logged_in',
    actor: {
        metadata: {
            actor_id: 'string',
        },
    },
    targets: [
        {
            type: 'user',
            metadata: {
                user_id: 'string',
            },
        },
    ],
    metadata: {
        foo: 'number',
        baz: 'boolean',
    },
};
const schemaWithoutMetadata = Object.assign(Object.assign({}, schema), { metadata: undefined });
describe('AuditLogs', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('createEvent', () => {
        describe('with an idempotency key', () => {
            it('includes an idempotency key with request', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, { success: true }));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createEvent('org_123', event, {
                    idempotencyKey: 'the-idempotency-key',
                })).resolves.toBeUndefined();
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/events', {
                    event: (0, serializers_1.serializeCreateAuditLogEventOptions)(event),
                    organization_id: 'org_123',
                }, { idempotencyKey: 'the-idempotency-key' });
            }));
        });
        describe('when the api responds with a 200', () => {
            it('returns void', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, { success: true }));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createEvent('org_123', event)).resolves.toBeUndefined();
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/events', {
                    event: (0, serializers_1.serializeCreateAuditLogEventOptions)(event),
                    organization_id: 'org_123',
                }, {});
            }));
        });
        describe('when the api responds with a 401', () => {
            it('throws an UnauthorizedException', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                workosSpy.mockImplementationOnce(() => {
                    throw new fetch_error_1.FetchError({
                        message: 'Could not authorize the request. Maybe your API key is invalid?',
                        response: { status: 401, headers: new Headers(), data: {} },
                    });
                });
                const workos = new workos_1.WorkOS('invalid apikey');
                yield expect(workos.auditLogs.createEvent('org_123', event)).rejects.toThrowError(new exceptions_1.UnauthorizedException('a-request-id'));
            }));
        });
        describe('when the api responds with a 400', () => {
            it('throws an BadRequestException', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const errors = [
                    {
                        field: 'occurred_at',
                        code: 'occurred_at must be an ISO 8601 date string',
                    },
                ];
                workosSpy.mockImplementationOnce(() => {
                    throw new bad_request_exception_1.BadRequestException({
                        code: '400',
                        errors,
                        message: 'Audit Log could not be processed due to missing or incorrect data.',
                        requestID: 'a-request-id',
                    });
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createEvent('org_123', event)).rejects.toThrow(bad_request_exception_1.BadRequestException);
            }));
        });
    });
    describe('createExport', () => {
        describe('when the api responds with a 201', () => {
            it('returns `audit_log_export`', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const options = {
                    organizationId: 'org_123',
                    rangeStart: new Date(),
                    rangeEnd: new Date(),
                };
                const timestamp = new Date().toISOString();
                const auditLogExport = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
                const auditLogExportResponse = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    created_at: timestamp,
                    updated_at: timestamp,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, auditLogExportResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createExport(options)).resolves.toEqual(auditLogExport);
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/exports', (0, serializers_1.serializeAuditLogExportOptions)(options));
            }));
        });
        describe('when additional filters are defined', () => {
            it('returns `audit_log_export`', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const options = {
                    actions: ['foo', 'bar'],
                    actors: ['Jon', 'Smith'],
                    actorNames: ['Jon', 'Smith'],
                    actorIds: ['user_foo', 'user_bar'],
                    organizationId: 'org_123',
                    rangeEnd: new Date(),
                    rangeStart: new Date(),
                    targets: ['user', 'team'],
                };
                const timestamp = new Date().toISOString();
                const auditLogExport = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
                const auditLogExportResponse = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    created_at: timestamp,
                    updated_at: timestamp,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, auditLogExportResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createExport(options)).resolves.toEqual(auditLogExport);
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/exports', (0, serializers_1.serializeAuditLogExportOptions)(options));
            }));
        });
        describe('when the api responds with a 401', () => {
            it('throws an UnauthorizedException', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const options = {
                    organizationId: 'org_123',
                    rangeStart: new Date(),
                    rangeEnd: new Date(),
                };
                workosSpy.mockImplementationOnce(() => {
                    throw new fetch_error_1.FetchError({
                        message: 'Could not authorize the request. Maybe your API key is invalid?',
                        response: { status: 401, headers: new Headers(), data: {} },
                    });
                });
                const workos = new workos_1.WorkOS('invalid apikey');
                yield expect(workos.auditLogs.createExport(options)).rejects.toThrowError(new exceptions_1.UnauthorizedException('a-request-id'));
            }));
        });
    });
    describe('getExport', () => {
        describe('when the api responds with a 201', () => {
            it('returns `audit_log_export`', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'get');
                const timestamp = new Date().toISOString();
                const auditLogExport = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };
                const auditLogExportResponse = {
                    object: 'audit_log_export',
                    id: 'audit_log_export_1234',
                    state: 'pending',
                    url: undefined,
                    created_at: timestamp,
                    updated_at: timestamp,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, auditLogExportResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.getExport(auditLogExport.id)).resolves.toEqual(auditLogExport);
                expect(workosSpy).toHaveBeenCalledWith(`/audit_logs/exports/${auditLogExport.id}`);
            }));
        });
        describe('when the api responds with a 401', () => {
            it('throws an UnauthorizedException', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'get');
                workosSpy.mockImplementationOnce(() => {
                    throw new fetch_error_1.FetchError({
                        message: 'Could not authorize the request. Maybe your API key is invalid?',
                        response: { status: 401, headers: new Headers(), data: {} },
                    });
                });
                const workos = new workos_1.WorkOS('invalid apikey');
                yield expect(workos.auditLogs.getExport('audit_log_export_1234')).rejects.toThrowError(new exceptions_1.UnauthorizedException('a-request-id'));
                expect(workosSpy).toHaveBeenCalledWith(`/audit_logs/exports/audit_log_export_1234`);
            }));
        });
    });
    describe('createSchema', () => {
        describe('with an idempotency key', () => {
            it('includes an idempotency key with request', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const time = new Date().toISOString();
                const createSchemaResult = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                user_id: 'string',
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            actor_id: 'string',
                        },
                    },
                    metadata: {
                        foo: 'number',
                        baz: 'boolean',
                    },
                    createdAt: time,
                };
                const createSchemaResponse = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                type: 'object',
                                properties: {
                                    user_id: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            type: 'object',
                            properties: {
                                actor_id: {
                                    type: 'string',
                                },
                            },
                        },
                    },
                    metadata: {
                        type: 'object',
                        properties: {
                            foo: {
                                type: 'number',
                            },
                            baz: {
                                type: 'boolean',
                            },
                        },
                    },
                    created_at: time,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, createSchemaResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createSchema(schema, {
                    idempotencyKey: 'the-idempotency-key',
                })).resolves.toEqual(createSchemaResult);
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/actions/user.logged_in/schemas', (0, serializers_1.serializeCreateAuditLogSchemaOptions)(schema), { idempotencyKey: 'the-idempotency-key' });
            }));
        });
        describe('without metadata', () => {
            it('does not include metadata with the request', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const time = new Date().toISOString();
                const createSchemaResult = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                user_id: 'string',
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            actor_id: 'string',
                        },
                    },
                    metadata: undefined,
                    createdAt: time,
                };
                const createSchemaResponse = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                type: 'object',
                                properties: {
                                    user_id: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            type: 'object',
                            properties: {
                                actor_id: {
                                    type: 'string',
                                },
                            },
                        },
                    },
                    created_at: time,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, createSchemaResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createSchema(schemaWithoutMetadata)).resolves.toEqual(createSchemaResult);
                expect(workosSpy).toHaveBeenCalledWith('/audit_logs/actions/user.logged_in/schemas', (0, serializers_1.serializeCreateAuditLogSchemaOptions)(schemaWithoutMetadata), {});
            }));
        });
        describe('when the api responds with a 201', () => {
            it('returns `audit_log_schema`', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const time = new Date().toISOString();
                const createSchemaResult = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                user_id: 'string',
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            actor_id: 'string',
                        },
                    },
                    metadata: {
                        foo: 'number',
                        baz: 'boolean',
                    },
                    createdAt: time,
                };
                const createSchemaResponse = {
                    object: 'audit_log_schema',
                    version: 1,
                    targets: [
                        {
                            type: 'user',
                            metadata: {
                                type: 'object',
                                properties: {
                                    user_id: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    ],
                    actor: {
                        metadata: {
                            type: 'object',
                            properties: {
                                actor_id: {
                                    type: 'string',
                                },
                            },
                        },
                    },
                    metadata: {
                        type: 'object',
                        properties: {
                            foo: {
                                type: 'number',
                            },
                            baz: {
                                type: 'boolean',
                            },
                        },
                    },
                    created_at: time,
                };
                workosSpy.mockResolvedValueOnce((0, workos_mock_response_1.mockWorkOsResponse)(201, createSchemaResponse));
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createSchema(schema, {
                    idempotencyKey: 'the-idempotency-key',
                })).resolves.toEqual(createSchemaResult);
            }));
        });
        describe('when the api responds with a 400', () => {
            it('throws a BadRequestException', () => __awaiter(void 0, void 0, void 0, function* () {
                const workosSpy = jest.spyOn(workos_1.WorkOS.prototype, 'post');
                const errors = [
                    {
                        field: 'actor.metadata',
                        code: 'actor.metadata must be an object',
                    },
                ];
                workosSpy.mockImplementationOnce(() => {
                    throw new bad_request_exception_1.BadRequestException({
                        code: '400',
                        errors,
                        message: 'Audit Log Schema could not be processed due to missing or incorrect data.',
                        requestID: 'a-request-id',
                    });
                });
                const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.auditLogs.createSchema(schema)).rejects.toThrow(bad_request_exception_1.BadRequestException);
            }));
        });
    });
});
