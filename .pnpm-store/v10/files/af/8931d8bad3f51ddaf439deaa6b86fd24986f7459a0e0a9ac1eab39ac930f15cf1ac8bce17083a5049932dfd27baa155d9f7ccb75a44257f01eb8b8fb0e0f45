"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var normalizeUrl_1 = require("../normalizeUrl");
describe('normalizeUrl', function () {
    test('empty string and undefined return undefined', function () {
        expect((0, normalizeUrl_1.normalizeUrl)('')).toBe(undefined);
        expect((0, normalizeUrl_1.normalizeUrl)('   ')).toBe(undefined);
        expect((0, normalizeUrl_1.normalizeUrl)()).toBe(undefined);
    });
    test('adds https:// to url if no protocol present', function () {
        expect((0, normalizeUrl_1.normalizeUrl)('index-name-abcdef.svc.pinecone.io')).toBe('https://index-name-abcdef.svc.pinecone.io');
    });
    test('keeps http:// protocol if present', function () {
        expect((0, normalizeUrl_1.normalizeUrl)('http://index-name-abcdef.svc.pinecone.io')).toBe('http://index-name-abcdef.svc.pinecone.io');
    });
    test('keeps https:// protocol if present', function () {
        expect((0, normalizeUrl_1.normalizeUrl)('https://index-name-abcdef.svc.pinecone.io')).toBe('https://index-name-abcdef.svc.pinecone.io');
    });
});
//# sourceMappingURL=normalizeUrl.test.js.map