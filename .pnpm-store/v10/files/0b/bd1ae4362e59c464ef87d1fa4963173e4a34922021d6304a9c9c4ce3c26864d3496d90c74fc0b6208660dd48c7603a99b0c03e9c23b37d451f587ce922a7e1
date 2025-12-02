import { bn as SessionQueryParams, fn as InferActions, hn as InferErrorCodes, mn as InferClientAPI, yn as IsSignal } from "../../index--CrC0_x3.mjs";
import "../../types-CRiHq5rJ.mjs";
import { a as LiteralNumber, c as OmitId, d as PrettifyDeep, f as Primitive, g as WithoutEmpty, h as UnionToIntersection, i as HasRequiredKeys, l as PreserveJSDoc, m as StripEmptyObjects, n as DeepPartial, o as LiteralString, p as RequiredKeysOf, r as Expand, s as LiteralUnion, t as Awaitable, u as Prettify } from "../../helper-DU33OcfW.mjs";
import "../../index-CNCxG_Zo.mjs";
import "../../plugins-Brc8BsoZ.mjs";
import { BetterAuthClientOptions, BetterAuthClientPlugin } from "@better-auth/core";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import * as nanostores0 from "nanostores";
import { Store, StoreValue } from "nanostores";
import * as _better_fetch_fetch0 from "@better-fetch/fetch";
import { BetterFetchError } from "@better-fetch/fetch";
import { DependencyList } from "react";
export * from "nanostores";
export * from "@better-fetch/fetch";

//#region src/client/react/react-store.d.ts
type StoreKeys<T> = T extends {
  setKey: (k: infer K, v: any) => unknown;
} ? K : never;
interface UseStoreOptions<SomeStore> {
  /**
   * @default
   * ```ts
   * [store, options.keys]
   * ```
   */
  deps?: DependencyList | undefined;
  /**
   * Will re-render components only on specific key changes.
   */
  keys?: StoreKeys<SomeStore>[] | undefined;
}
/**
 * Subscribe to store changes and get store's value.
 *
 * Can be used with store builder too.
 *
 * ```js
 * import { useStore } from 'nanostores/react'
 *
 * import { router } from '../store/router'
 *
 * export const Layout = () => {
 *   let page = useStore(router)
 *   if (page.route === 'home') {
 *     return <HomePage />
 *   } else {
 *     return <Error404 />
 *   }
 * }
 * ```
 *
 * @param store Store instance.
 * @returns Store value.
 */
declare function useStore<SomeStore extends Store>(store: SomeStore, options?: UseStoreOptions<SomeStore>): StoreValue<SomeStore>;
//#endregion
//#region src/client/react/index.d.ts
declare function capitalizeFirstLetter(str: string): string;
type InferResolvedHooks<O extends BetterAuthClientOptions> = O extends {
  plugins: Array<infer Plugin>;
} ? UnionToIntersection<Plugin extends BetterAuthClientPlugin ? Plugin["getAtoms"] extends ((fetch: any) => infer Atoms) ? Atoms extends Record<string, any> ? { [key in keyof Atoms as IsSignal<key> extends true ? never : key extends string ? `use${Capitalize<key>}` : never]: () => ReturnType<Atoms[key]["get"]> } : {} : {} : {}> : {};
declare function createAuthClient<Option extends BetterAuthClientOptions>(options?: Option | undefined): UnionToIntersection<InferResolvedHooks<Option>> & InferClientAPI<Option> & InferActions<Option> & {
  useSession: () => {
    data: InferClientAPI<Option> extends {
      getSession: () => Promise<infer Res>;
    } ? Res extends {
      data: null;
      error: {
        message?: string | undefined;
        status: number;
        statusText: string;
      };
    } | {
      data: infer S;
      error: null;
    } ? S : Res : never;
    isPending: boolean;
    isRefetching: boolean;
    error: BetterFetchError | null;
    refetch: (queryParams?: {
      query?: SessionQueryParams;
    } | undefined) => Promise<void>;
  };
  $Infer: {
    Session: NonNullable<InferClientAPI<Option> extends {
      getSession: () => Promise<infer Res>;
    } ? Res extends {
      data: null;
      error: {
        message?: string | undefined;
        status: number;
        statusText: string;
      };
    } | {
      data: infer S;
      error: null;
    } ? S : Res : never>;
  };
  $fetch: _better_fetch_fetch0.BetterFetch<{
    plugins: (_better_fetch_fetch0.BetterFetchPlugin | {
      id: string;
      name: string;
      hooks: {
        onSuccess(context: _better_fetch_fetch0.SuccessContext<any>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onRequest<T extends Record<string, any>>(context: _better_fetch_fetch0.RequestContext<T>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onSuccess: ((context: _better_fetch_fetch0.SuccessContext<any>) => Promise<void> | void) | undefined;
        onError: ((context: _better_fetch_fetch0.ErrorContext) => Promise<void> | void) | undefined;
        onRequest: (<T extends Record<string, any>>(context: _better_fetch_fetch0.RequestContext<T>) => Promise<_better_fetch_fetch0.RequestContext | void> | _better_fetch_fetch0.RequestContext | void) | undefined;
        onResponse: ((context: _better_fetch_fetch0.ResponseContext) => Promise<Response | void | _better_fetch_fetch0.ResponseContext> | Response | _better_fetch_fetch0.ResponseContext | void) | undefined;
      };
    })[];
    cache?: RequestCache | undefined;
    method: string;
    headers?: (HeadersInit & (HeadersInit | {
      accept: "application/json" | "text/plain" | "application/octet-stream";
      "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
      authorization: "Bearer" | "Basic";
    })) | undefined;
    redirect?: RequestRedirect | undefined;
    credentials?: RequestCredentials;
    integrity?: string | undefined;
    keepalive?: boolean | undefined;
    mode?: RequestMode | undefined;
    priority?: RequestPriority | undefined;
    referrer?: string | undefined;
    referrerPolicy?: ReferrerPolicy | undefined;
    signal?: (AbortSignal | null) | undefined;
    window?: null | undefined;
    onRetry?: ((response: _better_fetch_fetch0.ResponseContext) => Promise<void> | void) | undefined;
    hookOptions?: {
      cloneResponse?: boolean;
    } | undefined;
    timeout?: number | undefined;
    customFetchImpl: _better_fetch_fetch0.FetchEsque;
    baseURL: string;
    throw?: boolean | undefined;
    auth?: ({
      type: "Bearer";
      token: string | Promise<string | undefined> | (() => string | Promise<string | undefined> | undefined) | undefined;
    } | {
      type: "Basic";
      username: string | (() => string | undefined) | undefined;
      password: string | (() => string | undefined) | undefined;
    } | {
      type: "Custom";
      prefix: string | (() => string | undefined) | undefined;
      value: string | (() => string | undefined) | undefined;
    }) | undefined;
    body?: any;
    query?: any;
    params?: any;
    duplex?: "full" | "half" | undefined;
    jsonParser: (text: string) => Promise<any> | any;
    retry?: _better_fetch_fetch0.RetryOptions | undefined;
    retryAttempt?: number | undefined;
    output?: (_better_fetch_fetch0.StandardSchemaV1 | typeof Blob | typeof File) | undefined;
    errorSchema?: _better_fetch_fetch0.StandardSchemaV1 | undefined;
    disableValidation?: boolean | undefined;
    disableSignal?: boolean | undefined;
  }, unknown, unknown, {}>;
  $store: {
    notify: (signal?: (Omit<string, "$sessionSignal"> | "$sessionSignal") | undefined) => void;
    listen: (signal: Omit<string, "$sessionSignal"> | "$sessionSignal", listener: (value: boolean, oldValue?: boolean | undefined) => void) => void;
    atoms: Record<string, nanostores0.WritableAtom<any>>;
  };
  $ERROR_CODES: PrettifyDeep<InferErrorCodes<Option> & typeof BASE_ERROR_CODES>;
};
//#endregion
export { Awaitable, DeepPartial, Expand, HasRequiredKeys, LiteralNumber, LiteralString, LiteralUnion, OmitId, PreserveJSDoc, Prettify, PrettifyDeep, Primitive, RequiredKeysOf, StripEmptyObjects, type UnionToIntersection, WithoutEmpty, capitalizeFirstLetter, createAuthClient, useStore };