import { RequestException } from '../interfaces/request-exception.interface';
export declare class NotFoundException extends Error implements RequestException {
    readonly status = 404;
    readonly name = "NotFoundException";
    readonly message: string;
    readonly code?: string;
    readonly requestID: string;
    constructor({ code, message, path, requestID, }: {
        code?: string;
        message?: string;
        path: string;
        requestID: string;
    });
}
