import { RequestException } from '../interfaces/request-exception.interface';
export declare class OauthException extends Error implements RequestException {
    readonly status: number;
    readonly requestID: string;
    readonly error: string | undefined;
    readonly errorDescription: string | undefined;
    readonly rawData: unknown;
    readonly name = "OauthException";
    constructor(status: number, requestID: string, error: string | undefined, errorDescription: string | undefined, rawData: unknown);
}
