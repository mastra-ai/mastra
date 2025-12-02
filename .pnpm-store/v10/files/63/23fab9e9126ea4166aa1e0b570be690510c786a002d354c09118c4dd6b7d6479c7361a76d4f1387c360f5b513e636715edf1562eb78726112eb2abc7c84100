import { CacheTypes, CredentialsTypes, Method, ModeTypes, RedirectTypes, ReferrerPolicyTypes, ReferrerTypes, RequestInitWithoutBody, RequestInitWithUrl } from "./core";
import { Body } from "./body";
import { Headers } from "./headers";
export declare class Request extends Body implements RequestInitWithoutBody {
    readonly method: Method;
    readonly url: string;
    readonly headers: Headers;
    readonly referrer: ReferrerTypes;
    readonly referrerPolicy: ReferrerPolicyTypes;
    readonly mode: ModeTypes;
    readonly credentials: CredentialsTypes;
    readonly redirect: RedirectTypes;
    readonly integrity: string;
    readonly cache: CacheTypes;
    readonly allowForbiddenHeaders: boolean;
    private _url;
    private _init;
    constructor(input: string | Request, init?: Partial<RequestInitWithUrl>);
    clone(newUrl?: string): Request;
}
