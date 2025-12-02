import { ChildProcess } from 'child_process';
import { i as Interceptor, H as HttpRequestEventMap } from './Interceptor-dc0a39b5.js';
import { a as BatchInterceptor } from './BatchInterceptor-cb9a2eee.js';
import { ClientRequestInterceptor } from './interceptors/ClientRequest/index.js';
import { XMLHttpRequestInterceptor } from './interceptors/XMLHttpRequest/index.js';
import { FetchInterceptor } from './interceptors/fetch/index.js';
import '@open-draft/logger';
import 'strict-event-emitter';
import 'node:net';

interface SerializedRequest {
    id: string;
    url: string;
    method: string;
    headers: Array<[string, string]>;
    credentials: RequestCredentials;
    body: string;
}
interface SerializedResponse {
    status: number;
    statusText: string;
    headers: Array<[string, string]>;
    body: string;
}
declare class RemoteHttpInterceptor extends BatchInterceptor<[
    ClientRequestInterceptor,
    XMLHttpRequestInterceptor,
    FetchInterceptor
]> {
    constructor();
    protected setup(): void;
}
declare function requestReviver(key: string, value: any): any;
interface RemoveResolverOptions {
    process: ChildProcess;
}
declare class RemoteHttpResolver extends Interceptor<HttpRequestEventMap> {
    static symbol: symbol;
    private process;
    constructor(options: RemoveResolverOptions);
    protected setup(): void;
}

export { RemoteHttpInterceptor, RemoteHttpResolver, RemoveResolverOptions, SerializedRequest, SerializedResponse, requestReviver };
