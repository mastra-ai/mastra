"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundException = void 0;
class NotFoundException extends Error {
    constructor({ code, message, path, requestID, }) {
        super();
        this.status = 404;
        this.name = 'NotFoundException';
        this.code = code;
        this.message =
            message !== null && message !== void 0 ? message : `The requested path '${path}' could not be found.`;
        this.requestID = requestID;
    }
}
exports.NotFoundException = NotFoundException;
