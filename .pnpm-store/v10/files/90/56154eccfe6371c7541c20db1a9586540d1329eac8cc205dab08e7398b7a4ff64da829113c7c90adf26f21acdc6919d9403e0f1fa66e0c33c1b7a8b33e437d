import { RequestException } from '../interfaces/request-exception.interface';
export declare class BadRequestException extends Error implements RequestException {
    readonly status = 400;
    readonly name = "BadRequestException";
    readonly message: string;
    readonly code?: string;
    readonly errors?: unknown[];
    readonly requestID: string;
    constructor({ code, errors, message, requestID, }: {
        code?: string;
        errors?: unknown[];
        message?: string;
        requestID: string;
    });
}
