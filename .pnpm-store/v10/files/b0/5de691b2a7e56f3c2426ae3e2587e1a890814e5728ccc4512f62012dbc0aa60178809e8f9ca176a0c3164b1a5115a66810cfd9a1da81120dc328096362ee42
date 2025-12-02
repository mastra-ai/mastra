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
const test_utils_1 = require("./common/utils/test-utils");
const promises_1 = __importDefault(require("fs/promises"));
const exceptions_1 = require("./common/exceptions");
const parse_error_1 = require("./common/exceptions/parse-error");
const index_1 = require("./index");
const index_worker_1 = require("./index.worker");
const rate_limit_exceeded_exception_1 = require("./common/exceptions/rate-limit-exceeded.exception");
const fetch_client_1 = require("./common/net/fetch-client");
const node_client_1 = require("./common/net/node-client");
const subtle_crypto_provider_1 = require("./common/crypto/subtle-crypto-provider");
describe('WorkOS', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('constructor', () => {
        const OLD_ENV = process.env;
        beforeEach(() => {
            jest.resetModules();
            process.env = Object.assign({}, OLD_ENV);
            delete process.env.NODE_ENV;
        });
        afterEach(() => {
            process.env = OLD_ENV;
        });
        describe('when no API key is provided', () => {
            it('throws a NoApiKeyFoundException error', () => __awaiter(void 0, void 0, void 0, function* () {
                expect(() => new index_1.WorkOS()).toThrowError(exceptions_1.NoApiKeyProvidedException);
            }));
        });
        describe('when API key is provided with environment variable', () => {
            it('initializes', () => __awaiter(void 0, void 0, void 0, function* () {
                process.env.WORKOS_API_KEY = 'sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU';
                expect(() => new index_1.WorkOS()).not.toThrow();
            }));
        });
        describe('when API key is provided with constructor', () => {
            it('initializes', () => __awaiter(void 0, void 0, void 0, function* () {
                expect(() => new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU')).not.toThrow();
            }));
        });
        describe('with https option', () => {
            it('sets baseURL', () => {
                const workos = new index_1.WorkOS('foo', { https: false });
                expect(workos.baseURL).toEqual('http://api.workos.com');
            });
        });
        describe('with apiHostname option', () => {
            it('sets baseURL', () => {
                const workos = new index_1.WorkOS('foo', { apiHostname: 'localhost' });
                expect(workos.baseURL).toEqual('https://localhost');
            });
        });
        describe('with port option', () => {
            it('sets baseURL', () => {
                const workos = new index_1.WorkOS('foo', {
                    apiHostname: 'localhost',
                    port: 4000,
                });
                expect(workos.baseURL).toEqual('https://localhost:4000');
            });
        });
        describe('when the `config` option is provided', () => {
            it('applies the configuration to the fetch client', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)('{}', { headers: { 'X-Request-ID': 'a-request-id' } });
                const workos = new index_1.WorkOS('sk_test', {
                    config: {
                        headers: {
                            'X-My-Custom-Header': 'Hey there!',
                        },
                    },
                });
                yield workos.post('/somewhere', {});
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    'X-My-Custom-Header': 'Hey there!',
                });
            }));
        });
        describe('when the `appInfo` option is provided', () => {
            it('applies the configuration to the fetch client user-agent', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)('{}');
                const packageJson = JSON.parse(yield promises_1.default.readFile('package.json', 'utf8'));
                const workos = new index_1.WorkOS('sk_test', {
                    appInfo: {
                        name: 'fooApp',
                        version: '1.0.0',
                    },
                });
                yield workos.post('/somewhere', {});
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    'User-Agent': `workos-node/${packageJson.version}/fetch fooApp: 1.0.0`,
                });
            }));
        });
        describe('when no `appInfo` option is provided', () => {
            it('adds the HTTP client name to the user-agent', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)('{}');
                const packageJson = JSON.parse(yield promises_1.default.readFile('package.json', 'utf8'));
                const workos = new index_1.WorkOS('sk_test');
                yield workos.post('/somewhere', {});
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    'User-Agent': `workos-node/${packageJson.version}/fetch`,
                });
            }));
        });
        describe('when no `appInfo` option is provided', () => {
            it('adds the HTTP client name to the user-agent', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)('{}');
                const packageJson = JSON.parse(yield promises_1.default.readFile('package.json', 'utf8'));
                const workos = new index_1.WorkOS('sk_test');
                yield workos.post('/somewhere', {});
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    'User-Agent': `workos-node/${packageJson.version}/fetch`,
                });
            }));
        });
        describe('when using an environment that supports fetch', () => {
            it('automatically uses the fetch HTTP client', () => {
                const workos = new index_1.WorkOS('sk_test');
                // Bracket notation gets past private visibility
                // tslint:disable-next-line
                expect(workos['client']).toBeInstanceOf(fetch_client_1.FetchHttpClient);
            });
        });
    });
    describe('version', () => {
        it('matches the version in `package.json`', () => __awaiter(void 0, void 0, void 0, function* () {
            const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            // Read `package.json` using file I/O instead of `require` so we don't run
            // into issues with the `require` cache.
            const packageJson = JSON.parse(yield promises_1.default.readFile('package.json', 'utf8'));
            expect(workos.version).toBe(packageJson.version);
        }));
    });
    describe('post', () => {
        describe('when the api responds with a 404', () => {
            it('throws a NotFoundException', () => __awaiter(void 0, void 0, void 0, function* () {
                const message = 'Not Found';
                (0, test_utils_1.fetchOnce)({ message }, { status: 404, headers: { 'X-Request-ID': 'a-request-id' } });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.post('/path', {})).rejects.toStrictEqual(new exceptions_1.NotFoundException({
                    message,
                    path: '/path',
                    requestID: 'a-request-id',
                }));
            }));
            it('preserves the error code, status, and message from the underlying response', () => __awaiter(void 0, void 0, void 0, function* () {
                const message = 'The thing you are looking for is not here.';
                const code = 'thing-not-found';
                (0, test_utils_1.fetchOnce)({ code, message }, { status: 404, headers: { 'X-Request-ID': 'a-request-id' } });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.post('/path', {})).rejects.toMatchObject({
                    code,
                    message,
                    status: 404,
                });
            }));
            it('includes the path in the message if there is no message in the response', () => __awaiter(void 0, void 0, void 0, function* () {
                const code = 'thing-not-found';
                const path = '/path/to/thing/that-aint-there';
                (0, test_utils_1.fetchOnce)({ code }, { status: 404, headers: { 'X-Request-ID': 'a-request-id' } });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.post(path, {})).rejects.toMatchObject({
                    code,
                    message: `The requested path '${path}' could not be found.`,
                    status: 404,
                });
            }));
        });
        describe('when the api responds with a 500 and no error/error_description', () => {
            it('throws an GenericServerException', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({}, {
                    status: 500,
                    headers: { 'X-Request-ID': 'a-request-id' },
                });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.post('/path', {})).rejects.toStrictEqual(new exceptions_1.GenericServerException(500, undefined, {}, 'a-request-id'));
            }));
        });
        describe('when the api responds with a 400 and an error/error_description', () => {
            it('throws an OauthException', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({ error: 'error', error_description: 'error description' }, {
                    status: 400,
                    headers: { 'X-Request-ID': 'a-request-id' },
                });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.post('/path', {})).rejects.toStrictEqual(new exceptions_1.OauthException(400, 'a-request-id', 'error', 'error description', { error: 'error', error_description: 'error description' }));
            }));
        });
        describe('when the api responses with a 429', () => {
            it('throws a RateLimitExceededException', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)({
                    message: 'Too many requests',
                }, {
                    status: 429,
                    headers: { 'X-Request-ID': 'a-request-id', 'Retry-After': '10' },
                });
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield expect(workos.get('/path')).rejects.toStrictEqual(new rate_limit_exceeded_exception_1.RateLimitExceededException('Too many requests', 'a-request-id', 10));
            }));
        });
        describe('when the entity is null', () => {
            it('sends an empty string body', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)();
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                yield workos.post('/somewhere', null);
                expect((0, test_utils_1.fetchBody)({ raw: true })).toBe('');
            }));
        });
        describe('when the api responds with invalid JSON', () => {
            it('throws a ParseError', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockResponse = {
                    ok: true,
                    status: 200,
                    headers: new Headers({
                        'X-Request-ID': 'a-request-id',
                        'content-type': 'application/json',
                    }),
                    text: () => Promise.resolve('invalid json{'),
                    json: () => Promise.reject(new SyntaxError('Invalid JSON')),
                };
                jest_fetch_mock_1.default.mockResolvedValueOnce(mockResponse);
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const error = yield workos.post('/path', {}).catch((e) => e);
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                expect(error.rawBody).toBe('invalid json{');
                expect(error.requestID).toBe('a-request-id');
            }));
        });
    });
    describe('get', () => {
        describe('when the api responds with invalid JSON', () => {
            it('throws a ParseError', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockResponse = {
                    ok: true,
                    status: 200,
                    headers: new Headers({
                        'X-Request-ID': 'a-request-id',
                        'content-type': 'application/json',
                    }),
                    text: () => Promise.resolve('malformed json}'),
                    json: () => Promise.reject(new SyntaxError('Invalid JSON')),
                };
                jest_fetch_mock_1.default.mockResolvedValueOnce(mockResponse);
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const error = yield workos.get('/path').catch((e) => e);
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                expect(error.rawBody).toBe('malformed json}');
                expect(error.requestID).toBe('a-request-id');
            }));
        });
    });
    describe('put', () => {
        describe('when the api responds with invalid JSON', () => {
            it('throws a ParseError', () => __awaiter(void 0, void 0, void 0, function* () {
                const mockResponse = {
                    ok: true,
                    status: 200,
                    headers: new Headers({
                        'X-Request-ID': 'a-request-id',
                        'content-type': 'application/json',
                    }),
                    text: () => Promise.resolve('broken json['),
                    json: () => Promise.reject(new SyntaxError('Invalid JSON')),
                };
                jest_fetch_mock_1.default.mockResolvedValueOnce(mockResponse);
                const workos = new index_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
                const error = yield workos.put('/path', {}).catch((e) => e);
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                expect(error.rawBody).toBe('broken json[');
                expect(error.requestID).toBe('a-request-id');
            }));
        });
    });
    describe('when in an environment that does not support fetch', () => {
        const fetchFn = globalThis.fetch;
        beforeEach(() => {
            // @ts-ignore
            delete globalThis.fetch;
        });
        afterEach(() => {
            globalThis.fetch = fetchFn;
        });
        it('automatically uses the node HTTP client', () => {
            const workos = new index_1.WorkOS('sk_test_key');
            // tslint:disable-next-line
            expect(workos['client']).toBeInstanceOf(node_client_1.NodeHttpClient);
        });
        it('uses a fetch function if provided', () => {
            const workos = new index_1.WorkOS('sk_test_key', {
                fetchFn,
            });
            // tslint:disable-next-line
            expect(workos['client']).toBeInstanceOf(fetch_client_1.FetchHttpClient);
        });
    });
    describe('when in a worker environment', () => {
        it('uses the worker client', () => {
            const workos = new index_worker_1.WorkOS('sk_test_key');
            // tslint:disable-next-line
            expect(workos['client']).toBeInstanceOf(fetch_client_1.FetchHttpClient);
            expect(
            // tslint:disable-next-line
            workos.webhooks['signatureProvider']['cryptoProvider']).toBeInstanceOf(subtle_crypto_provider_1.SubtleCryptoProvider);
            expect(
            // tslint:disable-next-line
            workos.actions['signatureProvider']['cryptoProvider']).toBeInstanceOf(subtle_crypto_provider_1.SubtleCryptoProvider);
        });
        it('uses console.warn to emit warnings', () => {
            const workos = new index_worker_1.WorkOS('sk_test_key');
            const warnSpy = jest.spyOn(console, 'warn');
            workos.emitWarning('foo');
            expect(warnSpy).toHaveBeenCalledWith('WorkOS: foo');
        });
    });
    describe('when in a node environment', () => {
        it('uses process.emitWarning to emit warnings', () => {
            const workos = new index_1.WorkOS('sk_test_key');
            const warnSpy = jest.spyOn(process, 'emitWarning');
            workos.emitWarning('foo');
            expect(warnSpy).toHaveBeenCalledWith('foo', 'WorkOS');
        });
    });
});
