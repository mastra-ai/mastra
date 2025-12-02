"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fetch_1 = require("../fetch");
var errors_1 = require("../../errors");
describe('getFetch', function () {
    afterEach(function () {
        console.log('resetting global.fetch');
        // Reset global.fetch after each test to avoid affecting other tests
        delete global.fetch;
    });
    test('should return the user-provided fetch implementation if provided', function () {
        var customFetch = jest.fn();
        var config = {
            apiKey: 'some-api-key',
            fetchApi: customFetch,
        };
        var fetchFn = (0, fetch_1.getFetch)(config);
        expect(fetchFn).toBe(customFetch);
    });
    test('should return the global fetch implementation if user-provided fetch is not present', function () {
        var globalFetch = jest.fn();
        global.fetch = globalFetch;
        var config = {
            apiKey: 'some-api-key',
            fetchApi: undefined,
        };
        var fetchFn = (0, fetch_1.getFetch)(config);
        expect(fetchFn).toBe(globalFetch);
    });
    test('should throw a PineconeConfigurationError if no fetch implementation is found', function () {
        var config = {
            apiKey: 'some-api-key',
            fetchApi: undefined,
        };
        expect(function () { return (0, fetch_1.getFetch)(config); }).toThrow(errors_1.PineconeConfigurationError);
        expect(function () { return (0, fetch_1.getFetch)(config); }).toThrow('No global or user-provided fetch implementations found. Please supply a fetch implementation.');
    });
});
//# sourceMappingURL=fetch.test.js.map