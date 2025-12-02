//#region src/helper.d.ts
type RequiredKeysOf<BaseType extends object> = Exclude<{ [Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]> ? Key : never }[keyof BaseType], undefined>;
type HasRequiredKeys<BaseType extends object> = RequiredKeysOf<BaseType> extends never ? false : true;
type Prettify<T> = { [K in keyof T]: T[K] } & {};
type IsEmptyObject<T> = keyof T extends never ? true : false;
type UnionToIntersection<Union> = (Union extends unknown ? (distributedUnion: Union) => void : never) extends ((mergedIntersection: infer Intersection) => void) ? Intersection & Union : never;
type MergeObject<T extends Record<string, any> | never, S extends Record<string, any> | never> = T extends never ? S : S extends never ? T : T & S;
type InferParamPath<Path> = Path extends `${infer _Start}:${infer Param}/${infer Rest}` ? { [K in Param | keyof InferParamPath<Rest>]: string } : Path extends `${infer _Start}:${infer Param}` ? { [K in Param]: string } : Path extends `${infer _Start}/${infer Rest}` ? InferParamPath<Rest> : {};
type InferParamWildCard<Path> = Path extends `${infer _Start}/*:${infer Param}/${infer Rest}` | `${infer _Start}/**:${infer Param}/${infer Rest}` ? { [K in Param | keyof InferParamPath<Rest>]: string } : Path extends `${infer _Start}/*` ? { [K in "_"]: string } : Path extends `${infer _Start}/${infer Rest}` ? InferParamWildCard<Rest> : {};
//#endregion
//#region src/error.d.ts
/**
 * Hide internal stack frames from the error stack trace.
 */
declare function hideInternalStackFrames(stack: string): string;
/**
 * Creates a custom error class that hides stack frames.
 */
declare function makeErrorForHideStackFrame<B extends new (...args: any[]) => Error>(Base: B, clazz: any): {
  new (...args: ConstructorParameters<B>): InstanceType<B> & {
    errorStack: string | undefined;
  };
};
declare const statusCodes: {
  OK: number;
  CREATED: number;
  ACCEPTED: number;
  NO_CONTENT: number;
  MULTIPLE_CHOICES: number;
  MOVED_PERMANENTLY: number;
  FOUND: number;
  SEE_OTHER: number;
  NOT_MODIFIED: number;
  TEMPORARY_REDIRECT: number;
  BAD_REQUEST: number;
  UNAUTHORIZED: number;
  PAYMENT_REQUIRED: number;
  FORBIDDEN: number;
  NOT_FOUND: number;
  METHOD_NOT_ALLOWED: number;
  NOT_ACCEPTABLE: number;
  PROXY_AUTHENTICATION_REQUIRED: number;
  REQUEST_TIMEOUT: number;
  CONFLICT: number;
  GONE: number;
  LENGTH_REQUIRED: number;
  PRECONDITION_FAILED: number;
  PAYLOAD_TOO_LARGE: number;
  URI_TOO_LONG: number;
  UNSUPPORTED_MEDIA_TYPE: number;
  RANGE_NOT_SATISFIABLE: number;
  EXPECTATION_FAILED: number;
  "I'M_A_TEAPOT": number;
  MISDIRECTED_REQUEST: number;
  UNPROCESSABLE_ENTITY: number;
  LOCKED: number;
  FAILED_DEPENDENCY: number;
  TOO_EARLY: number;
  UPGRADE_REQUIRED: number;
  PRECONDITION_REQUIRED: number;
  TOO_MANY_REQUESTS: number;
  REQUEST_HEADER_FIELDS_TOO_LARGE: number;
  UNAVAILABLE_FOR_LEGAL_REASONS: number;
  INTERNAL_SERVER_ERROR: number;
  NOT_IMPLEMENTED: number;
  BAD_GATEWAY: number;
  SERVICE_UNAVAILABLE: number;
  GATEWAY_TIMEOUT: number;
  HTTP_VERSION_NOT_SUPPORTED: number;
  VARIANT_ALSO_NEGOTIATES: number;
  INSUFFICIENT_STORAGE: number;
  LOOP_DETECTED: number;
  NOT_EXTENDED: number;
  NETWORK_AUTHENTICATION_REQUIRED: number;
};
type Status = 100 | 101 | 102 | 103 | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226 | 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308 | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451 | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;
declare class InternalAPIError extends Error {
  status: keyof typeof statusCodes | Status;
  body: ({
    message?: string;
    code?: string;
    cause?: unknown;
  } & Record<string, any>) | undefined;
  headers: HeadersInit;
  statusCode: number;
  constructor(status?: keyof typeof statusCodes | Status, body?: ({
    message?: string;
    code?: string;
    cause?: unknown;
  } & Record<string, any>) | undefined, headers?: HeadersInit, statusCode?: number);
}
declare class BetterCallError extends Error {
  constructor(message: string);
}
type APIError = InstanceType<typeof InternalAPIError>;
declare const APIError: new (status?: "OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED" | Status | undefined, body?: ({
  message?: string;
  code?: string;
  cause?: unknown;
} & Record<string, any>) | undefined, headers?: HeadersInit | undefined, statusCode?: number | undefined) => InternalAPIError & {
  errorStack: string | undefined;
};
//#endregion
//#region src/cookies.d.ts
type CookiePrefixOptions = "host" | "secure";
type CookieOptions = {
  /**
   * Domain of the cookie
   *
   * The Domain attribute specifies which server can receive a cookie. If specified, cookies are
   * available on the specified server and its subdomains. If the it is not
   * specified, the cookies are available on the server that sets it but not on
   * its subdomains.
   *
   * @example
   * `domain: "example.com"`
   */
  domain?: string;
  /**
   * A lifetime of a cookie. Permanent cookies are deleted after the date specified in the
   * Expires attribute:
   *
   * Expires has been available for longer than Max-Age, however Max-Age is less error-prone, and
   * takes precedence when both are set. The rationale behind this is that when you set an
   * Expires date and time, they're relative to the client the cookie is being set on. If the
   * server is set to a different time, this could cause errors
   */
  expires?: Date;
  /**
   * Forbids JavaScript from accessing the cookie, for example, through the Document.cookie
   * property. Note that a cookie that has been created with HttpOnly will still be sent with
   * JavaScript-initiated requests, for example, when calling XMLHttpRequest.send() or fetch().
   * This mitigates attacks against cross-site scripting
   */
  httpOnly?: boolean;
  /**
   * Indicates the number of seconds until the cookie expires. A zero or negative number will
   * expire the cookie immediately. If both Expires and Max-Age are set, Max-Age has precedence.
   *
   * @example 604800 - 7 days
   */
  maxAge?: number;
  /**
   * Indicates the path that must exist in the requested URL for the browser to send the Cookie
   * header.
   *
   * @example
   * "/docs"
   * // -> the request paths /docs, /docs/, /docs/Web/, and /docs/Web/HTTP will all match. the request paths /, /fr/docs will not match.
   */
  path?: string;
  /**
   * Indicates that the cookie is sent to the server only when a request is made with the https:
   * scheme (except on localhost), and therefore, is more resistant to man-in-the-middle attacks.
   */
  secure?: boolean;
  /**
   * Controls whether or not a cookie is sent with cross-site requests, providing some protection
   * against cross-site request forgery attacks (CSRF).
   *
   * Strict -  Means that the browser sends the cookie only for same-site requests, that is,
   * requests originating from the same site that set the cookie. If a request originates from a
   * different domain or scheme (even with the same domain), no cookies with the SameSite=Strict
   * attribute are sent.
   *
   * Lax - Means that the cookie is not sent on cross-site requests, such as on requests to load
   * images or frames, but is sent when a user is navigating to the origin site from an external
   * site (for example, when following a link). This is the default behavior if the SameSite
   * attribute is not specified.
   *
   * None - Means that the browser sends the cookie with both cross-site and same-site requests.
   * The Secure attribute must also be set when setting this value.
   */
  sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
  /**
   * Indicates that the cookie should be stored using partitioned storage. Note that if this is
   * set, the Secure directive must also be set.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/Privacy/Privacy_sandbox/Partitioned_cookies
   */
  partitioned?: boolean;
  /**
   * Cooke Prefix
   *
   * - secure: `__Secure-` -> `__Secure-cookie-name`
   * - host: `__Host-` -> `__Host-cookie-name`
   *
   * `secure` must be set to true to use prefixes
   */
  prefix?: CookiePrefixOptions;
};
declare const getCookieKey: (key: string, prefix?: CookiePrefixOptions) => string | undefined;
/**
 * Parse an HTTP Cookie header string and returning an object of all cookie
 * name-value pairs.
 *
 * Inspired by https://github.com/unjs/cookie-es/blob/main/src/cookie/parse.ts
 *
 * @param str the string representing a `Cookie` header value
 */
declare function parseCookies(str: string): Map<string, string>;
declare const serializeCookie: (key: string, value: string, opt?: CookieOptions) => string;
declare const serializeSignedCookie: (key: string, value: string, secret: string, opt?: CookieOptions) => Promise<string>;
//#endregion
//#region src/standard-schema.d.ts
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
//#endregion
//#region src/context.d.ts
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type Method = HTTPMethod | "*";
type InferBodyInput<Options extends EndpointOptions | MiddlewareOptions, Body = (Options["metadata"] extends {
  $Infer: {
    body: infer B;
  };
} ? B : Options["body"] extends StandardSchemaV1 ? StandardSchemaV1.InferInput<Options["body"]> : undefined)> = undefined extends Body ? {
  body?: Body;
} : {
  body: Body;
};
type InferBody<Options extends EndpointOptions | MiddlewareOptions> = Options["metadata"] extends {
  $Infer: {
    body: infer Body;
  };
} ? Body : Options["body"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<Options["body"]> : any;
type InferQueryInput<Options extends EndpointOptions | MiddlewareOptions, Query = (Options["metadata"] extends {
  $Infer: {
    query: infer Query;
  };
} ? Query : Options["query"] extends StandardSchemaV1 ? StandardSchemaV1.InferInput<Options["query"]> : Record<string, any> | undefined)> = undefined extends Query ? {
  query?: Query;
} : {
  query: Query;
};
type InferQuery<Options extends EndpointOptions | MiddlewareOptions> = Options["metadata"] extends {
  $Infer: {
    query: infer Query;
  };
} ? Query : Options["query"] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<Options["query"]> : Record<string, any> | undefined;
type InferMethod<Options extends EndpointOptions> = Options["method"] extends Array<Method> ? Options["method"][number] : Options["method"] extends "*" ? HTTPMethod : Options["method"];
type InferInputMethod<Options extends EndpointOptions, Method = (Options["method"] extends Array<any> ? Options["method"][number] : Options["method"] extends "*" ? HTTPMethod : Options["method"] | undefined)> = undefined extends Method ? {
  method?: Method;
} : {
  method: Method;
};
type InferParam<Path extends string> = [Path] extends [never] ? Record<string, any> | undefined : IsEmptyObject<InferParamPath<Path> & InferParamWildCard<Path>> extends true ? Record<string, any> | undefined : Prettify<InferParamPath<Path> & InferParamWildCard<Path>>;
type InferParamInput<Path extends string> = [Path] extends [never] ? {
  params?: Record<string, any>;
} : IsEmptyObject<InferParamPath<Path> & InferParamWildCard<Path>> extends true ? {
  params?: Record<string, any>;
} : {
  params: Prettify<InferParamPath<Path> & InferParamWildCard<Path>>;
};
type InferRequest<Option extends EndpointOptions | MiddlewareOptions> = Option["requireRequest"] extends true ? Request : Request | undefined;
type InferRequestInput<Option extends EndpointOptions | MiddlewareOptions> = Option["requireRequest"] extends true ? {
  request: Request;
} : {
  request?: Request;
};
type InferHeaders<Option extends EndpointOptions | MiddlewareOptions> = Option["requireHeaders"] extends true ? Headers : Headers | undefined;
type InferHeadersInput<Option extends EndpointOptions | MiddlewareOptions> = Option["requireHeaders"] extends true ? {
  headers: HeadersInit;
} : {
  headers?: HeadersInit;
};
type InferUse<Opts extends EndpointOptions["use"]> = Opts extends Middleware[] ? UnionToIntersection<Awaited<ReturnType<Opts[number]>>> : {};
type InferMiddlewareBody<Options extends MiddlewareOptions> = Options["body"] extends StandardSchemaV1<infer T> ? T : any;
type InferMiddlewareQuery<Options extends MiddlewareOptions> = Options["query"] extends StandardSchemaV1<infer T> ? T : Record<string, any> | undefined;
type InputContext<Path extends string, Options extends EndpointOptions> = InferBodyInput<Options> & InferInputMethod<Options> & InferQueryInput<Options> & InferParamInput<Path> & InferRequestInput<Options> & InferHeadersInput<Options> & {
  asResponse?: boolean;
  returnHeaders?: boolean;
  returnStatus?: boolean;
  use?: Middleware[];
  path?: string;
};
declare const createInternalContext: (context: InputContext<any, any>, {
  options,
  path
}: {
  options: EndpointOptions;
  path?: string;
}) => Promise<{
  body: any;
  query: any;
  path: string;
  context: {};
  returned: any;
  headers: HeadersInit | undefined;
  request: Request | undefined;
  params: Record<string, any> | undefined;
  method: any;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | null;
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
  getSignedCookie: (key: string, secret: string, prefix?: CookiePrefixOptions) => Promise<string | false | null>;
  setCookie: (key: string, value: string, options?: CookieOptions) => string;
  setSignedCookie: (key: string, value: string, secret: string, options?: CookieOptions) => Promise<string>;
  redirect: (url: string) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  error: (status: keyof typeof statusCodes | Status, body?: {
    message?: string;
    code?: string;
  } | undefined, headers?: HeadersInit) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  setStatus: (status: Status) => void;
  json: (json: Record<string, any>, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
    body?: Record<string, any>;
  } | Response) => Record<string, any>;
  responseHeaders: Headers;
  responseStatus: Status | undefined;
  asResponse?: boolean;
  returnHeaders?: boolean;
  returnStatus?: boolean;
  use?: Middleware[];
} | {
  body: any;
  query: any;
  path: string;
  context: {};
  returned: any;
  headers: HeadersInit | undefined;
  request: Request | undefined;
  params: Record<string, any> | undefined;
  method: any;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | null;
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
  getSignedCookie: (key: string, secret: string, prefix?: CookiePrefixOptions) => Promise<string | false | null>;
  setCookie: (key: string, value: string, options?: CookieOptions) => string;
  setSignedCookie: (key: string, value: string, secret: string, options?: CookieOptions) => Promise<string>;
  redirect: (url: string) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  error: (status: keyof typeof statusCodes | Status, body?: {
    message?: string;
    code?: string;
  } | undefined, headers?: HeadersInit) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  setStatus: (status: Status) => void;
  json: (json: Record<string, any>, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
    body?: Record<string, any>;
  } | Response) => Record<string, any>;
  responseHeaders: Headers;
  responseStatus: Status | undefined;
  asResponse?: boolean;
  returnHeaders?: boolean;
  returnStatus?: boolean;
  use?: Middleware[];
} | {
  body: any;
  query: any;
  path: string;
  context: {};
  returned: any;
  headers: HeadersInit | undefined;
  request: Request | undefined;
  params: Record<string, any> | undefined;
  method: any;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | null;
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
  getSignedCookie: (key: string, secret: string, prefix?: CookiePrefixOptions) => Promise<string | false | null>;
  setCookie: (key: string, value: string, options?: CookieOptions) => string;
  setSignedCookie: (key: string, value: string, secret: string, options?: CookieOptions) => Promise<string>;
  redirect: (url: string) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  error: (status: keyof typeof statusCodes | Status, body?: {
    message?: string;
    code?: string;
  } | undefined, headers?: HeadersInit) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  setStatus: (status: Status) => void;
  json: (json: Record<string, any>, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
    body?: Record<string, any>;
  } | Response) => Record<string, any>;
  responseHeaders: Headers;
  responseStatus: Status | undefined;
  asResponse?: boolean;
  returnHeaders?: boolean;
  returnStatus?: boolean;
  use?: Middleware[];
} | {
  body: any;
  query: any;
  path: string;
  context: {};
  returned: any;
  headers: HeadersInit | undefined;
  request: Request | undefined;
  params: Record<string, any> | undefined;
  method: any;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | null;
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
  getSignedCookie: (key: string, secret: string, prefix?: CookiePrefixOptions) => Promise<string | false | null>;
  setCookie: (key: string, value: string, options?: CookieOptions) => string;
  setSignedCookie: (key: string, value: string, secret: string, options?: CookieOptions) => Promise<string>;
  redirect: (url: string) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  error: (status: keyof typeof statusCodes | Status, body?: {
    message?: string;
    code?: string;
  } | undefined, headers?: HeadersInit) => {
    status: keyof typeof statusCodes | Status;
    body: ({
      message?: string;
      code?: string;
      cause?: unknown;
    } & Record<string, any>) | undefined;
    headers: HeadersInit;
    statusCode: number;
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } & {
    errorStack: string | undefined;
  };
  setStatus: (status: Status) => void;
  json: (json: Record<string, any>, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
    body?: Record<string, any>;
  } | Response) => Record<string, any>;
  responseHeaders: Headers;
  responseStatus: Status | undefined;
  asResponse?: boolean;
  returnHeaders?: boolean;
  returnStatus?: boolean;
  use?: Middleware[];
}>;
//#endregion
//#region src/middleware.d.ts
interface MiddlewareOptions extends Omit<EndpointOptions, "method"> {}
type MiddlewareResponse = null | void | undefined | Record<string, any>;
type MiddlewareContext<Options extends MiddlewareOptions, Context = {}> = EndpointContext<string, Options & {
  method: "*";
}> & {
  /**
   * Method
   *
   * The request method
   */
  method: string;
  /**
   * Path
   *
   * The path of the endpoint
   */
  path: string;
  /**
   * Body
   *
   * The body object will be the parsed JSON from the request and validated
   * against the body schema if it exists
   */
  body: InferMiddlewareBody<Options>;
  /**
   * Query
   *
   * The query object will be the parsed query string from the request
   * and validated against the query schema if it exists
   */
  query: InferMiddlewareQuery<Options>;
  /**
   * Params
   *
   * If the path is `/user/:id` and the request is `/user/1` then the
   * params will
   * be `{ id: "1" }` and if the path includes a wildcard like `/user/*`
   * then the
   * params will be `{ _: "1" }` where `_` is the wildcard key. If the
   * wildcard
   * is named like `/user/**:name` then the params will be `{ name: string }`
   */
  params: string;
  /**
   * Request object
   *
   * If `requireRequest` is set to true in the endpoint options this will be
   * required
   */
  request: InferRequest<Options>;
  /**
   * Headers
   *
   * If `requireHeaders` is set to true in the endpoint options this will be
   * required
   */
  headers: InferHeaders<Options>;
  /**
   * Set header
   *
   * If it's called outside of a request it will just be ignored.
   */
  setHeader: (key: string, value: string) => void;
  /**
   * Get header
   *
   * If it's called outside of a request it will just return null
   *
   * @param key  - The key of the header
   * @returns
   */
  getHeader: (key: string) => string | null;
  /**
   * JSON
   *
   * a helper function to create a JSON response with
   * the correct headers
   * and status code. If `asResponse` is set to true in
   * the context then
   * it will return a Response object instead of the
   * JSON object.
   *
   * @param json - The JSON object to return
   * @param routerResponse - The response object to
   * return if `asResponse` is
   * true in the context this will take precedence
   */
  json: <R extends Record<string, any> | null>(json: R, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
  } | Response) => Promise<R>;
  /**
   * Middleware context
   */
  context: Prettify<Context>;
};
declare function createMiddleware<Options extends MiddlewareOptions, R>(options: Options, handler: (context: MiddlewareContext<Options>) => Promise<R>): <InputCtx extends MiddlewareInputContext<Options>>(inputContext: InputCtx) => Promise<R>;
declare function createMiddleware<Options extends MiddlewareOptions, R>(handler: (context: MiddlewareContext<Options>) => Promise<R>): <InputCtx extends MiddlewareInputContext<Options>>(inputContext: InputCtx) => Promise<R>;
declare namespace createMiddleware {
  var create: <E extends {
    use?: Middleware[];
  }>(opts?: E) => {
    <Options extends MiddlewareOptions, R>(options: Options, handler: (ctx: MiddlewareContext<Options, InferUse<E["use"]>>) => Promise<R>): (inputContext: MiddlewareInputContext<Options>) => Promise<R>;
    <Options extends MiddlewareOptions, R_1>(handler: (ctx: MiddlewareContext<Options, InferUse<E["use"]>>) => Promise<R_1>): (inputContext: MiddlewareInputContext<Options>) => Promise<R_1>;
  };
}
type MiddlewareInputContext<Options extends MiddlewareOptions> = InferBodyInput<Options> & InferQueryInput<Options> & InferRequestInput<Options> & InferHeadersInput<Options> & {
  asResponse?: boolean;
  returnHeaders?: boolean;
  use?: Middleware[];
};
type Middleware<Options extends MiddlewareOptions = MiddlewareOptions, Handler extends (inputCtx: any) => Promise<any> = any> = Handler & {
  options: Options;
};
//#endregion
//#region src/openapi.d.ts
type OpenAPISchemaType = "string" | "number" | "integer" | "boolean" | "array" | "object";
interface OpenAPIParameter {
  in: "query" | "path" | "header" | "cookie";
  name?: string;
  description?: string;
  required?: boolean;
  schema?: {
    type: OpenAPISchemaType;
    format?: string;
    items?: {
      type: OpenAPISchemaType;
    };
    enum?: string[];
    minLength?: number;
    description?: string;
    default?: string;
    example?: string;
  };
}
interface Path$1 {
  get?: {
    tags?: string[];
    operationId?: string;
    description?: string;
    security?: [{
      bearerAuth: string[];
    }];
    parameters?: OpenAPIParameter[];
    responses?: { [key in string]: {
      description?: string;
      content: {
        "application/json": {
          schema: {
            type?: OpenAPISchemaType;
            properties?: Record<string, any>;
            required?: string[];
            $ref?: string;
          };
        };
      };
    } };
  };
  post?: {
    tags?: string[];
    operationId?: string;
    description?: string;
    security?: [{
      bearerAuth: string[];
    }];
    parameters?: OpenAPIParameter[];
    requestBody?: {
      content: {
        "application/json": {
          schema: {
            type?: OpenAPISchemaType;
            properties?: Record<string, any>;
            required?: string[];
            $ref?: string;
          };
        };
      };
    };
    responses?: { [key in string]: {
      description?: string;
      content: {
        "application/json": {
          schema: {
            type?: OpenAPISchemaType;
            properties?: Record<string, any>;
            required?: string[];
            $ref?: string;
          };
        };
      };
    } };
  };
}
declare function generator(endpoints: Record<string, Endpoint>, config?: {
  url: string;
}): Promise<{
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  components: {
    schemas: {};
  };
  security: {
    apiKeyCookie: never[];
  }[];
  servers: {
    url: string | undefined;
  }[];
  tags: {
    name: string;
    description: string;
  }[];
  paths: Record<string, Path$1>;
}>;
declare const getHTML: (apiReference: Record<string, any>, config?: {
  logo?: string;
  theme?: string;
  title?: string;
  description?: string;
}) => string;
//#endregion
//#region src/endpoint.d.ts
interface EndpointBaseOptions {
  /**
   * Query Schema
   */
  query?: StandardSchemaV1;
  /**
   * Error Schema
   */
  error?: StandardSchemaV1;
  /**
   * If true headers will be required to be passed in the context
   */
  requireHeaders?: boolean;
  /**
   * If true request object will be required
   */
  requireRequest?: boolean;
  /**
   * Clone the request object from the router
   */
  cloneRequest?: boolean;
  /**
   * If true the body will be undefined
   */
  disableBody?: boolean;
  /**
   * Endpoint metadata
   */
  metadata?: {
    /**
     * Open API definition
     */
    openapi?: {
      summary?: string;
      description?: string;
      tags?: string[];
      operationId?: string;
      parameters?: OpenAPIParameter[];
      requestBody?: {
        content: {
          "application/json": {
            schema: {
              type?: OpenAPISchemaType;
              properties?: Record<string, any>;
              required?: string[];
              $ref?: string;
            };
          };
        };
      };
      responses?: {
        [status: string]: {
          description: string;
          content?: {
            "application/json"?: {
              schema: {
                type?: OpenAPISchemaType;
                properties?: Record<string, any>;
                required?: string[];
                $ref?: string;
              };
            };
            "text/plain"?: {
              schema?: {
                type?: OpenAPISchemaType;
                properties?: Record<string, any>;
                required?: string[];
                $ref?: string;
              };
            };
            "text/html"?: {
              schema?: {
                type?: OpenAPISchemaType;
                properties?: Record<string, any>;
                required?: string[];
                $ref?: string;
              };
            };
          };
        };
      };
    };
    /**
     * Infer body and query type from ts interface
     *
     * useful for generic and dynamic types
     *
     * @example
     * ```ts
     * const endpoint = createEndpoint("/path", {
     * 		method: "POST",
     * 		body: z.record(z.string()),
     * 		$Infer: {
     * 			body: {} as {
     * 				type: InferTypeFromOptions<Option> // custom type inference
     * 			}
     * 		}
     * 	}, async(ctx)=>{
     * 		const body = ctx.body
     * 	})
     * ```
     */
    $Infer?: {
      /**
       * Body
       */
      body?: any;
      /**
       * Query
       */
      query?: Record<string, any>;
    };
    /**
     * If enabled, endpoint won't be exposed over a router
     * @deprecated Use path-less endpoints instead
     */
    SERVER_ONLY?: boolean;
    /**
     * If enabled, endpoint won't be exposed as an action to the client
     * @deprecated Use path-less endpoints instead
     */
    isAction?: boolean;
    /**
     * Defines the places where the endpoint will be available
     *
     * Possible options:
     * - `rpc` - the endpoint is exposed to the router, can be invoked directly and is available to the client
     * - `server` - the endpoint is exposed to the router, can be invoked directly, but is not available to the client
     * - `http` - the endpoint is only exposed to the router
     * @default "rpc"
     */
    scope?: "rpc" | "server" | "http";
    /**
     * List of allowed media types (MIME types) for the endpoint
     *
     * if provided, only the media types in the list will be allowed to be passed in the body
     *
     * @example
     * ```ts
     * const endpoint = createEndpoint("/path", {
     * 		method: "POST",
     * 		allowedMediaTypes: ["application/json", "application/x-www-form-urlencoded"],
     * 	}, async(ctx)=>{
     * 		const body = ctx.body
     * 	})
     * ```
     */
    allowedMediaTypes?: string[];
    /**
     * Extra metadata
     */
    [key: string]: any;
  };
  /**
   * List of middlewares to use
   */
  use?: Middleware[];
  /**
   * A callback to run before any API error is throw or returned
   *
   * @param e - The API error
   * @returns - The response to return
   */
  onAPIError?: (e: APIError) => void | Promise<void>;
}
type EndpointBodyMethodOptions = {
  /**
   * Request Method
   */
  method: "POST" | "PUT" | "DELETE" | "PATCH" | ("POST" | "PUT" | "DELETE" | "PATCH")[];
  /**
   * Body Schema
   */
  body?: StandardSchemaV1;
} | {
  /**
   * Request Method
   */
  method: "GET" | "HEAD" | ("GET" | "HEAD")[];
  /**
   * Body Schema
   */
  body?: never;
} | {
  /**
   * Request Method
   */
  method: "*";
  /**
   * Body Schema
   */
  body?: StandardSchemaV1;
} | {
  /**
   * Request Method
   */
  method: ("POST" | "PUT" | "DELETE" | "PATCH" | "GET" | "HEAD")[];
  /**
   * Body Schema
   */
  body?: StandardSchemaV1;
};
type EndpointOptions = EndpointBaseOptions & EndpointBodyMethodOptions;
type EndpointContext<Path extends string, Options extends EndpointOptions, Context = {}> = {
  /**
   * Method
   *
   * The request method
   */
  method: InferMethod<Options>;
  /**
   * Path
   *
   * The path of the endpoint
   */
  path: Path;
  /**
   * Body
   *
   * The body object will be the parsed JSON from the request and validated
   * against the body schema if it exists.
   */
  body: InferBody<Options>;
  /**
   * Query
   *
   * The query object will be the parsed query string from the request
   * and validated against the query schema if it exists
   */
  query: InferQuery<Options>;
  /**
   * Params
   *
   * If the path is `/user/:id` and the request is `/user/1` then the params will
   * be `{ id: "1" }` and if the path includes a wildcard like `/user/*` then the
   * params will be `{ _: "1" }` where `_` is the wildcard key. If the wildcard
   * is named like `/user/**:name` then the params will be `{ name: string }`
   */
  params: InferParam<Path>;
  /**
   * Request object
   *
   * If `requireRequest` is set to true in the endpoint options this will be
   * required
   */
  request: InferRequest<Options>;
  /**
   * Headers
   *
   * If `requireHeaders` is set to true in the endpoint options this will be
   * required
   */
  headers: InferHeaders<Options>;
  /**
   * Set header
   *
   * If it's called outside of a request it will just be ignored.
   */
  setHeader: (key: string, value: string) => void;
  /**
   * Set the response status code
   */
  setStatus: (status: Status) => void;
  /**
   * Get header
   *
   * If it's called outside of a request it will just return null
   *
   * @param key  - The key of the header
   * @returns
   */
  getHeader: (key: string) => string | null;
  /**
   * Get a cookie value from the request
   *
   * @param key - The key of the cookie
   * @param prefix - The prefix of the cookie between `__Secure-` and `__Host-`
   * @returns - The value of the cookie
   */
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | null;
  /**
   * Get a signed cookie value from the request
   *
   * @param key - The key of the cookie
   * @param secret - The secret of the signed cookie
   * @param prefix - The prefix of the cookie between `__Secure-` and `__Host-`
   * @returns
   */
  getSignedCookie: (key: string, secret: string, prefix?: CookiePrefixOptions) => Promise<string | null>;
  /**
   * Set a cookie value in the response
   *
   * @param key - The key of the cookie
   * @param value - The value to set
   * @param options - The options of the cookie
   * @returns - The cookie string
   */
  setCookie: (key: string, value: string, options?: CookieOptions) => string;
  /**
   * Set signed cookie
   *
   * @param key - The key of the cookie
   * @param value  - The value to set
   * @param secret - The secret to sign the cookie with
   * @param options - The options of the cookie
   * @returns - The cookie string
   */
  setSignedCookie: (key: string, value: string, secret: string, options?: CookieOptions) => Promise<string>;
  /**
   * JSON
   *
   * a helper function to create a JSON response with
   * the correct headers
   * and status code. If `asResponse` is set to true in
   * the context then
   * it will return a Response object instead of the
   * JSON object.
   *
   * @param json - The JSON object to return
   * @param routerResponse - The response object to
   * return if `asResponse` is
   * true in the context this will take precedence
   */
  json: <R extends Record<string, any> | null>(json: R, routerResponse?: {
    status?: number;
    headers?: Record<string, string>;
    response?: Response;
    body?: Record<string, string>;
  } | Response) => Promise<R>;
  /**
   * Middleware context
   */
  context: Prettify<Context & InferUse<Options["use"]>>;
  /**
   * Redirect to a new URL
   */
  redirect: (url: string) => APIError;
  /**
   * Return error
   */
  error: (status: keyof typeof statusCodes | Status, body?: {
    message?: string;
    code?: string;
  } & Record<string, any>, headers?: HeadersInit) => APIError;
};
type EndpointHandler<Path extends string, Options extends EndpointOptions, R> = (context: EndpointContext<Path, Options>) => Promise<R>;
declare function createEndpoint<Path extends string, Options extends EndpointOptions, R>(path: Path, options: Options, handler: EndpointHandler<Path, Options, R>): StrictEndpoint<Path, Options, R>;
declare function createEndpoint<Options extends EndpointOptions, R>(options: Options, handler: EndpointHandler<never, Options, R>): StrictEndpoint<never, Options, R>;
declare namespace createEndpoint {
  var create: <E extends {
    use?: Middleware[];
  }>(opts?: E) => <Path extends string, Opts extends EndpointOptions, R extends Promise<any>>(path: Path, options: Opts, handler: (ctx: EndpointContext<Path, Opts, InferUse<E["use"]>>) => R) => StrictEndpoint<Path, Opts & {
    use: any[];
  }, any>;
}
type StrictEndpoint<Path extends string, Options extends EndpointOptions, R = any> = {
  (context: InputContext<Path, Options> & {
    asResponse: true;
  }): Promise<Response>;
  (context: InputContext<Path, Options> & {
    returnHeaders: true;
    returnStatus: true;
  }): Promise<{
    headers: Headers;
    status: number;
    response: Awaited<R>;
  }>;
  (context: InputContext<Path, Options> & {
    returnHeaders: true;
    returnStatus: false;
  }): Promise<{
    headers: Headers;
    response: Awaited<R>;
  }>;
  (context: InputContext<Path, Options> & {
    returnHeaders: false;
    returnStatus: true;
  }): Promise<{
    status: number;
    response: Awaited<R>;
  }>;
  (context: InputContext<Path, Options> & {
    returnHeaders: false;
    returnStatus: false;
  }): Promise<R>;
  (context: InputContext<Path, Options> & {
    returnHeaders: true;
  }): Promise<{
    headers: Headers;
    response: Awaited<R>;
  }>;
  (context: InputContext<Path, Options> & {
    returnStatus: true;
  }): Promise<{
    status: number;
    response: Awaited<R>;
  }>;
  (context?: InputContext<Path, Options>): Promise<R>;
  options: Options;
  path: Path;
};
type Endpoint<Path extends string = string, Options extends EndpointOptions = EndpointOptions, Handler extends (inputCtx: any) => Promise<any> = (inputCtx: any) => Promise<any>> = Handler & {
  options: Options;
  path: Path;
};
//#endregion
//#region src/router.d.ts
interface RouterConfig {
  throwError?: boolean;
  onError?: (e: unknown) => void | Promise<void> | Response | Promise<Response>;
  basePath?: string;
  routerMiddleware?: Array<{
    path: string;
    middleware: Middleware;
  }>;
  /**
   * additional Context that needs to passed to endpoints
   *
   * this will be available on `ctx.context` on endpoints
   */
  routerContext?: Record<string, any>;
  /**
   * A callback to run before any response
   */
  onResponse?: (res: Response) => any | Promise<any>;
  /**
   * A callback to run before any request
   */
  onRequest?: (req: Request) => any | Promise<any>;
  /**
   * List of allowed media types (MIME types) for the router
   *
   * if provided, only the media types in the list will be allowed to be passed in the body.
   *
   * If an endpoint has allowed media types, it will override the router's allowed media types.
   *
   * @example
   * ```ts
   * const router = createRouter({
   * 		allowedMediaTypes: ["application/json", "application/x-www-form-urlencoded"],
   * 	})
   */
  allowedMediaTypes?: string[];
  /**
   * Open API route configuration
   */
  openapi?: {
    /**
     * Disable openapi route
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * A path to display open api using scalar
     *
     * @default "/api/reference"
     */
    path?: string;
    /**
     * Scalar Configuration
     */
    scalar?: {
      /**
       * Title
       * @default "Open API Reference"
       */
      title?: string;
      /**
       * Description
       *
       * @default "Better Call Open API Reference"
       */
      description?: string;
      /**
       * Logo URL
       */
      logo?: string;
      /**
       * Scalar theme
       * @default "saturn"
       */
      theme?: string;
    };
  };
}
declare const createRouter: <E extends Record<string, Endpoint>, Config extends RouterConfig>(endpoints: E, config?: Config) => {
  handler: (request: Request) => Promise<Response>;
  endpoints: E;
};
type Router = ReturnType<typeof createRouter>;
//#endregion
export { APIError, BetterCallError, CookieOptions, CookiePrefixOptions, Endpoint, EndpointBaseOptions, EndpointBodyMethodOptions, EndpointContext, EndpointOptions, HTTPMethod, HasRequiredKeys, InferBody, InferBodyInput, InferHeaders, InferHeadersInput, InferInputMethod, InferMethod, InferMiddlewareBody, InferMiddlewareQuery, InferParam, InferParamInput, InferParamPath, InferParamWildCard, InferQuery, InferQueryInput, InferRequest, InferRequestInput, InferUse, InputContext, IsEmptyObject, MergeObject, Method, Middleware, MiddlewareContext, MiddlewareInputContext, MiddlewareOptions, MiddlewareResponse, OpenAPIParameter, OpenAPISchemaType, Path$1 as Path, Prettify, RequiredKeysOf, Router, RouterConfig, StandardSchemaV1, Status, StrictEndpoint, UnionToIntersection, createEndpoint, createInternalContext, createMiddleware, createRouter, generator, getCookieKey, getHTML, hideInternalStackFrames, makeErrorForHideStackFrame, parseCookies, serializeCookie, serializeSignedCookie, statusCodes };
//# sourceMappingURL=router-DgnLO11b.d.ts.map