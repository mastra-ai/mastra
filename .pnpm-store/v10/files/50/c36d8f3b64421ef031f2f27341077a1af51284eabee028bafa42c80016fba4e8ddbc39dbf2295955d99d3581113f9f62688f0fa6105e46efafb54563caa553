"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthException = void 0;
class OauthException extends Error {
    constructor(status, requestID, error, errorDescription, rawData) {
        super();
        this.status = status;
        this.requestID = requestID;
        this.error = error;
        this.errorDescription = errorDescription;
        this.rawData = rawData;
        this.name = 'OauthException';
        if (error && errorDescription) {
            this.message = `Error: ${error}\nError Description: ${errorDescription}`;
        }
        else if (error) {
            this.message = `Error: ${error}`;
        }
        else {
            this.message = `An error has occurred.`;
        }
    }
}
exports.OauthException = OauthException;
