"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var indexOperationsBuilder_1 = require("../indexOperationsBuilder");
var control_1 = require("../../pinecone-generated-ts-fetch/control");
jest.mock('../../pinecone-generated-ts-fetch/control', function () { return (__assign(__assign({}, jest.requireActual('../../pinecone-generated-ts-fetch/control')), { Configuration: jest.fn() })); });
describe('indexOperationsBuilder', function () {
    test('API Configuration basePath is set to api.pinecone.io by default', function () {
        var config = { apiKey: 'test-api-key' };
        (0, indexOperationsBuilder_1.indexOperationsBuilder)(config);
        expect(control_1.Configuration).toHaveBeenCalledWith(expect.objectContaining({ basePath: 'https://api.pinecone.io' }));
    });
    test('controllerHostUrl overwrites the basePath in API Configuration', function () {
        var controllerHostUrl = 'https://test-controller-host-url.io';
        var config = {
            apiKey: 'test-api-key',
            controllerHostUrl: controllerHostUrl,
        };
        (0, indexOperationsBuilder_1.indexOperationsBuilder)(config);
        expect(control_1.Configuration).toHaveBeenCalledWith(expect.objectContaining({ basePath: controllerHostUrl }));
    });
    test('additionalHeaders are passed to the API Configuration', function () {
        var additionalHeaders = { 'x-test-header': 'test-value' };
        var config = { apiKey: 'test-api-key', additionalHeaders: additionalHeaders };
        (0, indexOperationsBuilder_1.indexOperationsBuilder)(config);
        expect(control_1.Configuration).toHaveBeenCalledWith(expect.objectContaining({
            headers: expect.objectContaining(additionalHeaders),
        }));
    });
});
//# sourceMappingURL=indexOperationsBuilder.test.js.map