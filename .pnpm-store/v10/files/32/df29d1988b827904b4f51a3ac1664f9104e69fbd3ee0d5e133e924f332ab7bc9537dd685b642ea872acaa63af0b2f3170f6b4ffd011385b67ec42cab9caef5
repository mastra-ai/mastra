import { Qn as DBTransactionAdapter, f as AuthContext, qn as DBAdapter } from "../index-CVLGS-cz.mjs";
import "../index-CdubV7uy.mjs";
import { t as AsyncLocalStorage } from "../index-DgwIISs7.mjs";
import { EndpointContext, InputContext } from "better-call";

//#region src/context/endpoint-context.d.ts
type AuthEndpointContext = Partial<InputContext<string, any> & EndpointContext<string, any>> & {
  context: AuthContext;
};
/**
 * This is for internal use only. Most users should use `getCurrentAuthContext` instead.
 *
 * It is exposed for advanced use cases where you need direct access to the AsyncLocalStorage instance.
 */
declare function getCurrentAuthContextAsyncLocalStorage(): Promise<AsyncLocalStorage<AuthEndpointContext>>;
declare function getCurrentAuthContext(): Promise<AuthEndpointContext>;
declare function runWithEndpointContext<T>(context: AuthEndpointContext, fn: () => T): Promise<T>;
//#endregion
//#region src/context/request-state.d.ts
type RequestStateWeakMap = WeakMap<object, any>;
declare function getRequestStateAsyncLocalStorage(): Promise<AsyncLocalStorage<RequestStateWeakMap>>;
declare function hasRequestState(): Promise<boolean>;
declare function getCurrentRequestState(): Promise<RequestStateWeakMap>;
declare function runWithRequestState<T>(store: RequestStateWeakMap, fn: () => T): Promise<T>;
interface RequestState<T> {
  get(): Promise<T>;
  set(value: T): Promise<void>;
  readonly ref: Readonly<object>;
}
/**
 * Defines a request-scoped state with lazy initialization.
 *
 * @param initFn - A function that initializes the state. It is called the first time `get()` is invoked within each request context, and only once per context.
 * @returns A RequestState object with `get` and `set` methods, and a unique `ref` for debugging.
 *
 * @example
 * const userState = defineRequestState(() => ({ id: '', name: '' }));
 * // Later, within a request context:
 * const user = await userState.get();
 */
declare function defineRequestState<T>(initFn: () => T | Promise<T>): RequestState<T>;
//#endregion
//#region src/context/transaction.d.ts
/**
 * This is for internal use only. Most users should use `getCurrentAdapter` instead.
 *
 * It is exposed for advanced use cases where you need direct access to the AsyncLocalStorage instance.
 */
declare const getCurrentDBAdapterAsyncLocalStorage: () => Promise<AsyncLocalStorage<DBTransactionAdapter>>;
declare const getCurrentAdapter: (fallback: DBTransactionAdapter) => Promise<DBTransactionAdapter>;
declare const runWithAdapter: <R>(adapter: DBAdapter, fn: () => R) => Promise<R>;
declare const runWithTransaction: <R>(adapter: DBAdapter, fn: () => R) => Promise<R>;
//#endregion
export { type AuthEndpointContext, type RequestState, type RequestStateWeakMap, defineRequestState, getCurrentAdapter, getCurrentAuthContext, getCurrentAuthContextAsyncLocalStorage, getCurrentDBAdapterAsyncLocalStorage, getCurrentRequestState, getRequestStateAsyncLocalStorage, hasRequestState, runWithAdapter, runWithEndpointContext, runWithRequestState, runWithTransaction };