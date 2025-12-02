import { RequestException } from '../interfaces/request-exception.interface';
export declare class UnauthorizedException extends Error implements RequestException {
    readonly requestID: string;
    readonly status = 401;
    readonly name = "UnauthorizedException";
    readonly message: string;
    constructor(requestID: string);
}
