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
const test_utils_1 = require("../../common/utils/test-utils");
const fetch_client_1 = require("./fetch-client");
const http_client_1 = require("./http-client");
const parse_error_1 = require("../exceptions/parse-error");
const fetchClient = new fetch_client_1.FetchHttpClient('https://test.workos.com', {
    headers: {
        Authorization: `Bearer sk_test`,
        'User-Agent': 'test-fetch-client',
    },
});
describe('Fetch client', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('fetchRequestWithRetry', () => {
        it('get for FGA path should call fetchRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockFetchRequestWithRetry = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'fetchRequestWithRetry');
            const response = yield fetchClient.get('/fga/v1/resources', {});
            expect(mockFetchRequestWithRetry).toHaveBeenCalledTimes(1);
            expect((0, test_utils_1.fetchURL)()).toBe('https://test.workos.com/fga/v1/resources');
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('post for FGA path should call fetchRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockFetchRequestWithRetry = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'fetchRequestWithRetry');
            const response = yield fetchClient.post('/fga/v1/resources', {}, {});
            expect(mockFetchRequestWithRetry).toHaveBeenCalledTimes(1);
            expect((0, test_utils_1.fetchURL)()).toBe('https://test.workos.com/fga/v1/resources');
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('put for FGA path should call fetchRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockFetchRequestWithRetry = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'fetchRequestWithRetry');
            const response = yield fetchClient.put('/fga/v1/resources/user/user-1', {}, {});
            expect(mockFetchRequestWithRetry).toHaveBeenCalledTimes(1);
            expect((0, test_utils_1.fetchURL)()).toBe('https://test.workos.com/fga/v1/resources/user/user-1');
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('delete for FGA path should call fetchRequestWithRetry and return response', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockFetchRequestWithRetry = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'fetchRequestWithRetry');
            const response = yield fetchClient.delete('/fga/v1/resources/user/user-1', {});
            expect(mockFetchRequestWithRetry).toHaveBeenCalledTimes(1);
            expect((0, test_utils_1.fetchURL)()).toBe('https://test.workos.com/fga/v1/resources/user/user-1');
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('should retry request on 500 status code', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({}, {
                status: 500,
            });
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockShouldRetryRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'shouldRetryRequest');
            const mockSleep = jest.spyOn(fetchClient, 'sleep');
            mockSleep.mockImplementation(() => Promise.resolve());
            const response = yield fetchClient.get('/fga/v1/resources', {});
            expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
            expect(mockSleep).toHaveBeenCalledTimes(1);
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('should retry request on 502 status code', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({}, {
                status: 502,
            });
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockShouldRetryRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'shouldRetryRequest');
            const mockSleep = jest.spyOn(fetchClient, 'sleep');
            mockSleep.mockImplementation(() => Promise.resolve());
            const response = yield fetchClient.get('/fga/v1/resources', {});
            expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
            expect(mockSleep).toHaveBeenCalledTimes(1);
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('should retry request on 504 status code', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({}, {
                status: 504,
            });
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockShouldRetryRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'shouldRetryRequest');
            const mockSleep = jest.spyOn(fetchClient, 'sleep');
            mockSleep.mockImplementation(() => Promise.resolve());
            const response = yield fetchClient.get('/fga/v1/resources', {});
            expect(mockShouldRetryRequest).toHaveBeenCalledTimes(2);
            expect(mockSleep).toHaveBeenCalledTimes(1);
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
        it('should retry request up to 3 times on retryable status code', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({}, {
                status: 500,
            });
            (0, test_utils_1.fetchOnce)({}, {
                status: 502,
            });
            (0, test_utils_1.fetchOnce)({}, {
                status: 504,
            });
            (0, test_utils_1.fetchOnce)({}, {
                status: 504,
            });
            const mockShouldRetryRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'shouldRetryRequest');
            const mockSleep = jest.spyOn(fetchClient, 'sleep');
            mockSleep.mockImplementation(() => Promise.resolve());
            yield expect(fetchClient.get('/fga/v1/resources', {})).rejects.toThrowError('Gateway Timeout');
            expect(mockShouldRetryRequest).toHaveBeenCalledTimes(4);
            expect(mockSleep).toHaveBeenCalledTimes(3);
        }));
        it('should not retry requests and throw error with non-retryable status code', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({}, {
                status: 400,
            });
            const mockShouldRetryRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'shouldRetryRequest');
            yield expect(fetchClient.get('/fga/v1/resources', {})).rejects.toThrowError('Bad Request');
            expect(mockShouldRetryRequest).toHaveBeenCalledTimes(1);
        }));
        it('should retry request on TypeError', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)({ data: 'response' });
            const mockFetchRequest = jest.spyOn(fetch_client_1.FetchHttpClient.prototype, 'fetchRequest');
            mockFetchRequest.mockImplementationOnce(() => {
                throw new TypeError('Network request failed');
            });
            const mockSleep = jest.spyOn(fetchClient, 'sleep');
            mockSleep.mockImplementation(() => Promise.resolve());
            const response = yield fetchClient.get('/fga/v1/resources', {});
            expect(mockFetchRequest).toHaveBeenCalledTimes(2);
            expect(mockSleep).toHaveBeenCalledTimes(1);
            expect(yield response.toJSON()).toEqual({ data: 'response' });
        }));
    });
    describe('error handling', () => {
        it('should throw ParseError when response body is not valid JSON on non-200 status', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock a 500 response with invalid JSON (like an HTML error page)
            jest_fetch_mock_1.default.mockResponseOnce('<html><body>Internal Server Error</body></html>', {
                status: 500,
                statusText: 'Internal Server Error',
                headers: {
                    'X-Request-ID': 'test-request-123',
                    'Content-Type': 'text/html',
                },
            });
            yield expect(fetchClient.get('/users', {})).rejects.toThrow(parse_error_1.ParseError);
            try {
                yield fetchClient.get('/users', {});
            }
            catch (error) {
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                const parseError = error;
                expect(parseError.message).toContain('Unexpected token');
                expect(parseError.rawBody).toBe('<html><body>Internal Server Error</body></html>');
                expect(parseError.requestID).toBe('test-request-123');
                expect(parseError.rawStatus).toBe(500);
            }
        }));
        it('should throw ParseError for non-FGA endpoints with invalid JSON response', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test with a non-FGA endpoint to ensure the error handling works for regular requests too
            jest_fetch_mock_1.default.mockResponseOnce('Not JSON content', {
                status: 400,
                statusText: 'Bad Request',
                headers: {
                    'X-Request-ID': 'bad-request-456',
                    'Content-Type': 'text/plain',
                },
            });
            yield expect(fetchClient.post('/organizations', { name: 'Test' }, {})).rejects.toThrow(parse_error_1.ParseError);
            try {
                yield fetchClient.post('/organizations', { name: 'Test' }, {});
            }
            catch (error) {
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                const parseError = error;
                expect(parseError.rawBody).toBe('Not JSON content');
                expect(parseError.requestID).toBe('bad-request-456');
                expect(parseError.rawStatus).toBe(400);
            }
        }));
        it('should throw ParseError when X-Request-ID header is missing', () => __awaiter(void 0, void 0, void 0, function* () {
            jest_fetch_mock_1.default.mockResponseOnce('Invalid JSON Response', {
                status: 422,
                statusText: 'Unprocessable Entity',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            try {
                yield fetchClient.put('/users/123', { name: 'Updated' }, {});
            }
            catch (error) {
                expect(error).toBeInstanceOf(parse_error_1.ParseError);
                const parseError = error;
                expect(parseError.rawBody).toBe('Invalid JSON Response');
                expect(parseError.requestID).toBe(''); // Should default to empty string when header is missing
                expect(parseError.rawStatus).toBe(422);
            }
        }));
    });
});
describe('FetchHttpClient with timeout', () => {
    let client;
    let mockFetch;
    beforeEach(() => {
        mockFetch = jest.fn();
        client = new fetch_client_1.FetchHttpClient('https://api.example.com', { timeout: 100 }, mockFetch);
    });
    it('should timeout requests that take too long', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock a fetch that respects AbortController
        mockFetch.mockImplementation((_, options) => {
            return new Promise((_, reject) => {
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        const error = new Error('AbortError');
                        error.name = 'AbortError';
                        reject(error);
                    });
                }
                // Never resolve - let the timeout trigger
            });
        });
        yield expect(client.post('/test', { data: 'test' }, {})).rejects.toThrow(http_client_1.HttpClientError);
        // Reset the mock for the second test
        mockFetch.mockClear();
        mockFetch.mockImplementation((_, options) => {
            return new Promise((_, reject) => {
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        const error = new Error('AbortError');
                        error.name = 'AbortError';
                        reject(error);
                    });
                }
                // Never resolve - let the timeout trigger
            });
        });
        yield expect(client.post('/test', { data: 'test' }, {})).rejects.toMatchObject({
            message: 'Request timeout after 100ms',
            response: {
                status: 408,
                data: { error: 'Request timeout' },
            },
        });
    }));
    it('should not timeout requests that complete quickly', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: new Map(),
            json: () => Promise.resolve({ success: true }),
            text: () => Promise.resolve('{"success": true}'),
        };
        mockFetch.mockResolvedValue(mockResponse);
        const result = yield client.post('/test', { data: 'test' }, {});
        expect(result).toBeDefined();
    }));
    it('should work without timeout configured', () => __awaiter(void 0, void 0, void 0, function* () {
        const clientWithoutTimeout = new fetch_client_1.FetchHttpClient('https://api.example.com', {}, mockFetch);
        const mockResponse = {
            ok: true,
            status: 200,
            headers: new Map(),
            json: () => Promise.resolve({ success: true }),
            text: () => Promise.resolve('{"success": true}'),
        };
        mockFetch.mockResolvedValue(mockResponse);
        const result = yield clientWithoutTimeout.post('/test', { data: 'test' }, {});
        expect(result).toBeDefined();
    }));
});
