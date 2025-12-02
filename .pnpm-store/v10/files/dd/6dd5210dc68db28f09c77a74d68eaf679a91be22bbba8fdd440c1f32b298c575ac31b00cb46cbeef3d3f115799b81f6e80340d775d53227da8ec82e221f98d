import { RequestException } from '../interfaces/request-exception.interface';
export declare class ParseError extends Error implements RequestException {
    readonly name = "ParseError";
    readonly status = 500;
    readonly rawBody: string;
    readonly rawStatus: number;
    readonly requestID: string;
    constructor({ message, rawBody, rawStatus, requestID, }: {
        message: string;
        rawBody: string;
        requestID: string;
        rawStatus: number;
    });
}
