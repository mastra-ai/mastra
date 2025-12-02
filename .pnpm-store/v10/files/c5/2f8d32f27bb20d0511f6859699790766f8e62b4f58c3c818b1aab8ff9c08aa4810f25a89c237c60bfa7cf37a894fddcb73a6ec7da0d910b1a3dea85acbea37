"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var debugLog_1 = require("../debugLog");
describe('debugLog', function () {
    var consoleLogSpy;
    beforeEach(function () {
        consoleLogSpy = jest
            .spyOn(console, 'log')
            .mockImplementation(function () { return jest.fn(); });
    });
    test('logs when PINECONE_DEBUG is true', function () {
        process.env.PINECONE_DEBUG = 'true';
        (0, debugLog_1.debugLog)('There was an error!');
        expect(consoleLogSpy).toHaveBeenCalledWith('There was an error!');
    });
    test('does not log when PINECONE_DEBUG is false', function () {
        delete process.env.PINECONE_DEBUG;
        (0, debugLog_1.debugLog)('There was an error!');
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=debugLog.test.js.map