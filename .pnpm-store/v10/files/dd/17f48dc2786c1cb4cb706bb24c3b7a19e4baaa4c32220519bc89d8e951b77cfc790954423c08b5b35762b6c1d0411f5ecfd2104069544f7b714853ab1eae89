"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictException = void 0;
class ConflictException extends Error {
    constructor({ error, message, requestID, }) {
        super();
        this.status = 409;
        this.name = 'ConflictException';
        this.requestID = requestID;
        if (message) {
            this.message = message;
        }
        else if (error) {
            this.message = `Error: ${error}`;
        }
        else {
            this.message = `An conflict has occurred on the server.`;
        }
    }
}
exports.ConflictException = ConflictException;
