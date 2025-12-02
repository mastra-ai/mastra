import type { NormalizedOptions } from '../types/options.js';
import type { KyRequest } from '../types/request.js';
import type { KyResponse } from '../types/response.js';
export declare class HTTPError<T = unknown> extends Error {
    response: KyResponse<T>;
    request: KyRequest;
    options: NormalizedOptions;
    constructor(response: Response, request: Request, options: NormalizedOptions);
}
