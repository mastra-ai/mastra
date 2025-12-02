import { RequestException } from '../interfaces/request-exception.interface';
export declare class ConflictException extends Error implements RequestException {
    readonly status = 409;
    readonly name = "ConflictException";
    readonly requestID: string;
    constructor({ error, message, requestID, }: {
        error?: string;
        message?: string;
        requestID: string;
    });
}
