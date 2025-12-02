"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../index");
describe('Client initialization', function () {
    test('can accept a config object', function () {
        var client = new index_1.Pinecone({
            apiKey: process.env.PINECONE_API_KEY || '',
        });
        expect(client).toBeDefined();
    });
    test('can accept no arguments and read from environment variables', function () {
        var client = new index_1.Pinecone();
        expect(client).toBeDefined();
    });
});
//# sourceMappingURL=initialization.test.js.map