import { fn as InferActions, hn as InferErrorCodes, mn as InferClientAPI, yn as IsSignal } from "../../index--CrC0_x3.mjs";
import "../../types-CRiHq5rJ.mjs";
import { a as LiteralNumber, c as OmitId, d as PrettifyDeep, f as Primitive, g as WithoutEmpty, h as UnionToIntersection, i as HasRequiredKeys, l as PreserveJSDoc, m as StripEmptyObjects, n as DeepPartial, o as LiteralString, p as RequiredKeysOf, r as Expand, s as LiteralUnion, t as Awaitable, u as Prettify } from "../../helper-DU33OcfW.mjs";
import "../../index-CNCxG_Zo.mjs";
import "../../plugins-Brc8BsoZ.mjs";
import { BetterAuthClientOptions, BetterAuthClientPlugin } from "@better-auth/core";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import * as nanostores0 from "nanostores";
import * as _better_fetch_fetch16 from "@better-fetch/fetch";
import { BetterFetchError } from "@better-fetch/fetch";
import { DeepReadonly, Ref } from "vue";
export * from "nanostores";
export * from "@better-fetch/fetch";

//#region src/client/vue/index.d.ts
type InferResolvedHooks<O extends BetterAuthClientOptions> = O extends {
  plugins: Array<infer Plugin>;
} ? UnionToIntersection<Plugin extends BetterAuthClientPlugin ? Plugin["getAtoms"] extends ((fetch: any) => infer Atoms) ? Atoms extends Record<string, any> ? { [key in keyof Atoms as IsSignal<key> extends true ? never : key extends string ? `use${Capitalize<key>}` : never]: () => DeepReadonly<Ref<ReturnType<Atoms[key]["get"]>>> } : {} : {} : {}> : {};
declare function createAuthClient<Option extends BetterAuthClientOptions>(options?: Option | undefined): UnionToIntersection<InferResolvedHooks<Option>> & InferClientAPI<Option> & InferActions<Option> & {
  useSession: {
    (): DeepReadonly<Ref<{
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
      } ? S : Res extends Record<string, any> ? Res : never : never;
      isPending: boolean;
      isRefetching: boolean;
      error: BetterFetchError | null;
    }>>;
    <F extends (...args: any) => any>(useFetch: F): Promise<{
      data: Ref<InferClientAPI<Option> extends {
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
      } ? S : Res extends Record<string, any> ? Res : never : never>;
      isPending: false;
      error: Ref<{
        message?: string | undefined;
        status: number;
        statusText: string;
      }>;
    }>;
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
    } ? S : Res extends Record<string, any> ? Res : never : never>;
  };
  $fetch: _better_fetch_fetch16.BetterFetch<{
    plugins: (_better_fetch_fetch16.BetterFetchPlugin | {
      id: string;
      name: string;
      hooks: {
        onSuccess(context: _better_fetch_fetch16.SuccessContext<any>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onRequest<T extends Record<string, any>>(context: _better_fetch_fetch16.RequestContext<T>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onSuccess: ((context: _better_fetch_fetch16.SuccessContext<any>) => Promise<void> | void) | undefined;
        onError: ((context: _better_fetch_fetch16.ErrorContext) => Promise<void> | void) | undefined;
        onRequest: (<T extends Record<string, any>>(context: _better_fetch_fetch16.RequestContext<T>) => Promise<_better_fetch_fetch16.RequestContext | void> | _better_fetch_fetch16.RequestContext | void) | undefined;
        onResponse: ((context: _better_fetch_fetch16.ResponseContext) => Promise<Response | void | _better_fetch_fetch16.ResponseContext> | Response | _better_fetch_fetch16.ResponseContext | void) | undefined;
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
    onRetry?: ((response: _better_fetch_fetch16.ResponseContext) => Promise<void> | void) | undefined;
    hookOptions?: {
      cloneResponse?: boolean;
    } | undefined;
    timeout?: number | undefined;
    customFetchImpl: _better_fetch_fetch16.FetchEsque;
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
    retry?: _better_fetch_fetch16.RetryOptions | undefined;
    retryAttempt?: number | undefined;
    output?: (_better_fetch_fetch16.StandardSchemaV1 | typeof Blob | typeof File) | undefined;
    errorSchema?: _better_fetch_fetch16.StandardSchemaV1 | undefined;
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
export { Awaitable, DeepPartial, Expand, HasRequiredKeys, LiteralNumber, LiteralString, LiteralUnion, OmitId, PreserveJSDoc, Prettify, PrettifyDeep, Primitive, RequiredKeysOf, StripEmptyObjects, type UnionToIntersection, WithoutEmpty, createAuthClient };