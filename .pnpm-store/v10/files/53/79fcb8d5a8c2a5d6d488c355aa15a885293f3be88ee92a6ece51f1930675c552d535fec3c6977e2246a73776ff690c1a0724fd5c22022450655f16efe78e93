type RetryCondition = (response: Response | null) => boolean | Promise<boolean>;
type LinearRetry = {
    type: "linear";
    attempts: number;
    delay: number;
    shouldRetry?: RetryCondition;
};
type ExponentialRetry = {
    type: "exponential";
    attempts: number;
    baseDelay: number;
    maxDelay: number;
    shouldRetry?: RetryCondition;
};
type RetryOptions = LinearRetry | ExponentialRetry | number;
interface RetryStrategy {
    shouldAttemptRetry(attempt: number, response: Response | null): Promise<boolean>;
    getDelay(attempt: number): number;
}
declare function createRetryStrategy(options: RetryOptions): RetryStrategy;

/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
    /** The Standard Schema properties. */
    readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
    /** The Standard Schema properties interface. */
    interface Props<Input = unknown, Output = Input> {
        /** The version number of the standard. */
        readonly version: 1;
        /** The vendor name of the schema library. */
        readonly vendor: string;
        /** Validates unknown input values. */
        readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
        /** Inferred types associated with the schema. */
        readonly types?: Types<Input, Output> | undefined;
    }
    /** The result interface of the validate function. */
    type Result<Output> = SuccessResult<Output> | FailureResult;
    /** The result interface if validation succeeds. */
    interface SuccessResult<Output> {
        /** The typed output value. */
        readonly value: Output;
        /** The non-existent issues. */
        readonly issues?: undefined;
    }
    /** The result interface if validation fails. */
    interface FailureResult {
        /** The issues of failed validation. */
        readonly issues: ReadonlyArray<Issue>;
    }
    /** The issue interface of the failure output. */
    interface Issue {
        /** The error message of the issue. */
        readonly message: string;
        /** The path of the issue, if any. */
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }
    /** The path segment interface of the issue. */
    interface PathSegment {
        /** The key representing a path segment. */
        readonly key: PropertyKey;
    }
    /** The Standard Schema types interface. */
    interface Types<Input = unknown, Output = Input> {
        /** The input type of the schema. */
        readonly input: Input;
        /** The output type of the schema. */
        readonly output: Output;
    }
    /** Infers the input type of a Standard Schema. */
    type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
    /** Infers the output type of a Standard Schema. */
    type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
}

type StringLiteralUnion<T extends string> = T | (string & {});
type Prettify<T> = {
    [key in keyof T]: T[key];
} & {};

type FetchSchema = {
    input?: StandardSchemaV1;
    output?: StandardSchemaV1;
    query?: StandardSchemaV1;
    params?: StandardSchemaV1<Record<string, unknown>> | undefined;
    method?: Methods;
};
type Methods = "get" | "post" | "put" | "patch" | "delete";
declare const methods: string[];
type RouteKey = StringLiteralUnion<`@${Methods}/`>;
type FetchSchemaRoutes = {
    [key in RouteKey]?: FetchSchema;
};
declare const createSchema: <F extends FetchSchemaRoutes, S extends SchemaConfig>(schema: F, config?: S) => {
    schema: F;
    config: S;
};
type SchemaConfig = {
    strict?: boolean;
    /**
     * A prefix that will be prepended when it's
     * calling the schema.
     *
     * NOTE: Make sure to handle converting
     * the prefix to the baseURL in the init
     * function if you you are defining for a
     * plugin.
     */
    prefix?: "" | (string & Record<never, never>);
    /**
     * The base url of the schema. By default it's the baseURL of the fetch instance.
     */
    baseURL?: "" | (string & Record<never, never>);
};
type Schema = {
    schema: FetchSchemaRoutes;
    config: SchemaConfig;
};

type CreateFetchOption = BetterFetchOption & {
    schema?: Schema;
    /**
     * Catch all error including non api errors. Like schema validation, etc.
     * @default false
     */
    catchAllError?: boolean;
    defaultOutput?: StandardSchemaV1;
    defaultError?: StandardSchemaV1;
};
type WithRequired<T, K extends keyof T | never> = T & {
    [P in K]-?: T[P];
};
type InferBody<T> = T extends StandardSchemaV1 ? StandardSchemaV1.InferInput<T> : any;
type RemoveEmptyString<T> = T extends string ? "" extends T ? never : T : T;
type InferParamPath<Path> = Path extends `${infer _Start}:${infer Param}/${infer Rest}` ? {
    [K in Param | keyof InferParamPath<Rest> as RemoveEmptyString<K>]: string;
} : Path extends `${infer _Start}:${infer Param}` ? {
    [K in Param]: string;
} : Path extends `${infer _Start}/${infer Rest}` ? InferParamPath<Rest> : {};
type InferParam<Path, Param> = Param extends StandardSchemaV1 ? StandardSchemaV1.InferInput<Param> : InferParamPath<Path>;
type InferOptions<T extends FetchSchema, Key, Res = any> = WithRequired<BetterFetchOption<InferBody<T["input"]>, InferQuery<T["query"]>, InferParam<Key, T["params"]>, Res>, RequiredOptionKeys<T, Key> extends keyof BetterFetchOption ? RequiredOptionKeys<T, Key> : never>;
type InferQuery<Q> = Q extends StandardSchemaV1 ? StandardSchemaV1.InferInput<Q> : any;
type IsFieldOptional<T> = T extends StandardSchemaV1 ? undefined extends T ? true : false : true;
type IsParamOptional<T, K> = IsFieldOptional<T> extends false ? false : IsEmptyObject<InferParamPath<K>> extends false ? false : true;
type IsOptionRequired<T extends FetchSchema, Key> = IsFieldOptional<T["input"]> extends false ? true : IsFieldOptional<T["query"]> extends false ? true : IsParamOptional<T["params"], Key> extends false ? true : false;
type RequiredOptionKeys<T extends FetchSchema, Key> = (IsFieldOptional<T["input"]> extends false ? "body" : never) | (IsFieldOptional<T["query"]> extends false ? "query" : never) | (IsParamOptional<T["params"], Key> extends false ? "params" : never);
type InferKey<S> = S extends Schema ? S["config"]["strict"] extends true ? S["config"]["prefix"] extends string ? `${S["config"]["prefix"]}${keyof S["schema"] extends string ? keyof S["schema"] : never}` : S["config"]["baseURL"] extends string ? `${S["config"]["baseURL"]}${keyof S["schema"] extends string ? keyof S["schema"] : never}` : keyof S["schema"] extends string ? keyof S["schema"] : never : S["config"]["prefix"] extends string ? StringLiteralUnion<`${S["config"]["prefix"]}${keyof S["schema"] extends string ? keyof S["schema"] : never}`> : S["config"]["baseURL"] extends string ? StringLiteralUnion<`${S["config"]["baseURL"]}${keyof S["schema"] extends string ? keyof S["schema"] : never}`> : StringLiteralUnion<keyof S["schema"] extends string ? keyof S["schema"] : never> : string;
type GetKey<S, K> = S extends Schema ? S["config"]["baseURL"] extends string ? K extends `${S["config"]["baseURL"]}${infer AK}` ? AK extends string ? AK : string : S["config"]["prefix"] extends string ? K extends `${S["config"]["prefix"]}${infer AP}` ? AP : string : string : K : K;
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type PluginSchema<P> = P extends BetterFetchPlugin ? P["schema"] extends Schema ? P["schema"] : {} : {};
type MergeSchema<Options extends CreateFetchOption> = Options["plugins"] extends Array<infer P> ? PluginSchema<P> & Options["schema"] : Options["schema"];
type InferPluginOptions<Options extends CreateFetchOption> = Options["plugins"] extends Array<infer P> ? P extends BetterFetchPlugin ? P["getOptions"] extends () => infer O ? O extends StandardSchemaV1 ? UnionToIntersection<StandardSchemaV1.InferOutput<O>> : {} : {} : {} : {};
type BetterFetch<CreateOptions extends CreateFetchOption = CreateFetchOption, DefaultRes = CreateOptions["defaultOutput"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<CreateOptions["defaultOutput"]> : unknown, DefaultErr = CreateOptions["defaultError"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<CreateOptions["defaultError"]> : unknown, S extends MergeSchema<CreateOptions> = MergeSchema<CreateOptions>> = <Res = DefaultRes, Err = DefaultErr, U extends InferKey<S> = InferKey<S>, K extends GetKey<S, U> = GetKey<S, U>, F extends S extends Schema ? S["schema"][K] : unknown = S extends Schema ? S["schema"][K] : unknown, O extends Omit<BetterFetchOption, "params"> = Omit<BetterFetchOption<any, any, any, Res>, "params">, PluginOptions extends Partial<InferPluginOptions<CreateOptions>> = Partial<InferPluginOptions<CreateOptions>>, Result = BetterFetchResponse<O["output"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<O["output"]> : F extends FetchSchema ? F["output"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<F["output"]> : Res : Res, Err, O["throw"] extends boolean ? O["throw"] : CreateOptions["throw"] extends true ? true : Err extends false ? true : false>>(url: U, ...options: F extends FetchSchema ? IsOptionRequired<F, K> extends true ? [
    Prettify<InferOptions<F, K, Result extends {
        data: any;
    } ? NonNullable<Result["data"]> : any> & PluginOptions>
] : [
    Prettify<InferOptions<F, K, Result extends {
        data: any;
    } ? NonNullable<Result["data"]> : any> & PluginOptions>?
] : [
    Prettify<PluginOptions & O & {
        params?: InferParamPath<K>;
    }>?
]) => Promise<Result>;
declare const emptyObjectSymbol: unique symbol;
type EmptyObject = {
    [emptyObjectSymbol]?: never;
};
type IsEmptyObject<T> = T extends EmptyObject ? true : false;

declare const applySchemaPlugin: (config: CreateFetchOption) => {
    id: string;
    name: string;
    version: string;
    init(url: string, options: {
        cache?: RequestCache | undefined;
        credentials?: RequestCredentials | undefined;
        headers?: (HeadersInit & (HeadersInit | {
            accept: "application/json" | "text/plain" | "application/octet-stream";
            "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
            authorization: "Bearer" | "Basic";
        })) | undefined;
        integrity?: string | undefined;
        keepalive?: boolean | undefined;
        method?: string | undefined;
        mode?: RequestMode | undefined;
        priority?: RequestPriority | undefined;
        redirect?: RequestRedirect | undefined;
        referrer?: string | undefined;
        referrerPolicy?: ReferrerPolicy | undefined;
        signal?: (AbortSignal | null) | undefined;
        window?: null | undefined;
        onRequest?: (<T extends Record<string, any>>(context: RequestContext<T>) => Promise<RequestContext | void> | RequestContext | void) | undefined;
        onResponse?: ((context: ResponseContext) => Promise<Response | void | ResponseContext> | Response | ResponseContext | void) | undefined;
        onSuccess?: ((context: SuccessContext<any>) => Promise<void> | void) | undefined;
        onError?: ((context: ErrorContext) => Promise<void> | void) | undefined;
        onRetry?: ((response: ResponseContext) => Promise<void> | void) | undefined;
        hookOptions?: {
            cloneResponse?: boolean;
        } | undefined;
        timeout?: number | undefined;
        customFetchImpl?: FetchEsque | undefined;
        plugins?: BetterFetchPlugin[] | undefined;
        baseURL?: string | undefined;
        throw?: boolean | undefined;
        auth?: Auth | undefined;
        body?: any;
        query?: any;
        params?: any;
        duplex?: ("full" | "half") | undefined;
        jsonParser?: ((text: string) => Promise<any> | any) | undefined;
        retry?: RetryOptions | undefined;
        retryAttempt?: number | undefined;
        output?: (StandardSchemaV1 | typeof Blob | typeof File) | undefined;
        errorSchema?: StandardSchemaV1 | undefined;
        disableValidation?: boolean | undefined;
    } | undefined): Promise<{
        url: string;
        options: {
            cache?: RequestCache | undefined;
            credentials?: RequestCredentials | undefined;
            headers?: (HeadersInit & (HeadersInit | {
                accept: "application/json" | "text/plain" | "application/octet-stream";
                "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
                authorization: "Bearer" | "Basic";
            })) | undefined;
            integrity?: string | undefined;
            keepalive?: boolean | undefined;
            method?: string | undefined;
            mode?: RequestMode | undefined;
            priority?: RequestPriority | undefined;
            redirect?: RequestRedirect | undefined;
            referrer?: string | undefined;
            referrerPolicy?: ReferrerPolicy | undefined;
            signal?: (AbortSignal | null) | undefined;
            window?: null | undefined;
            onRequest?: (<T extends Record<string, any>>(context: RequestContext<T>) => Promise<RequestContext | void> | RequestContext | void) | undefined;
            onResponse?: ((context: ResponseContext) => Promise<Response | void | ResponseContext> | Response | ResponseContext | void) | undefined;
            onSuccess?: ((context: SuccessContext<any>) => Promise<void> | void) | undefined;
            onError?: ((context: ErrorContext) => Promise<void> | void) | undefined;
            onRetry?: ((response: ResponseContext) => Promise<void> | void) | undefined;
            hookOptions?: {
                cloneResponse?: boolean;
            } | undefined;
            timeout?: number | undefined;
            customFetchImpl?: FetchEsque | undefined;
            plugins?: BetterFetchPlugin[] | undefined;
            baseURL?: string | undefined;
            throw?: boolean | undefined;
            auth?: Auth | undefined;
            body?: any;
            query?: any;
            params?: any;
            duplex?: ("full" | "half") | undefined;
            jsonParser?: ((text: string) => Promise<any> | any) | undefined;
            retry?: RetryOptions | undefined;
            retryAttempt?: number | undefined;
            output?: (StandardSchemaV1 | typeof Blob | typeof File) | undefined;
            errorSchema?: StandardSchemaV1 | undefined;
            disableValidation?: boolean | undefined;
        } | undefined;
    }>;
};
declare const createFetch: <Option extends CreateFetchOption>(config?: Option) => BetterFetch<Option>;

declare class BetterFetchError extends Error {
    status: number;
    statusText: string;
    error: any;
    constructor(status: number, statusText: string, error: any);
}

type RequestContext<T extends Record<string, any> = any> = {
    url: URL | string;
    headers: Headers;
    body: any;
    method: string;
    signal: AbortSignal;
} & BetterFetchOption<any, any, any, T>;
type ResponseContext = {
    response: Response;
    request: RequestContext;
};
type SuccessContext<Res = any> = {
    data: Res;
    response: Response;
    request: RequestContext;
};
type ErrorContext = {
    response: Response;
    request: RequestContext;
    error: BetterFetchError & Record<string, any>;
};
interface FetchHooks<Res = any> {
    /**
     * a callback function that will be called when a
     * request is made.
     *
     * The returned context object will be reassigned to
     * the original request context.
     */
    onRequest?: <T extends Record<string, any>>(context: RequestContext<T>) => Promise<RequestContext | void> | RequestContext | void;
    /**
     * a callback function that will be called when
     * response is received. This will be called before
     * the response is parsed and returned.
     *
     * The returned response will be reassigned to the
     * original response if it's changed.
     */
    onResponse?: (context: ResponseContext) => Promise<Response | void | ResponseContext> | Response | ResponseContext | void;
    /**
     * a callback function that will be called when a
     * response is successful.
     */
    onSuccess?: (context: SuccessContext<Res>) => Promise<void> | void;
    /**
     * a callback function that will be called when an
     * error occurs.
     */
    onError?: (context: ErrorContext) => Promise<void> | void;
    /**
     * a callback function that will be called when a
     * request is retried.
     */
    onRetry?: (response: ResponseContext) => Promise<void> | void;
    /**
     * Options for the hooks
     */
    hookOptions?: {
        /**
         * Clone the response
         * @see https://developer.mozilla.org/en-US/docs/Web/API/Response/clone
         */
        cloneResponse?: boolean;
    };
}
/**
 * A plugin that returns an id and hooks
 */
type BetterFetchPlugin = {
    /**
     * A unique id for the plugin
     */
    id: string;
    /**
     * A name for the plugin
     */
    name: string;
    /**
     * A description for the plugin
     */
    description?: string;
    /**
     * A version for the plugin
     */
    version?: string;
    /**
     * Hooks for the plugin
     */
    hooks?: FetchHooks;
    /**
     * A function that will be called when the plugin is
     * initialized. This will be called before the any
     * of the other internal functions.
     *
     * The returned options will be merged with the
     * original options.
     */
    init?: (url: string, options?: BetterFetchOption) => Promise<{
        url: string;
        options?: BetterFetchOption;
    }> | {
        url: string;
        options?: BetterFetchOption;
    };
    /**
     * A schema for the plugin
     */
    schema?: Schema;
    /**
     * Additional options that can be passed to the plugin
     */
    getOptions?: () => StandardSchemaV1;
};
declare const initializePlugins: (url: string, options?: BetterFetchOption) => Promise<{
    url: string;
    options: {
        cache?: RequestCache | undefined;
        credentials?: RequestCredentials | undefined;
        headers?: (HeadersInit & (HeadersInit | {
            accept: "application/json" | "text/plain" | "application/octet-stream";
            "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
            authorization: "Bearer" | "Basic";
        })) | undefined;
        integrity?: string | undefined;
        keepalive?: boolean | undefined;
        method?: string | undefined;
        mode?: RequestMode | undefined;
        priority?: RequestPriority | undefined;
        redirect?: RequestRedirect | undefined;
        referrer?: string | undefined;
        referrerPolicy?: ReferrerPolicy | undefined;
        signal?: (AbortSignal | null) | undefined;
        window?: null | undefined;
        onRequest?: (<T extends Record<string, any>>(context: RequestContext<T>) => Promise<RequestContext | void> | RequestContext | void) | undefined;
        onResponse?: ((context: ResponseContext) => Promise<Response | void | ResponseContext> | Response | ResponseContext | void) | undefined;
        onSuccess?: ((context: SuccessContext<any>) => Promise<void> | void) | undefined;
        onError?: ((context: ErrorContext) => Promise<void> | void) | undefined;
        onRetry?: ((response: ResponseContext) => Promise<void> | void) | undefined;
        hookOptions?: {
            /**
             * Clone the response
             * @see https://developer.mozilla.org/en-US/docs/Web/API/Response/clone
             */
            cloneResponse?: boolean;
        } | undefined;
        timeout?: number | undefined;
        customFetchImpl?: FetchEsque | undefined;
        plugins?: BetterFetchPlugin[] | undefined;
        baseURL?: string | undefined;
        throw?: boolean | undefined;
        auth?: Auth | undefined;
        body?: any;
        query?: any;
        params?: any;
        duplex?: ("full" | "half") | undefined;
        jsonParser?: ((text: string) => Promise<any> | any) | undefined;
        retry?: RetryOptions | undefined;
        retryAttempt?: number | undefined;
        output?: (StandardSchemaV1 | typeof Blob | typeof File) | undefined;
        errorSchema?: StandardSchemaV1 | undefined;
        disableValidation?: boolean | undefined;
    };
    hooks: {
        onRequest: Array<FetchHooks["onRequest"]>;
        onResponse: Array<FetchHooks["onResponse"]>;
        onSuccess: Array<FetchHooks["onSuccess"]>;
        onError: Array<FetchHooks["onError"]>;
        onRetry: Array<FetchHooks["onRetry"]>;
    };
}>;

type CommonHeaders = {
    accept: "application/json" | "text/plain" | "application/octet-stream";
    "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
    authorization: "Bearer" | "Basic";
};
type FetchEsque = (input: string | URL | globalThis.Request, init?: RequestInit) => Promise<Response>;
type PayloadMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type NonPayloadMethod = "GET" | "HEAD" | "OPTIONS";
type Method = PayloadMethod | NonPayloadMethod;
type BetterFetchOption<Body = any, Query extends Record<string, any> = any, Params extends Record<string, any> | Array<string> | undefined = any, Res = any, ExtraOptions extends Record<string, any> = {}> = Prettify<ExtraOptions & Omit<RequestInit, "body"> & FetchHooks<Res> & {
    /**
     * a timeout that will be used to abort the
     * request. Should be in milliseconds.
     */
    timeout?: number;
    /**
     * Custom fetch implementation
     */
    customFetchImpl?: FetchEsque;
    /**
     * Better fetch plugins
     * @see https://better-fetch.vercel.app/docs/plugins
     */
    plugins?: BetterFetchPlugin[];
    /**
     * Base url that will be prepended to the url passed
     * to the fetch function
     */
    baseURL?: string;
    /**
     * Throw if the request fails.
     *
     * By default better fetch responds error as a
     * value. But if you like it to throw instead you
     * can pass throw:true here.
     * @default false
     */
    throw?: boolean;
    /**
     * Authorization headers
     */
    auth?: Auth;
    /**
     * Headers
     */
    headers?: CommonHeaders | Headers | HeadersInit;
    /**
     * Body
     */
    body?: Body;
    /**
     * Query parameters (key-value pairs)
     */
    query?: Query;
    /**
     * Dynamic parameters.
     *
     * If url is defined as /path/:id, params will be { id: string }
     */
    params?: Params;
    /**
     * Duplex mode
     */
    duplex?: "full" | "half";
    /**
     * Custom JSON parser
     */
    jsonParser?: (text: string) => Promise<any> | any;
    /**
     * Retry count
     */
    retry?: RetryOptions;
    /**
     * the number of times the request has already been retried
     */
    retryAttempt?: number;
    /**
     * HTTP method
     */
    method?: StringLiteralUnion<PayloadMethod | NonPayloadMethod>;
    /**
     * Expected output schema
     * You can use this to infer the response
     * type and to validate the response.
     *
     * @example
     * ```ts
     * const { data, error } = await $fetch
     * ("https://jsonplaceholder.typicode.com/
     * todos/1", {
     *   output: z.object({
     *     userId: z.number(),
     *     id: z.number(),
     *     title: z.string(),
     *     completed: z.boolean(),
     *   }),
     * });
     * ```
     */
    output?: StandardSchemaV1 | typeof Blob | typeof File;
    /**
     * Additional error schema for the error object if the
     * response fails.
     */
    errorSchema?: StandardSchemaV1;
    /**
     * Disable validation for the response
     * @default false
     */
    disableValidation?: boolean;
    /**
     * Abort signal
     */
    signal?: AbortSignal | null;
}>;
type Data<T> = {
    data: T;
    error: null;
};
type Error$1<E> = {
    data: null;
    error: Prettify<(E extends Record<string, any> ? E : {
        message?: string;
    }) & {
        status: number;
        statusText: string;
    }>;
};
type BetterFetchResponse<T, E extends Record<string, unknown> | unknown = unknown, Throw extends boolean = false> = Throw extends true ? T : Data<T> | Error$1<E>;

type typeOrTypeReturning<T> = T | (() => T);
/**
 * Bearer token authentication
 *
 * the value of `token` will be added to a header as
 * `auth: Bearer token`,
 */
type Bearer = {
    type: "Bearer";
    token: typeOrTypeReturning<string | undefined | Promise<string | undefined>>;
};
/**
 * Basic auth
 */
type Basic = {
    type: "Basic";
    username: typeOrTypeReturning<string | undefined>;
    password: typeOrTypeReturning<string | undefined>;
};
/**
 * Custom auth
 *
 * @param prefix - prefix of the header
 * @param value - value of the header
 *
 * @example
 * ```ts
 * {
 *  type: "Custom",
 *  prefix: "Token",
 *  value: "token"
 * }
 * ```
 */
type Custom = {
    type: "Custom";
    prefix: typeOrTypeReturning<string | undefined>;
    value: typeOrTypeReturning<string | undefined>;
};
type Auth = Bearer | Basic | Custom;

declare const betterFetch: <TRes extends Option["output"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<Option["output"]> : unknown, TErr = unknown, Option extends BetterFetchOption = {
    cache?: RequestCache | undefined;
    credentials?: RequestCredentials | undefined;
    headers?: (HeadersInit & (HeadersInit | {
        accept: "application/json" | "text/plain" | "application/octet-stream";
        "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
        authorization: "Bearer" | "Basic";
    })) | undefined;
    integrity?: string | undefined;
    keepalive?: boolean | undefined;
    method?: string | undefined;
    mode?: RequestMode | undefined;
    priority?: RequestPriority | undefined;
    redirect?: RequestRedirect | undefined;
    referrer?: string | undefined;
    referrerPolicy?: ReferrerPolicy | undefined;
    signal?: (AbortSignal | null) | undefined;
    window?: null | undefined;
    onRequest?: (<T extends Record<string, any>>(context: RequestContext<T>) => Promise<RequestContext | void> | RequestContext | void) | undefined;
    onResponse?: ((context: ResponseContext) => Promise<Response | void | ResponseContext> | Response | ResponseContext | void) | undefined;
    onSuccess?: ((context: SuccessContext<TRes>) => Promise<void> | void) | undefined;
    onError?: ((context: ErrorContext) => Promise<void> | void) | undefined;
    onRetry?: ((response: ResponseContext) => Promise<void> | void) | undefined;
    hookOptions?: {
        cloneResponse?: boolean;
    } | undefined;
    timeout?: number | undefined;
    customFetchImpl?: FetchEsque | undefined;
    plugins?: BetterFetchPlugin[] | undefined;
    baseURL?: string | undefined;
    throw?: boolean | undefined;
    auth?: Auth | undefined;
    body?: any;
    query?: any;
    params?: any;
    duplex?: ("full" | "half") | undefined;
    jsonParser?: ((text: string) => Promise<any> | any) | undefined;
    retry?: RetryOptions | undefined;
    retryAttempt?: number | undefined;
    output?: (StandardSchemaV1 | typeof Blob | typeof File) | undefined;
    errorSchema?: StandardSchemaV1 | undefined;
    disableValidation?: boolean | undefined;
}>(url: string, options?: Option) => Promise<BetterFetchResponse<TRes, TErr, Option["throw"] extends true ? true : TErr extends false ? true : false>>;

type ResponseType = "json" | "text" | "blob";
declare function detectResponseType(request: Response): ResponseType;
declare function isJSONParsable(value: any): boolean;
declare function isJSONSerializable(value: any): any;
declare function jsonParse(text: string): any;
declare function isFunction(value: any): value is () => any;
declare function getFetch(options?: BetterFetchOption): FetchEsque;
declare function isPayloadMethod(method?: string): boolean;
declare function isRouteMethod(method?: string): boolean;
declare function getHeaders(opts?: BetterFetchOption): Promise<Headers>;
declare function getURL(url: string, options?: BetterFetchOption): URL;
declare function detectContentType(body: any): "application/json" | null;
declare function getBody(options?: BetterFetchOption): any;
declare function getMethod(url: string, options?: BetterFetchOption): string;
declare function getTimeout(options?: BetterFetchOption, controller?: AbortController): {
    abortTimeout: Timer | undefined;
    clearTimeout: () => void;
};
declare function bodyParser(data: any, responseType: ResponseType): any;
declare class ValidationError extends Error {
    readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;
    constructor(issues: ReadonlyArray<StandardSchemaV1.Issue>, message?: string);
}
declare function parseStandardSchema<TSchema extends StandardSchemaV1>(schema: TSchema, input: StandardSchemaV1.InferInput<TSchema>): Promise<StandardSchemaV1.InferOutput<TSchema>>;

export { type BetterFetch, BetterFetchError, type BetterFetchOption, type BetterFetchPlugin, type BetterFetchResponse, type CreateFetchOption, type EmptyObject, type ErrorContext, type ExponentialRetry, type FetchEsque, type FetchHooks, type FetchSchema, type FetchSchemaRoutes, type GetKey, type InferBody, type InferKey, type InferOptions, type InferParam, type InferParamPath, type InferPluginOptions, type InferQuery, type IsEmptyObject, type IsFieldOptional, type IsOptionRequired, type IsParamOptional, type LinearRetry, type MergeSchema, type Method, type Methods, type NonPayloadMethod, type PayloadMethod, type PluginSchema, type RemoveEmptyString, type RequestContext, type RequiredOptionKeys, type ResponseContext, type ResponseType, type RetryCondition, type RetryOptions, type RetryStrategy, type Schema, type SchemaConfig, StandardSchemaV1, type SuccessContext, type UnionToIntersection, ValidationError, type WithRequired, applySchemaPlugin, betterFetch, bodyParser, createFetch, createRetryStrategy, createSchema, detectContentType, detectResponseType, getBody, getFetch, getHeaders, getMethod, getTimeout, getURL, initializePlugins, isFunction, isJSONParsable, isJSONSerializable, isPayloadMethod, isRouteMethod, jsonParse, methods, parseStandardSchema };
