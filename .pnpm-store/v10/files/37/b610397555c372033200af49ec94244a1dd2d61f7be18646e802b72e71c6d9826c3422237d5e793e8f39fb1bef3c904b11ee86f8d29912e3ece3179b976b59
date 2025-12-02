import { IErrorMessages } from "../common/Exports.js";
/**
 * HTTP request helper
 */
export interface IRequestOptions {
    headers?: {
        [key: string]: string;
    };
    ignoreCache?: boolean;
    timeout?: number;
}
export interface IRestParams {
    apiVersion: string;
    authorization: string;
    clientAppId: string;
    contentTypeKey: string;
    correlationId: string;
    languageCode: string;
    nickname: string;
    profanity: string;
    requestId: string;
    roomId: string;
    sessionToken: string;
    subscriptionKey: string;
    subscriptionRegion: string;
    token: string;
}
export declare class RestConfigBase {
    static get requestOptions(): IRequestOptions;
    static get configParams(): IRestParams;
    static get restErrors(): IErrorMessages;
    private static readonly privDefaultRequestOptions;
    private static readonly privRestErrors;
    private static readonly privDefaultParams;
}
