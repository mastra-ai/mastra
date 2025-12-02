import { Emitter } from 'strict-event-emitter';
import { H as HttpRequestEventMap } from '../../glossary-f7ee1c9d.js';
import { I as Interceptor } from '../../Interceptor-af98b768.js';
import '@open-draft/logger';

type XMLHttpRequestEmitter = Emitter<HttpRequestEventMap>;
declare class XMLHttpRequestInterceptor extends Interceptor<HttpRequestEventMap> {
    static interceptorSymbol: symbol;
    constructor();
    protected checkEnvironment(): boolean;
    protected setup(): void;
}

export { XMLHttpRequestEmitter, XMLHttpRequestInterceptor };
