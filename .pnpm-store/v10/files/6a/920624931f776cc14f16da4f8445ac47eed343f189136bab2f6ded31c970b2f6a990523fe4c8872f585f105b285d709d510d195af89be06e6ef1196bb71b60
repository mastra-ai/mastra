import { RequestException } from '../interfaces/request-exception.interface';
export declare class GenericServerException extends Error implements RequestException {
    readonly status: number;
    readonly rawData: unknown;
    readonly requestID: string;
    readonly name: string;
    readonly message: string;
    constructor(status: number, message: string | undefined, rawData: unknown, requestID: string);
}
