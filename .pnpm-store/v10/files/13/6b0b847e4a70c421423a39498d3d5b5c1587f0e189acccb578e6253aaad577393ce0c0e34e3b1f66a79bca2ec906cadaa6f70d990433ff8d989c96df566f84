"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnauthorizedException = void 0;
class UnauthorizedException extends Error {
    constructor(requestID) {
        super();
        this.requestID = requestID;
        this.status = 401;
        this.name = 'UnauthorizedException';
        this.message = `Could not authorize the request. Maybe your API key is invalid?`;
    }
}
exports.UnauthorizedException = UnauthorizedException;
