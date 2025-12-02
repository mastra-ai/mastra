"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseError = void 0;
class ParseError extends Error {
    constructor({ message, rawBody, rawStatus, requestID, }) {
        super(message);
        this.name = 'ParseError';
        this.status = 500;
        this.rawBody = rawBody;
        this.rawStatus = rawStatus;
        this.requestID = requestID;
    }
}
exports.ParseError = ParseError;
