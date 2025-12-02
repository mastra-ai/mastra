import { IRequestOptions } from "./Exports.js";
export declare enum RestRequestType {
    Get = "GET",
    Post = "POST",
    Delete = "DELETE",
    File = "file"
}
export interface IRestResponse {
    ok: boolean;
    status: number;
    statusText: string;
    data: string;
    json: any;
    headers: string;
}
export declare class RestMessageAdapter {
    private privIgnoreCache;
    private privHeaders;
    constructor(configParams: IRequestOptions);
    static extractHeaderValue(headerKey: string, headers: string): string;
    set options(configParams: IRequestOptions);
    setHeaders(key: string, value: string): void;
    request(method: RestRequestType, uri: string, queryParams?: {
        [key: string]: any;
    }, body?: any): Promise<IRestResponse>;
    private queryParams;
}
