/// <reference types="koa__router" />
import type { Middleware, ParameterizedContext, DefaultState } from 'koa';
import type * as Router from '@koa/router';
export declare type KoaContext = ParameterizedContext<DefaultState, Router.RouterParamContext>;
export declare type KoaMiddleware = Middleware<DefaultState, KoaContext> & {
    router?: Router;
};
/**
 * This symbol is used to mark a Koa layer as being already instrumented
 * since its possible to use a given layer multiple times (ex: middlewares)
 */
export declare const kLayerPatched: unique symbol;
export declare type KoaPatchedMiddleware = KoaMiddleware & {
    [kLayerPatched]?: boolean;
};
//# sourceMappingURL=internal-types.d.ts.map