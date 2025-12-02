"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestException = void 0;
class BadRequestException extends Error {
    constructor({ code, errors, message, requestID, }) {
        super();
        this.status = 400;
        this.name = 'BadRequestException';
        this.message = 'Bad request';
        this.requestID = requestID;
        if (message) {
            this.message = message;
        }
        if (code) {
            this.code = code;
        }
        if (errors) {
            this.errors = errors;
        }
    }
}
exports.BadRequestException = BadRequestException;
