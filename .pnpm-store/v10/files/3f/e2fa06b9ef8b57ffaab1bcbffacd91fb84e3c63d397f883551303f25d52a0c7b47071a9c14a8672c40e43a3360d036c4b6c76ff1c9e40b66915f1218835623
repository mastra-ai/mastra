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
const nock_1 = __importDefault(require("nock"));
const node_client_1 = require("./node-client");
const nodeClient = new node_client_1.NodeHttpClient('https://test.workos.com', {
    headers: {
        Authorization: `Bearer sk_test`,
        'User-Agent': 'test-node-client',
    },
});
describe('Node client', () => {
    beforeEach(() => nock_1.default.cleanAll());
    it('get for FGA path should call nodeRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockNodeRequestWithRetry = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'nodeRequestWithRetry');
        const response = yield nodeClient.get('/fga/v1/resources', {});
        expect(mockNodeRequestWithRetry).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('post for FGA path should call nodeRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .post('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockNodeRequestWithRetry = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'nodeRequestWithRetry');
        const response = yield nodeClient.post('/fga/v1/resources', {}, {});
        expect(mockNodeRequestWithRetry).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('put for FGA path should call nodeRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .put('/fga/v1/resources/user/user-1')
            .reply(200, { data: 'response' });
        const mockNodeRequestWithRetry = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'nodeRequestWithRetry');
        const response = yield nodeClient.put('/fga/v1/resources/user/user-1', {}, {});
        expect(mockNodeRequestWithRetry).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('delete for FGA path should call nodeRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .delete('/fga/v1/resources/user/user-1')
            .reply(200, { data: 'response' });
        const mockNodeRequestWithRetry = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'nodeRequestWithRetry');
        const response = yield nodeClient.delete('/fga/v1/resources/user/user-1', {});
        expect(mockNodeRequestWithRetry).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('should retry request on 500 status code', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .reply(500)
            .get('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        const mockSleep = jest.spyOn(nodeClient, 'sleep');
        mockSleep.mockImplementation(() => Promise.resolve());
        const response = yield nodeClient.get('/fga/v1/resources', {});
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
        expect(mockSleep).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('should retry request on 502 status code', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .reply(502)
            .get('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        const mockSleep = jest.spyOn(nodeClient, 'sleep');
        mockSleep.mockImplementation(() => Promise.resolve());
        const response = yield nodeClient.get('/fga/v1/resources', {});
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
        expect(mockSleep).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('should retry request on 504 status code', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .reply(504)
            .get('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        const mockSleep = jest.spyOn(nodeClient, 'sleep');
        mockSleep.mockImplementation(() => Promise.resolve());
        const response = yield nodeClient.get('/fga/v1/resources', {});
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
        expect(mockSleep).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
    it('should retry request up to 3 times on retryable status code', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .reply(504)
            .get('/fga/v1/resources')
            .reply(502)
            .get('/fga/v1/resources')
            .reply(500)
            .get('/fga/v1/resources')
            .reply(500);
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        const mockSleep = jest.spyOn(nodeClient, 'sleep');
        mockSleep.mockImplementation(() => Promise.resolve());
        yield expect(nodeClient.get('/fga/v1/resources', {})).rejects.toThrowError();
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(4);
        expect(mockSleep).toHaveBeenCalledTimes(3);
    }));
    it('should not retry request on non-retryable status code', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com').get('/fga/v1/resources').reply(400);
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        yield expect(nodeClient.get('/fga/v1/resources', {})).rejects.toThrowError();
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(1);
    }));
    it('should retry request on TypeError', () => __awaiter(void 0, void 0, void 0, function* () {
        (0, nock_1.default)('https://test.workos.com')
            .get('/fga/v1/resources')
            .replyWithError(new TypeError('Network request failed'))
            .get('/fga/v1/resources')
            .reply(200, { data: 'response' });
        const mockShouldRetryRequest = jest.spyOn(node_client_1.NodeHttpClient.prototype, 'shouldRetryRequest');
        const mockSleep = jest.spyOn(nodeClient, 'sleep');
        mockSleep.mockImplementation(() => Promise.resolve());
        const response = yield nodeClient.get('/fga/v1/resources', {});
        expect(mockShouldRetryRequest).toHaveBeenCalledTimes(1);
        expect(mockSleep).toHaveBeenCalledTimes(1);
        expect(yield response.toJSON()).toEqual({ data: 'response' });
    }));
});
