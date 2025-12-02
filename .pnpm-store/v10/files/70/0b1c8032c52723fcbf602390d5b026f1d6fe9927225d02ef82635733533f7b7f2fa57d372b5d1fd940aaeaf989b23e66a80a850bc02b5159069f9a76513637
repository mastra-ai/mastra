import { UnprocessableEntityError } from '../interfaces';
import { RequestException } from '../interfaces/request-exception.interface';
export declare class UnprocessableEntityException extends Error implements RequestException {
    readonly status = 422;
    readonly name = "UnprocessableEntityException";
    readonly message: string;
    readonly code?: string;
    readonly requestID: string;
    constructor({ code, errors, message, requestID, }: {
        code?: string;
        errors?: UnprocessableEntityError[];
        message?: string;
        requestID: string;
    });
}
