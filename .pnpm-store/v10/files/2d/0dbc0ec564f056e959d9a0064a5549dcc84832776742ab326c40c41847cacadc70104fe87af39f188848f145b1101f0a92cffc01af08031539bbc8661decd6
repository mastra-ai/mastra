"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitExceededException = void 0;
const generic_server_exception_1 = require("./generic-server.exception");
// Inheriting from `GenericServerException` in order to maintain backwards
// compatibility with what 429 errors would have previously been thrown as.
//
// TODO: Consider making it the base class for all request errors.
class RateLimitExceededException extends generic_server_exception_1.GenericServerException {
    constructor(message, requestID, 
    /**
     * The number of seconds to wait before retrying the request.
     */
    retryAfter) {
        super(429, message, {}, requestID);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitExceededException';
    }
}
exports.RateLimitExceededException = RateLimitExceededException;
