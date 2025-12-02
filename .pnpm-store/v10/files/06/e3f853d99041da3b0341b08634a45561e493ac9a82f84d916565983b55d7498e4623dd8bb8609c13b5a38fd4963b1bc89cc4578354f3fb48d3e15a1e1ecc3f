var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// src/error.ts
var BetterFetchError = class extends Error {
  constructor(status, statusText, error) {
    super(statusText || status.toString(), {
      cause: error
    });
    this.status = status;
    this.statusText = statusText;
    this.error = error;
  }
};

// src/plugins.ts
var initializePlugins = async (url, options) => {
  var _a, _b, _c, _d, _e, _f;
  let opts = options || {};
  const hooks = {
    onRequest: [options == null ? void 0 : options.onRequest],
    onResponse: [options == null ? void 0 : options.onResponse],
    onSuccess: [options == null ? void 0 : options.onSuccess],
    onError: [options == null ? void 0 : options.onError],
    onRetry: [options == null ? void 0 : options.onRetry]
  };
  if (!options || !(options == null ? void 0 : options.plugins)) {
    return {
      url,
      options: opts,
      hooks
    };
  }
  for (const plugin of (options == null ? void 0 : options.plugins) || []) {
    if (plugin.init) {
      const pluginRes = await ((_a = plugin.init) == null ? void 0 : _a.call(plugin, url.toString(), options));
      opts = pluginRes.options || opts;
      url = pluginRes.url;
    }
    hooks.onRequest.push((_b = plugin.hooks) == null ? void 0 : _b.onRequest);
    hooks.onResponse.push((_c = plugin.hooks) == null ? void 0 : _c.onResponse);
    hooks.onSuccess.push((_d = plugin.hooks) == null ? void 0 : _d.onSuccess);
    hooks.onError.push((_e = plugin.hooks) == null ? void 0 : _e.onError);
    hooks.onRetry.push((_f = plugin.hooks) == null ? void 0 : _f.onRetry);
  }
  return {
    url,
    options: opts,
    hooks
  };
};

// src/retry.ts
var LinearRetryStrategy = class {
  constructor(options) {
    this.options = options;
  }
  shouldAttemptRetry(attempt, response) {
    if (this.options.shouldRetry) {
      return Promise.resolve(
        attempt < this.options.attempts && this.options.shouldRetry(response)
      );
    }
    return Promise.resolve(attempt < this.options.attempts);
  }
  getDelay() {
    return this.options.delay;
  }
};
var ExponentialRetryStrategy = class {
  constructor(options) {
    this.options = options;
  }
  shouldAttemptRetry(attempt, response) {
    if (this.options.shouldRetry) {
      return Promise.resolve(
        attempt < this.options.attempts && this.options.shouldRetry(response)
      );
    }
    return Promise.resolve(attempt < this.options.attempts);
  }
  getDelay(attempt) {
    const delay = Math.min(
      this.options.maxDelay,
      this.options.baseDelay * 2 ** attempt
    );
    return delay;
  }
};
function createRetryStrategy(options) {
  if (typeof options === "number") {
    return new LinearRetryStrategy({
      type: "linear",
      attempts: options,
      delay: 1e3
    });
  }
  switch (options.type) {
    case "linear":
      return new LinearRetryStrategy(options);
    case "exponential":
      return new ExponentialRetryStrategy(options);
    default:
      throw new Error("Invalid retry strategy");
  }
}

// src/auth.ts
var getAuthHeader = async (options) => {
  const headers = {};
  const getValue = async (value) => typeof value === "function" ? await value() : value;
  if (options == null ? void 0 : options.auth) {
    if (options.auth.type === "Bearer") {
      const token = await getValue(options.auth.token);
      if (!token) {
        return headers;
      }
      headers["authorization"] = `Bearer ${token}`;
    } else if (options.auth.type === "Basic") {
      const username = getValue(options.auth.username);
      const password = getValue(options.auth.password);
      if (!username || !password) {
        return headers;
      }
      headers["authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
    } else if (options.auth.type === "Custom") {
      const value = getValue(options.auth.value);
      if (!value) {
        return headers;
      }
      headers["authorization"] = `${getValue(options.auth.prefix)} ${value}`;
    }
  }
  return headers;
};

// src/utils.ts
var JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(request) {
  const _contentType = request.headers.get("content-type");
  const textTypes = /* @__PURE__ */ new Set([
    "image/svg",
    "application/xml",
    "application/xhtml",
    "application/html"
  ]);
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function isJSONParsable(value) {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    return false;
  }
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
function jsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}
function isFunction(value) {
  return typeof value === "function";
}
function getFetch(options) {
  if (options == null ? void 0 : options.customFetchImpl) {
    return options.customFetchImpl;
  }
  if (typeof globalThis !== "undefined" && isFunction(globalThis.fetch)) {
    return globalThis.fetch;
  }
  if (typeof window !== "undefined" && isFunction(window.fetch)) {
    return window.fetch;
  }
  throw new Error("No fetch implementation found");
}
function isPayloadMethod(method) {
  if (!method) {
    return false;
  }
  const payloadMethod = ["POST", "PUT", "PATCH", "DELETE"];
  return payloadMethod.includes(method.toUpperCase());
}
function isRouteMethod(method) {
  const routeMethod = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  if (!method) {
    return false;
  }
  return routeMethod.includes(method.toUpperCase());
}
async function getHeaders(opts) {
  const headers = new Headers(opts == null ? void 0 : opts.headers);
  const authHeader = await getAuthHeader(opts);
  for (const [key, value] of Object.entries(authHeader || {})) {
    headers.set(key, value);
  }
  if (!headers.has("content-type")) {
    const t = detectContentType(opts == null ? void 0 : opts.body);
    if (t) {
      headers.set("content-type", t);
    }
  }
  return headers;
}
function getURL(url, options) {
  if (url.startsWith("@")) {
    const m = url.toString().split("@")[1].split("/")[0];
    if (methods.includes(m)) {
      url = url.replace(`@${m}/`, "/");
    }
  }
  let _url;
  try {
    if (url.startsWith("http")) {
      _url = url;
    } else {
      let baseURL = options == null ? void 0 : options.baseURL;
      if (baseURL && !(baseURL == null ? void 0 : baseURL.endsWith("/"))) {
        baseURL = baseURL + "/";
      }
      if (url.startsWith("/")) {
        _url = new URL(url.substring(1), baseURL);
      } else {
        _url = new URL(url, options == null ? void 0 : options.baseURL);
      }
    }
  } catch (e) {
    if (e instanceof TypeError) {
      if (!(options == null ? void 0 : options.baseURL)) {
        throw TypeError(
          `Invalid URL ${url}. Are you passing in a relative url but not setting the baseURL?`
        );
      }
      throw TypeError(
        `Invalid URL ${url}. Please validate that you are passing the correct input.`
      );
    }
    throw e;
  }
  if (options == null ? void 0 : options.params) {
    if (Array.isArray(options == null ? void 0 : options.params)) {
      const params = (options == null ? void 0 : options.params) ? Array.isArray(options.params) ? `/${options.params.join("/")}` : `/${Object.values(options.params).join("/")}` : "";
      _url = _url.toString().split("/:")[0];
      _url = `${_url.toString()}${params}`;
    } else {
      for (const [key, value] of Object.entries(options == null ? void 0 : options.params)) {
        _url = _url.toString().replace(`:${key}`, String(value));
      }
    }
  }
  const __url = new URL(_url);
  const queryParams = options == null ? void 0 : options.query;
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      __url.searchParams.append(key, String(value));
    }
  }
  return __url;
}
function detectContentType(body) {
  if (isJSONSerializable(body)) {
    return "application/json";
  }
  return null;
}
function getBody(options) {
  if (!(options == null ? void 0 : options.body)) {
    return null;
  }
  const headers = new Headers(options == null ? void 0 : options.headers);
  if (isJSONSerializable(options.body) && !headers.has("content-type")) {
    for (const [key, value] of Object.entries(options == null ? void 0 : options.body)) {
      if (value instanceof Date) {
        options.body[key] = value.toISOString();
      }
    }
    return JSON.stringify(options.body);
  }
  return options.body;
}
function getMethod(url, options) {
  var _a;
  if (options == null ? void 0 : options.method) {
    return options.method.toUpperCase();
  }
  if (url.startsWith("@")) {
    const pMethod = (_a = url.split("@")[1]) == null ? void 0 : _a.split("/")[0];
    if (!methods.includes(pMethod)) {
      return (options == null ? void 0 : options.body) ? "POST" : "GET";
    }
    return pMethod.toUpperCase();
  }
  return (options == null ? void 0 : options.body) ? "POST" : "GET";
}
function getTimeout(options, controller) {
  let abortTimeout;
  if (!(options == null ? void 0 : options.signal) && (options == null ? void 0 : options.timeout)) {
    abortTimeout = setTimeout(() => controller == null ? void 0 : controller.abort(), options == null ? void 0 : options.timeout);
  }
  return {
    abortTimeout,
    clearTimeout: () => {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
  };
}
function bodyParser(data, responseType) {
  if (responseType === "json") {
    return JSON.parse(data);
  }
  return data;
}
var ValidationError = class _ValidationError extends Error {
  constructor(issues, message) {
    super(message || JSON.stringify(issues, null, 2));
    this.issues = issues;
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
async function parseStandardSchema(schema, input) {
  let result = await schema["~standard"].validate(input);
  if (result.issues) {
    throw new ValidationError(result.issues);
  }
  return result.value;
}

// src/create-fetch/schema.ts
var methods = ["get", "post", "put", "patch", "delete"];
var createSchema = (schema, config) => {
  return {
    schema,
    config
  };
};

// src/create-fetch/index.ts
var applySchemaPlugin = (config) => ({
  id: "apply-schema",
  name: "Apply Schema",
  version: "1.0.0",
  async init(url, options) {
    var _a, _b, _c, _d;
    const schema = ((_b = (_a = config.plugins) == null ? void 0 : _a.find(
      (plugin) => {
        var _a2;
        return ((_a2 = plugin.schema) == null ? void 0 : _a2.config) ? url.startsWith(plugin.schema.config.baseURL || "") || url.startsWith(plugin.schema.config.prefix || "") : false;
      }
    )) == null ? void 0 : _b.schema) || config.schema;
    if (schema) {
      let urlKey = url;
      if ((_c = schema.config) == null ? void 0 : _c.prefix) {
        if (urlKey.startsWith(schema.config.prefix)) {
          urlKey = urlKey.replace(schema.config.prefix, "");
          if (schema.config.baseURL) {
            url = url.replace(schema.config.prefix, schema.config.baseURL);
          }
        }
      }
      if ((_d = schema.config) == null ? void 0 : _d.baseURL) {
        if (urlKey.startsWith(schema.config.baseURL)) {
          urlKey = urlKey.replace(schema.config.baseURL, "");
        }
      }
      const keySchema = schema.schema[urlKey];
      if (keySchema) {
        let opts = __spreadProps(__spreadValues({}, options), {
          method: keySchema.method,
          output: keySchema.output
        });
        if (!(options == null ? void 0 : options.disableValidation)) {
          opts = __spreadProps(__spreadValues({}, opts), {
            body: keySchema.input ? await parseStandardSchema(keySchema.input, options == null ? void 0 : options.body) : options == null ? void 0 : options.body,
            params: keySchema.params ? await parseStandardSchema(keySchema.params, options == null ? void 0 : options.params) : options == null ? void 0 : options.params,
            query: keySchema.query ? await parseStandardSchema(keySchema.query, options == null ? void 0 : options.query) : options == null ? void 0 : options.query
          });
        }
        return {
          url,
          options: opts
        };
      }
    }
    return {
      url,
      options
    };
  }
});
var createFetch = (config) => {
  async function $fetch(url, options) {
    const opts = __spreadProps(__spreadValues(__spreadValues({}, config), options), {
      plugins: [...(config == null ? void 0 : config.plugins) || [], applySchemaPlugin(config || {})]
    });
    if (config == null ? void 0 : config.catchAllError) {
      try {
        return await betterFetch(url, opts);
      } catch (error) {
        return {
          data: null,
          error: {
            status: 500,
            statusText: "Fetch Error",
            message: "Fetch related error. Captured by catchAllError option. See error property for more details.",
            error
          }
        };
      }
    }
    return await betterFetch(url, opts);
  }
  return $fetch;
};

// src/url.ts
function getURL2(url, option) {
  let { baseURL, params, query } = option || {
    query: {},
    params: {},
    baseURL: ""
  };
  let basePath = url.startsWith("http") ? url.split("/").slice(0, 3).join("/") : baseURL || "";
  if (url.startsWith("@")) {
    const m = url.toString().split("@")[1].split("/")[0];
    if (methods.includes(m)) {
      url = url.replace(`@${m}/`, "/");
    }
  }
  if (!basePath.endsWith("/")) basePath += "/";
  let [path, urlQuery] = url.replace(basePath, "").split("?");
  const queryParams = new URLSearchParams(urlQuery);
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null) continue;
    queryParams.set(key, String(value));
  }
  if (params) {
    if (Array.isArray(params)) {
      const paramPaths = path.split("/").filter((p) => p.startsWith(":"));
      for (const [index, key] of paramPaths.entries()) {
        const value = params[index];
        path = path.replace(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`:${key}`, String(value));
      }
    }
  }
  path = path.split("/").map(encodeURIComponent).join("/");
  if (path.startsWith("/")) path = path.slice(1);
  let queryParamString = queryParams.toString();
  queryParamString = queryParamString.length > 0 ? `?${queryParamString}`.replace(/\+/g, "%20") : "";
  if (!basePath.startsWith("http")) {
    return `${basePath}${path}${queryParamString}`;
  }
  const _url = new URL(`${path}${queryParamString}`, basePath);
  return _url;
}

// src/fetch.ts
var betterFetch = async (url, options) => {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const {
    hooks,
    url: __url,
    options: opts
  } = await initializePlugins(url, options);
  const fetch = getFetch(opts);
  const controller = new AbortController();
  const signal = (_a = opts.signal) != null ? _a : controller.signal;
  const _url = getURL2(__url, opts);
  const body = getBody(opts);
  const headers = await getHeaders(opts);
  const method = getMethod(__url, opts);
  let context = __spreadProps(__spreadValues({}, opts), {
    url: _url,
    headers,
    body,
    method,
    signal
  });
  for (const onRequest of hooks.onRequest) {
    if (onRequest) {
      const res = await onRequest(context);
      if (res instanceof Object) {
        context = res;
      }
    }
  }
  if ("pipeTo" in context && typeof context.pipeTo === "function" || typeof ((_b = options == null ? void 0 : options.body) == null ? void 0 : _b.pipe) === "function") {
    if (!("duplex" in context)) {
      context.duplex = "half";
    }
  }
  const { clearTimeout: clearTimeout2 } = getTimeout(opts, controller);
  let response = await fetch(context.url, context);
  clearTimeout2();
  const responseContext = {
    response,
    request: context
  };
  for (const onResponse of hooks.onResponse) {
    if (onResponse) {
      const r = await onResponse(__spreadProps(__spreadValues({}, responseContext), {
        response: ((_c = options == null ? void 0 : options.hookOptions) == null ? void 0 : _c.cloneResponse) ? response.clone() : response
      }));
      if (r instanceof Response) {
        response = r;
      } else if (r instanceof Object) {
        response = r.response;
      }
    }
  }
  if (response.ok) {
    const hasBody = context.method !== "HEAD";
    if (!hasBody) {
      return {
        data: "",
        error: null
      };
    }
    const responseType = detectResponseType(response);
    const successContext = {
      data: "",
      response,
      request: context
    };
    if (responseType === "json" || responseType === "text") {
      const text = await response.text();
      const parser2 = (_d = context.jsonParser) != null ? _d : jsonParse;
      const data = await parser2(text);
      successContext.data = data;
    } else {
      successContext.data = await response[responseType]();
    }
    if (context == null ? void 0 : context.output) {
      if (context.output && !context.disableValidation) {
        successContext.data = await parseStandardSchema(
          context.output,
          successContext.data
        );
      }
    }
    for (const onSuccess of hooks.onSuccess) {
      if (onSuccess) {
        await onSuccess(__spreadProps(__spreadValues({}, successContext), {
          response: ((_e = options == null ? void 0 : options.hookOptions) == null ? void 0 : _e.cloneResponse) ? response.clone() : response
        }));
      }
    }
    if (options == null ? void 0 : options.throw) {
      return successContext.data;
    }
    return {
      data: successContext.data,
      error: null
    };
  }
  const parser = (_f = options == null ? void 0 : options.jsonParser) != null ? _f : jsonParse;
  const responseText = await response.text();
  const isJSONResponse = isJSONParsable(responseText);
  const errorObject = isJSONResponse ? await parser(responseText) : null;
  const errorContext = {
    response,
    responseText,
    request: context,
    error: __spreadProps(__spreadValues({}, errorObject), {
      status: response.status,
      statusText: response.statusText
    })
  };
  for (const onError of hooks.onError) {
    if (onError) {
      await onError(__spreadProps(__spreadValues({}, errorContext), {
        response: ((_g = options == null ? void 0 : options.hookOptions) == null ? void 0 : _g.cloneResponse) ? response.clone() : response
      }));
    }
  }
  if (options == null ? void 0 : options.retry) {
    const retryStrategy = createRetryStrategy(options.retry);
    const _retryAttempt = (_h = options.retryAttempt) != null ? _h : 0;
    if (await retryStrategy.shouldAttemptRetry(_retryAttempt, response)) {
      for (const onRetry of hooks.onRetry) {
        if (onRetry) {
          await onRetry(responseContext);
        }
      }
      const delay = retryStrategy.getDelay(_retryAttempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return await betterFetch(url, __spreadProps(__spreadValues({}, options), {
        retryAttempt: _retryAttempt + 1
      }));
    }
  }
  if (options == null ? void 0 : options.throw) {
    throw new BetterFetchError(
      response.status,
      response.statusText,
      isJSONResponse ? errorObject : responseText
    );
  }
  return {
    data: null,
    error: __spreadProps(__spreadValues({}, errorObject), {
      status: response.status,
      statusText: response.statusText
    })
  };
};
export {
  BetterFetchError,
  ValidationError,
  applySchemaPlugin,
  betterFetch,
  bodyParser,
  createFetch,
  createRetryStrategy,
  createSchema,
  detectContentType,
  detectResponseType,
  getBody,
  getFetch,
  getHeaders,
  getMethod,
  getTimeout,
  getURL,
  initializePlugins,
  isFunction,
  isJSONParsable,
  isJSONSerializable,
  isPayloadMethod,
  isRouteMethod,
  jsonParse,
  methods,
  parseStandardSchema
};
//# sourceMappingURL=index.js.map