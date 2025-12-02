import { Endpoint, HasRequiredKeys, Router, UnionToIntersection } from "./router-DxkLDx_d.cjs";
import { BetterFetchOption, BetterFetchResponse } from "@better-fetch/fetch";

//#region src/client.d.ts
type HasRequired<T extends {
  body?: any;
  query?: any;
  params?: any;
}> = T["body"] extends object ? HasRequiredKeys<T["body"]> extends true ? true : T["query"] extends object ? HasRequiredKeys<T["query"]> extends true ? true : T["params"] extends object ? HasRequiredKeys<T["params"]> : false : T["params"] extends object ? HasRequiredKeys<T["params"]> : false : T["query"] extends object ? HasRequiredKeys<T["query"]> extends true ? true : T["params"] extends object ? HasRequiredKeys<T["params"]> : false : T["params"] extends object ? HasRequiredKeys<T["params"]> : false;
type InferContext<T> = T extends ((ctx: infer Ctx) => any) ? Ctx extends object ? Ctx : never : never;
interface ClientOptions extends BetterFetchOption {
  baseURL: string;
}
type WithRequired<T, K> = T & { [P in K extends string ? K : never]-?: T[P extends keyof T ? P : never] };
type InferClientRoutes<T extends Record<string, Endpoint>> = { [K in keyof T]: T[K] extends Endpoint<any, infer O> ? O extends {
  metadata: {
    scope: "http";
  };
} | {
  metadata: {
    scope: "server";
  };
} | {
  metadata: {
    SERVER_ONLY: true;
  };
} | {
  metadata: {
    isAction: false;
  };
} ? never : T[K] : T[K] };
type RequiredOptionKeys<C extends {
  body?: any;
  query?: any;
  params?: any;
}> = (undefined extends C["body"] ? {} : {
  body: true;
}) & (undefined extends C["query"] ? {} : {
  query: true;
}) & (undefined extends C["params"] ? {} : {
  params: true;
});
declare const createClient: <R extends Router | Router["endpoints"]>(options: ClientOptions) => <OPT extends (UnionToIntersection<InferClientRoutes<R extends {
  endpoints: Record<string, Endpoint>;
} ? R["endpoints"] : R> extends {
  [key: string]: infer T_1;
} ? T_1 extends Endpoint ? { [key in T_1["options"]["method"] extends "GET" ? T_1["path"] : `@${T_1["options"]["method"] extends string ? Lowercase<T_1["options"]["method"]> : never}${T_1["path"]}`]: T_1 } : {} : {}> extends infer T ? { [K_1 in keyof T]: UnionToIntersection<InferClientRoutes<R extends {
  endpoints: Record<string, Endpoint>;
} ? R["endpoints"] : R> extends {
  [key: string]: infer T_1;
} ? T_1 extends Endpoint ? { [key in T_1["options"]["method"] extends "GET" ? T_1["path"] : `@${T_1["options"]["method"] extends string ? Lowercase<T_1["options"]["method"]> : never}${T_1["path"]}`]: T_1 } : {} : {}>[K_1] } : never), K extends keyof OPT, C extends InferContext<OPT[K]>>(path: K, ...options: HasRequired<C> extends true ? [WithRequired<BetterFetchOption<C["body"], C["query"], C["params"]>, keyof RequiredOptionKeys<C>>] : [BetterFetchOption<C["body"], C["query"], C["params"]>?]) => Promise<BetterFetchResponse<Awaited<ReturnType<OPT[K] extends Endpoint ? OPT[K] : never>>>>;
//#endregion
export { ClientOptions, RequiredOptionKeys, createClient };
//# sourceMappingURL=client.d.cts.map