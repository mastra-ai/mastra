import {
  __publicField
} from "./chunk-NSSMTXJJ.mjs";

// src/deno.ts
if (typeof globalThis.Deno !== "undefined") {
  const OriginalRequest = globalThis.Request;
  const PatchedRequest = function(input, init) {
    if (init && typeof init === "object") {
      const cleanInit = { ...init };
      if ("client" in cleanInit) {
        delete cleanInit.client;
      }
      return new OriginalRequest(input, cleanInit);
    }
    return new OriginalRequest(input, init);
  };
  Object.setPrototypeOf(PatchedRequest, OriginalRequest);
  Object.defineProperty(PatchedRequest, "prototype", {
    value: OriginalRequest.prototype,
    writable: false
  });
  globalThis.Request = PatchedRequest;
}

// src/types.ts
var baseRecordSetFields = [
  "ids",
  "embeddings",
  "metadatas",
  "documents",
  "uris"
];
var recordSetFields = [...baseRecordSetFields, "ids"];
var IncludeEnum = /* @__PURE__ */ ((IncludeEnum2) => {
  IncludeEnum2["distances"] = "distances";
  IncludeEnum2["documents"] = "documents";
  IncludeEnum2["embeddings"] = "embeddings";
  IncludeEnum2["metadatas"] = "metadatas";
  IncludeEnum2["uris"] = "uris";
  return IncludeEnum2;
})(IncludeEnum || {});
var GetResult = class {
  /**
   * Creates a new GetResult instance.
   * @param data - The result data containing all fields
   */
  constructor({
    documents,
    embeddings,
    ids,
    include,
    metadatas,
    uris
  }) {
    this.documents = documents;
    this.embeddings = embeddings;
    this.ids = ids;
    this.include = include;
    this.metadatas = metadatas;
    this.uris = uris;
  }
  /**
   * Converts the result to a row-based format for easier iteration.
   * @returns Object containing include fields and array of record objects
   */
  rows() {
    return this.ids.map((id, index) => {
      return {
        id,
        document: this.include.includes("documents") ? this.documents[index] : void 0,
        embedding: this.include.includes("embeddings") ? this.embeddings[index] : void 0,
        metadata: this.include.includes("metadatas") ? this.metadatas[index] : void 0,
        uri: this.include.includes("uris") ? this.uris[index] : void 0
      };
    });
  }
};
var QueryResult = class {
  /**
   * Creates a new QueryResult instance.
   * @param data - The query result data containing all fields
   */
  constructor({
    distances,
    documents,
    embeddings,
    ids,
    include,
    metadatas,
    uris
  }) {
    this.distances = distances;
    this.documents = documents;
    this.embeddings = embeddings;
    this.ids = ids;
    this.include = include;
    this.metadatas = metadatas;
    this.uris = uris;
  }
  /**
   * Converts the query result to a row-based format for easier iteration.
   * @returns Object containing include fields and structured query results
   */
  rows() {
    const queries = [];
    for (let q2 = 0; q2 < this.ids.length; q2++) {
      const records = this.ids[q2].map((id, index) => {
        return {
          id,
          document: this.include.includes("documents") ? this.documents[q2][index] : void 0,
          embedding: this.include.includes("embeddings") ? this.embeddings[q2][index] : void 0,
          metadata: this.include.includes("metadatas") ? this.metadatas[q2][index] : void 0,
          uri: this.include.includes("uris") ? this.uris[q2][index] : void 0,
          distance: this.include.includes("distances") ? this.distances[q2][index] : void 0
        };
      });
      queries.push(records);
    }
    return queries;
  }
};

// ../../node_modules/.pnpm/@hey-api+client-fetch@0.10.0_@hey-api+openapi-ts@0.67.3_typescript@5.8.3_/node_modules/@hey-api/client-fetch/dist/index.js
var A = async (t, r) => {
  let e = typeof r == "function" ? await r(t) : r;
  if (e) return t.scheme === "bearer" ? `Bearer ${e}` : t.scheme === "basic" ? `Basic ${btoa(e)}` : e;
};
var R = { bodySerializer: (t) => JSON.stringify(t, (r, e) => typeof e == "bigint" ? e.toString() : e) };
var U = (t) => {
  switch (t) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var _ = (t) => {
  switch (t) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var D = (t) => {
  switch (t) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var O = ({ allowReserved: t, explode: r, name: e, style: a, value: i }) => {
  if (!r) {
    let s = (t ? i : i.map((l) => encodeURIComponent(l))).join(_(a));
    switch (a) {
      case "label":
        return `.${s}`;
      case "matrix":
        return `;${e}=${s}`;
      case "simple":
        return s;
      default:
        return `${e}=${s}`;
    }
  }
  let o = U(a), n = i.map((s) => a === "label" || a === "simple" ? t ? s : encodeURIComponent(s) : y({ allowReserved: t, name: e, value: s })).join(o);
  return a === "label" || a === "matrix" ? o + n : n;
};
var y = ({ allowReserved: t, name: r, value: e }) => {
  if (e == null) return "";
  if (typeof e == "object") throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  return `${r}=${t ? e : encodeURIComponent(e)}`;
};
var q = ({ allowReserved: t, explode: r, name: e, style: a, value: i }) => {
  if (i instanceof Date) return `${e}=${i.toISOString()}`;
  if (a !== "deepObject" && !r) {
    let s = [];
    Object.entries(i).forEach(([f, u]) => {
      s = [...s, f, t ? u : encodeURIComponent(u)];
    });
    let l = s.join(",");
    switch (a) {
      case "form":
        return `${e}=${l}`;
      case "label":
        return `.${l}`;
      case "matrix":
        return `;${e}=${l}`;
      default:
        return l;
    }
  }
  let o = D(a), n = Object.entries(i).map(([s, l]) => y({ allowReserved: t, name: a === "deepObject" ? `${e}[${s}]` : s, value: l })).join(o);
  return a === "label" || a === "matrix" ? o + n : n;
};
var H = /\{[^{}]+\}/g;
var B = ({ path: t, url: r }) => {
  let e = r, a = r.match(H);
  if (a) for (let i of a) {
    let o = false, n = i.substring(1, i.length - 1), s = "simple";
    n.endsWith("*") && (o = true, n = n.substring(0, n.length - 1)), n.startsWith(".") ? (n = n.substring(1), s = "label") : n.startsWith(";") && (n = n.substring(1), s = "matrix");
    let l = t[n];
    if (l == null) continue;
    if (Array.isArray(l)) {
      e = e.replace(i, O({ explode: o, name: n, style: s, value: l }));
      continue;
    }
    if (typeof l == "object") {
      e = e.replace(i, q({ explode: o, name: n, style: s, value: l }));
      continue;
    }
    if (s === "matrix") {
      e = e.replace(i, `;${y({ name: n, value: l })}`);
      continue;
    }
    let f = encodeURIComponent(s === "label" ? `.${l}` : l);
    e = e.replace(i, f);
  }
  return e;
};
var E = ({ allowReserved: t, array: r, object: e } = {}) => (i) => {
  let o = [];
  if (i && typeof i == "object") for (let n in i) {
    let s = i[n];
    if (s != null) {
      if (Array.isArray(s)) {
        o = [...o, O({ allowReserved: t, explode: true, name: n, style: "form", value: s, ...r })];
        continue;
      }
      if (typeof s == "object") {
        o = [...o, q({ allowReserved: t, explode: true, name: n, style: "deepObject", value: s, ...e })];
        continue;
      }
      o = [...o, y({ allowReserved: t, name: n, value: s })];
    }
  }
  return o.join("&");
};
var P = (t) => {
  if (!t) return "stream";
  let r = t.split(";")[0]?.trim();
  if (r) {
    if (r.startsWith("application/json") || r.endsWith("+json")) return "json";
    if (r === "multipart/form-data") return "formData";
    if (["application/", "audio/", "image/", "video/"].some((e) => r.startsWith(e))) return "blob";
    if (r.startsWith("text/")) return "text";
  }
};
var I = async ({ security: t, ...r }) => {
  for (let e of t) {
    let a = await A(e, r.auth);
    if (!a) continue;
    let i = e.name ?? "Authorization";
    switch (e.in) {
      case "query":
        r.query || (r.query = {}), r.query[i] = a;
        break;
      case "cookie":
        r.headers.append("Cookie", `${i}=${a}`);
        break;
      case "header":
      default:
        r.headers.set(i, a);
        break;
    }
    return;
  }
};
var S = (t) => W({ baseUrl: t.baseUrl, path: t.path, query: t.query, querySerializer: typeof t.querySerializer == "function" ? t.querySerializer : E(t.querySerializer), url: t.url });
var W = ({ baseUrl: t, path: r, query: e, querySerializer: a, url: i }) => {
  let o = i.startsWith("/") ? i : `/${i}`, n = (t ?? "") + o;
  r && (n = B({ path: r, url: n }));
  let s = e ? a(e) : "";
  return s.startsWith("?") && (s = s.substring(1)), s && (n += `?${s}`), n;
};
var C = (t, r) => {
  let e = { ...t, ...r };
  return e.baseUrl?.endsWith("/") && (e.baseUrl = e.baseUrl.substring(0, e.baseUrl.length - 1)), e.headers = x(t.headers, r.headers), e;
};
var x = (...t) => {
  let r = new Headers();
  for (let e of t) {
    if (!e || typeof e != "object") continue;
    let a = e instanceof Headers ? e.entries() : Object.entries(e);
    for (let [i, o] of a) if (o === null) r.delete(i);
    else if (Array.isArray(o)) for (let n of o) r.append(i, n);
    else o !== void 0 && r.set(i, typeof o == "object" ? JSON.stringify(o) : o);
  }
  return r;
};
var h = class {
  constructor() {
    __publicField(this, "_fns");
    this._fns = [];
  }
  clear() {
    this._fns = [];
  }
  exists(r) {
    return this._fns.indexOf(r) !== -1;
  }
  eject(r) {
    let e = this._fns.indexOf(r);
    e !== -1 && (this._fns = [...this._fns.slice(0, e), ...this._fns.slice(e + 1)]);
  }
  use(r) {
    this._fns = [...this._fns, r];
  }
};
var T = () => ({ error: new h(), request: new h(), response: new h() });
var N = E({ allowReserved: false, array: { explode: true, style: "form" }, object: { explode: true, style: "deepObject" } });
var Q = { "Content-Type": "application/json" };
var w = (t = {}) => ({ ...R, headers: Q, parseAs: "auto", querySerializer: N, ...t });
var J = (t = {}) => {
  let r = C(w(), t), e = () => ({ ...r }), a = (n) => (r = C(r, n), e()), i = T(), o = async (n) => {
    let s = { ...r, ...n, fetch: n.fetch ?? r.fetch ?? globalThis.fetch, headers: x(r.headers, n.headers) };
    s.security && await I({ ...s, security: s.security }), s.body && s.bodySerializer && (s.body = s.bodySerializer(s.body)), (s.body === void 0 || s.body === "") && s.headers.delete("Content-Type");
    let l = S(s), f = { redirect: "follow", ...s }, u = new Request(l, f);
    for (let p of i.request._fns) u = await p(u, s);
    let k = s.fetch, c = await k(u);
    for (let p of i.response._fns) c = await p(c, u, s);
    let m = { request: u, response: c };
    if (c.ok) {
      if (c.status === 204 || c.headers.get("Content-Length") === "0") return { data: {}, ...m };
      let p = (s.parseAs === "auto" ? P(c.headers.get("Content-Type")) : s.parseAs) ?? "json";
      if (p === "stream") return { data: c.body, ...m };
      let b = await c[p]();
      return p === "json" && (s.responseValidator && await s.responseValidator(b), s.responseTransformer && (b = await s.responseTransformer(b))), { data: b, ...m };
    }
    let g = await c.text();
    try {
      g = JSON.parse(g);
    } catch {
    }
    let d = g;
    for (let p of i.error._fns) d = await p(g, c, u, s);
    if (d = d || {}, s.throwOnError) throw d;
    return { error: d, ...m };
  };
  return { buildUrl: S, connect: (n) => o({ ...n, method: "CONNECT" }), delete: (n) => o({ ...n, method: "DELETE" }), get: (n) => o({ ...n, method: "GET" }), getConfig: e, head: (n) => o({ ...n, method: "HEAD" }), interceptors: i, options: (n) => o({ ...n, method: "OPTIONS" }), patch: (n) => o({ ...n, method: "PATCH" }), post: (n) => o({ ...n, method: "POST" }), put: (n) => o({ ...n, method: "PUT" }), request: o, setConfig: a, trace: (n) => o({ ...n, method: "TRACE" }) };
};

// src/api/client.gen.ts
var client = J(w({
  baseUrl: "http://localhost:8000",
  throwOnError: true
}));

// src/api/sdk.gen.ts
var DefaultService = class {
  /**
   * Retrieves the current user's identity, tenant, and databases.
   */
  static getUserIdentity(options) {
    return (options?.client ?? client).get({
      url: "/api/v2/auth/identity",
      ...options
    });
  }
  /**
   * Retrieves a collection by Chroma Resource Name.
   */
  static getCollectionByCrn(options) {
    return (options.client ?? client).get({
      url: "/api/v2/collections/{crn}",
      ...options
    });
  }
  /**
   * Health check endpoint that returns 200 if the server and executor are ready
   */
  static healthcheck(options) {
    return (options?.client ?? client).get({
      url: "/api/v2/healthcheck",
      ...options
    });
  }
  /**
   * Heartbeat endpoint that returns a nanosecond timestamp of the current time.
   */
  static heartbeat(options) {
    return (options?.client ?? client).get({
      url: "/api/v2/heartbeat",
      ...options
    });
  }
  /**
   * Pre-flight checks endpoint reporting basic readiness info.
   */
  static preFlightChecks(options) {
    return (options?.client ?? client).get({
      url: "/api/v2/pre-flight-checks",
      ...options
    });
  }
  /**
   * Reset endpoint allowing authorized users to reset the database.
   */
  static reset(options) {
    return (options?.client ?? client).post({
      url: "/api/v2/reset",
      ...options
    });
  }
  /**
   * Creates a new tenant.
   */
  static createTenant(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Returns an existing tenant by name.
   */
  static getTenant(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant_name}",
      ...options
    });
  }
  /**
   * Updates an existing tenant by name.
   */
  static updateTenant(options) {
    return (options.client ?? client).patch({
      url: "/api/v2/tenants/{tenant_name}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Lists all databases for a given tenant.
   */
  static listDatabases(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases",
      ...options
    });
  }
  /**
   * Creates a new database for a given tenant.
   */
  static createDatabase(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Deletes a specific database.
   */
  static deleteDatabase(options) {
    return (options.client ?? client).delete({
      url: "/api/v2/tenants/{tenant}/databases/{database}",
      ...options
    });
  }
  /**
   * Retrieves a specific database by name.
   */
  static getDatabase(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases/{database}",
      ...options
    });
  }
  /**
   * Lists all collections in the specified database.
   */
  static listCollections(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections",
      ...options
    });
  }
  /**
   * Creates a new collection under the specified database.
   */
  static createCollection(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Deletes a collection in a given database.
   */
  static deleteCollection(options) {
    return (options.client ?? client).delete({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}",
      ...options
    });
  }
  /**
   * Retrieves a collection by ID or name.
   */
  static getCollection(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}",
      ...options
    });
  }
  /**
   * Updates an existing collection's name or metadata.
   */
  static updateCollection(options) {
    return (options.client ?? client).put({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Adds records to a collection.
   */
  static collectionAdd(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/add",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Retrieves the number of records in a collection.
   */
  static collectionCount(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/count",
      ...options
    });
  }
  /**
   * Deletes records in a collection. Can filter by IDs or metadata.
   */
  static collectionDelete(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/delete",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Forks an existing collection.
   */
  static forkCollection(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/fork",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Retrieves records from a collection by ID or metadata filter.
   */
  static collectionGet(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/get",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Query a collection in a variety of ways, including vector search, metadata filtering, and full-text search
   */
  static collectionQuery(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/query",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Search records from a collection with hybrid criterias.
   */
  static collectionSearch(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/search",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Updates records in a collection by ID.
   */
  static collectionUpdate(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/update",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Upserts records in a collection (create if not exists, otherwise update).
   */
  static collectionUpsert(options) {
    return (options.client ?? client).post({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections/{collection_id}/upsert",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  }
  /**
   * Retrieves the total number of collections in a given database.
   */
  static countCollections(options) {
    return (options.client ?? client).get({
      url: "/api/v2/tenants/{tenant}/databases/{database}/collections_count",
      ...options
    });
  }
  /**
   * Returns the version of the server.
   */
  static version(options) {
    return (options?.client ?? client).get({
      url: "/api/v2/version",
      ...options
    });
  }
};

// src/errors.ts
var ChromaError = class extends Error {
  constructor(name, message, cause) {
    super(message);
    this.cause = cause;
    this.name = name;
  }
};
var ChromaConnectionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaConnectionError";
  }
};
var ChromaServerError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaServerError";
  }
};
var ChromaClientError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaClientError";
  }
};
var ChromaUnauthorizedError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaAuthError";
  }
};
var ChromaForbiddenError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaForbiddenError";
  }
};
var ChromaNotFoundError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaNotFoundError";
  }
};
var ChromaValueError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaValueError";
  }
};
var InvalidCollectionError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "InvalidCollectionError";
  }
};
var InvalidArgumentError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "InvalidArgumentError";
  }
};
var ChromaUniqueError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaUniqueError";
  }
};
var ChromaQuotaExceededError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaQuotaExceededError";
  }
};
var ChromaRateLimitError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ChromaRateLimitError";
  }
};
function createErrorByType(type, message) {
  switch (type) {
    case "InvalidCollection":
      return new InvalidCollectionError(message);
    case "InvalidArgumentError":
      return new InvalidArgumentError(message);
    default:
      return void 0;
  }
}

// src/utils.ts
var DEFAULT_TENANT = "default_tenant";
var DEFAULT_DATABASE = "default_database";
var defaultAdminClientArgs = {
  host: "localhost",
  port: 8e3,
  ssl: false
};
var defaultChromaClientArgs = {
  ...defaultAdminClientArgs,
  tenant: DEFAULT_TENANT,
  database: DEFAULT_DATABASE
};
var normalizeMethod = (method) => {
  if (method) {
    switch (method.toUpperCase()) {
      case "GET":
        return "GET";
      case "POST":
        return "POST";
      case "PUT":
        return "PUT";
      case "DELETE":
        return "DELETE";
      case "HEAD":
        return "HEAD";
      case "CONNECT":
        return "CONNECT";
      case "OPTIONS":
        return "OPTIONS";
      case "PATCH":
        return "PATCH";
      case "TRACE":
        return "TRACE";
      default:
        return void 0;
    }
  }
  return void 0;
};
var validateRecordSetLengthConsistency = (recordSet) => {
  const lengths = Object.entries(recordSet).filter(
    ([field, value]) => recordSetFields.includes(field) && value !== void 0
  ).map(([field, value]) => [field, value.length]);
  if (lengths.length === 0) {
    throw new ChromaValueError(
      `At least one of ${recordSetFields.join(", ")} must be provided`
    );
  }
  const zeroLength = lengths.filter(([_2, length]) => length === 0).map(([field, _2]) => field);
  if (zeroLength.length > 0) {
    throw new ChromaValueError(
      `Non-empty lists are required for ${zeroLength.join(", ")}`
    );
  }
  if (new Set(lengths.map(([_2, length]) => length)).size > 1) {
    throw new ChromaValueError(
      `Unequal lengths for fields ${lengths.map(([field, _2]) => field).join(", ")}`
    );
  }
};
var validateEmbeddings = ({
  embeddings,
  fieldName = "embeddings"
}) => {
  if (!Array.isArray(embeddings)) {
    throw new ChromaValueError(
      `Expected '${fieldName}' to be an array, but got ${typeof embeddings}`
    );
  }
  if (embeddings.length === 0) {
    throw new ChromaValueError(
      "Expected embeddings to be an array with at least one item"
    );
  }
  if (!embeddings.filter((e) => e.every((n) => typeof n === "number"))) {
    throw new ChromaValueError(
      "Expected each embedding to be an array of numbers"
    );
  }
  embeddings.forEach((embedding, i) => {
    if (embedding.length === 0) {
      throw new ChromaValueError(
        `Expected each embedding to be a non-empty array of numbers, but got an empty array at index ${i}`
      );
    }
  });
};
var validateDocuments = ({
  documents,
  nullable = false,
  fieldName = "documents"
}) => {
  if (!Array.isArray(documents)) {
    throw new ChromaValueError(
      `Expected '${fieldName}' to be an array, but got ${typeof documents}`
    );
  }
  if (documents.length === 0) {
    throw new ChromaValueError(
      `Expected '${fieldName}' to be a non-empty list`
    );
  }
  documents.forEach((document) => {
    if (!nullable && typeof document !== "string" && !document) {
      throw new ChromaValueError(
        `Expected each document to be a string, but got ${typeof document}`
      );
    }
  });
};
var validateIDs = (ids) => {
  if (!Array.isArray(ids)) {
    throw new ChromaValueError(
      `Expected 'ids' to be an array, but got ${typeof ids}`
    );
  }
  if (ids.length === 0) {
    throw new ChromaValueError("Expected 'ids' to be a non-empty list");
  }
  const nonStrings = ids.map((id, i) => [id, i]).filter(([id, _2]) => typeof id !== "string").map(([_2, i]) => i);
  if (nonStrings.length > 0) {
    throw new ChromaValueError(
      `Found non-string IDs at ${nonStrings.join(", ")}`
    );
  }
  const seen = /* @__PURE__ */ new Set();
  const duplicates = ids.filter((id) => {
    if (seen.has(id)) {
      return id;
    }
    seen.add(id);
  });
  let message = "Expected IDs to be unique, but found duplicates of";
  if (duplicates.length > 0 && duplicates.length <= 5) {
    throw new ChromaValueError(`${message} ${duplicates.join(", ")}`);
  }
  if (duplicates.length > 0) {
    throw new ChromaValueError(
      `${message} ${duplicates.slice(0, 5).join(", ")}, ..., ${duplicates.slice(duplicates.length - 5).join(", ")}`
    );
  }
};
var validateSparseVector = (v) => {
  return typeof v === "object" && v !== null && "indices" in v && "values" in v && Array.isArray(v.indices) && v.indices.every((e) => typeof e === "number") && Array.isArray(v.values) && v.values.every((e) => typeof e === "number");
};
var validateMetadata = (metadata) => {
  if (!metadata) {
    return;
  }
  if (Object.keys(metadata).length === 0) {
    throw new ChromaValueError("Expected metadata to be non-empty");
  }
  if (!Object.values(metadata).every(
    (v) => v === null || v === void 0 || typeof v === "string" || typeof v === "number" || typeof v === "boolean" || validateSparseVector(v)
  )) {
    throw new ChromaValueError(
      "Expected metadata to be a string, number, boolean, SparseVector, or nullable"
    );
  }
};
var validateMetadatas = (metadatas) => {
  if (!Array.isArray(metadatas)) {
    throw new ChromaValueError(
      `Expected metadatas to be an array, but got ${typeof metadatas}`
    );
  }
  metadatas.forEach((metadata) => validateMetadata(metadata));
};
var validateBaseRecordSet = ({
  recordSet,
  update = false,
  embeddingsField = "embeddings",
  documentsField = "documents"
}) => {
  if (!recordSet.embeddings && !recordSet.documents && !update) {
    throw new ChromaValueError(
      `At least one of '${embeddingsField}' and '${documentsField}' must be provided`
    );
  }
  if (recordSet.embeddings) {
    validateEmbeddings({
      embeddings: recordSet.embeddings,
      fieldName: embeddingsField
    });
  }
  if (recordSet.documents) {
    validateDocuments({
      documents: recordSet.documents,
      fieldName: documentsField
    });
  }
  if (recordSet.metadatas) {
    validateMetadatas(recordSet.metadatas);
  }
};
var validateMaxBatchSize = (recordSetLength, maxBatchSize) => {
  if (recordSetLength > maxBatchSize) {
    throw new ChromaValueError(
      `Record set length ${recordSetLength} exceeds max batch size ${maxBatchSize}`
    );
  }
};
var validateWhere = (where) => {
  if (typeof where !== "object") {
    throw new ChromaValueError("Expected where to be a non-empty object");
  }
  if (Object.keys(where).length != 1) {
    throw new ChromaValueError(
      `Expected 'where' to have exactly one operator, but got ${Object.keys(where).length}`
    );
  }
  Object.entries(where).forEach(([key, value]) => {
    if (key !== "$and" && key !== "$or" && key !== "$in" && key !== "$nin" && !["string", "number", "boolean", "object"].includes(typeof value)) {
      throw new ChromaValueError(
        `Expected 'where' value to be a string, number, boolean, or an operator expression, but got ${value}`
      );
    }
    if (key === "$and" || key === "$or") {
      if (Object.keys(value).length <= 1) {
        throw new ChromaValueError(
          `Expected 'where' value for $and or $or to be a list of 'where' expressions, but got ${value}`
        );
      }
      value.forEach((w2) => validateWhere(w2));
      return;
    }
    if (typeof value === "object") {
      if (Object.keys(value).length != 1) {
        throw new ChromaValueError(
          `Expected operator expression to have one operator, but got ${value}`
        );
      }
      const [operator, operand] = Object.entries(value)[0];
      if (["$gt", "$gte", "$lt", "$lte"].includes(operator) && typeof operand !== "number") {
        throw new ChromaValueError(
          `Expected operand value to be a number for ${operator}, but got ${typeof operand}`
        );
      }
      if (["$in", "$nin"].includes(operator) && !Array.isArray(operand)) {
        throw new ChromaValueError(
          `Expected operand value to be an array for ${operator}, but got ${operand}`
        );
      }
      if (!["$gt", "$gte", "$lt", "$lte", "$ne", "$eq", "$in", "$nin"].includes(
        operator
      )) {
        throw new ChromaValueError(
          `Expected operator to be one of $gt, $gte, $lt, $lte, $ne, $eq, $in, $nin, but got ${operator}`
        );
      }
      if (!["string", "number", "boolean"].includes(typeof operand) && !Array.isArray(operand)) {
        throw new ChromaValueError(
          "Expected operand value to be a string, number, boolean, or a list of those types"
        );
      }
      if (Array.isArray(operand) && (operand.length === 0 || !operand.every((item) => typeof item === typeof operand[0]))) {
        throw new ChromaValueError(
          "Expected 'where' operand value to be a non-empty list and all values to be of the same type"
        );
      }
    }
  });
};
var validateWhereDocument = (whereDocument) => {
  if (typeof whereDocument !== "object") {
    throw new ChromaValueError(
      "Expected 'whereDocument' to be a non-empty object"
    );
  }
  if (Object.keys(whereDocument).length != 1) {
    throw new ChromaValueError(
      `Expected 'whereDocument' to have exactly one operator, but got ${whereDocument}`
    );
  }
  const [operator, operand] = Object.entries(whereDocument)[0];
  if (![
    "$contains",
    "$not_contains",
    "$matches",
    "$not_matches",
    "$regex",
    "$not_regex",
    "$and",
    "$or"
  ].includes(operator)) {
    throw new ChromaValueError(
      `Expected 'whereDocument' operator to be one of $contains, $not_contains, $matches, $not_matches, $regex, $not_regex, $and, or $or, but got ${operator}`
    );
  }
  if (operator === "$and" || operator === "$or") {
    if (!Array.isArray(operand)) {
      throw new ChromaValueError(
        `Expected operand for ${operator} to be a list of 'whereDocument' expressions, but got ${operand}`
      );
    }
    if (operand.length <= 1) {
      throw new ChromaValueError(
        `Expected 'whereDocument' operand for ${operator} to be a list with at least two 'whereDocument' expressions`
      );
    }
    operand.forEach((item) => validateWhereDocument(item));
  }
  if ((operand === "$contains" || operand === "$not_contains" || operand === "$regex" || operand === "$not_regex") && (typeof operator !== "string" || operator.length === 0)) {
    throw new ChromaValueError(
      `Expected operand for ${operator} to be a non empty string, but got ${operand}`
    );
  }
};
var validateInclude = ({
  include,
  exclude
}) => {
  if (!Array.isArray(include)) {
    throw new ChromaValueError("Expected 'include' to be a non-empty array");
  }
  const validValues = Object.keys(IncludeEnum);
  include.forEach((item) => {
    if (typeof item !== "string") {
      throw new ChromaValueError("Expected 'include' items to be strings");
    }
    if (!validValues.includes(item)) {
      throw new ChromaValueError(
        `Expected 'include' items to be one of ${validValues.join(
          ", "
        )}, but got ${item}`
      );
    }
    if (exclude?.includes(item)) {
      throw new ChromaValueError(`${item} is not allowed for this operation`);
    }
  });
};
var validateNResults = (nResults) => {
  if (typeof nResults !== "number") {
    throw new ChromaValueError(
      `Expected 'nResults' to be a number, but got ${typeof nResults}`
    );
  }
  if (nResults <= 0) {
    throw new ChromaValueError("Number of requested results has to positive");
  }
};
var parseConnectionPath = (path) => {
  try {
    const url = new URL(path);
    const ssl = url.protocol === "https:";
    const host = url.hostname;
    const port = url.port;
    return {
      ssl,
      host,
      port: Number(port)
    };
  } catch {
    throw new ChromaValueError(`Invalid URL: ${path}`);
  }
};
var packEmbedding = (embedding) => {
  const buffer = new ArrayBuffer(embedding.length * 4);
  const view = new Float32Array(buffer);
  for (let i = 0; i < embedding.length; i++) {
    view[i] = embedding[i];
  }
  return buffer;
};
var embeddingsToBase64Bytes = (embeddings) => {
  return embeddings.map((embedding) => {
    const buffer = packEmbedding(embedding);
    const uint8Array = new Uint8Array(buffer);
    const binaryString = Array.from(
      uint8Array,
      (byte) => String.fromCharCode(byte)
    ).join("");
    return btoa(binaryString);
  });
};

// src/embedding-function.ts
var knownEmbeddingFunctions = /* @__PURE__ */ new Map();
var registerEmbeddingFunction = (name, fn) => {
  if (knownEmbeddingFunctions.has(name)) {
    throw new ChromaValueError(
      `Embedding function with name ${name} is already registered.`
    );
  }
  knownEmbeddingFunctions.set(name, fn);
};
var getEmbeddingFunction = async (collectionName, efConfig) => {
  if (!efConfig) {
    console.warn(
      `No embedding function configuration found for collection ${collectionName}. 'add' and 'query' will fail unless you provide them embeddings directly.`
    );
    return void 0;
  }
  if (efConfig.type === "legacy") {
    console.warn(
      `No embedding function configuration found for collection ${collectionName}. 'add' and 'query' will fail unless you provide them embeddings directly.`
    );
    return void 0;
  }
  const name = efConfig.name;
  const embeddingFunction = knownEmbeddingFunctions.get(name);
  if (!embeddingFunction) {
    console.warn(
      `Collection ${collectionName} was created with the ${embeddingFunction} embedding function. However, the @chroma-core/${embeddingFunction} package is not install. 'add' and 'query' will fail unless you provide them embeddings directly, or install the @chroma-core/${embeddingFunction} package.`
    );
    return void 0;
  }
  let constructorConfig = efConfig.type === "known" ? efConfig.config : {};
  try {
    if (embeddingFunction.buildFromConfig) {
      return embeddingFunction.buildFromConfig(constructorConfig);
    }
    console.warn(
      `Embedding function ${name} does not define a 'buildFromConfig' function. 'add' and 'query' will fail unless you provide them embeddings directly.`
    );
    return void 0;
  } catch (e) {
    console.warn(
      `Embedding function ${name} failed to build with config: ${constructorConfig}. 'add' and 'query' will fail unless you provide them embeddings directly. Error: ${e}`
    );
    return void 0;
  }
};
var serializeEmbeddingFunction = ({
  embeddingFunction,
  configEmbeddingFunction
}) => {
  if (embeddingFunction && configEmbeddingFunction) {
    throw new ChromaValueError(
      "Embedding function provided when already defined in the collection configuration"
    );
  }
  if (!embeddingFunction && !configEmbeddingFunction) {
    return void 0;
  }
  const ef = embeddingFunction || configEmbeddingFunction;
  if (!ef.getConfig || !ef.name || !ef.constructor.buildFromConfig) {
    return { type: "legacy" };
  }
  if (ef.validateConfig) ef.validateConfig(ef.getConfig());
  return {
    name: ef.name,
    type: "known",
    config: ef.getConfig()
  };
};
var getDefaultEFConfig = async () => {
  try {
    const { DefaultEmbeddingFunction } = await import("@chroma-core/default-embed");
    if (!knownEmbeddingFunctions.has(new DefaultEmbeddingFunction().name)) {
      registerEmbeddingFunction("default", DefaultEmbeddingFunction);
    }
  } catch (e) {
    console.error(e);
    throw new Error(
      "Cannot instantiate a collection with the DefaultEmbeddingFunction. Please install @chroma-core/default-embed, or provide a different embedding function"
    );
  }
  return {
    name: "default",
    type: "known",
    config: {}
  };
};

// src/collection-configuration.ts
var processCreateCollectionConfig = async ({
  configuration,
  embeddingFunction,
  metadata
}) => {
  if (configuration?.hnsw && configuration?.spann) {
    throw new ChromaValueError(
      "Cannot specify both HNSW and SPANN configurations"
    );
  }
  let embeddingFunctionConfiguration = serializeEmbeddingFunction({
    embeddingFunction: embeddingFunction ?? void 0,
    configEmbeddingFunction: configuration?.embeddingFunction
  });
  if (!embeddingFunctionConfiguration && embeddingFunction !== null) {
    embeddingFunctionConfiguration = await getDefaultEFConfig();
  }
  const overallEf = embeddingFunction || configuration?.embeddingFunction;
  if (overallEf && overallEf.defaultSpace && overallEf.supportedSpaces) {
    if (configuration?.hnsw === void 0 && configuration?.spann === void 0) {
      if (metadata === void 0 || metadata?.["hnsw:space"] === void 0) {
        if (!configuration) configuration = {};
        configuration.hnsw = { space: overallEf.defaultSpace() };
      }
    }
    if (configuration?.hnsw && !configuration.hnsw.space && overallEf.defaultSpace) {
      configuration.hnsw.space = overallEf.defaultSpace();
    }
    if (configuration?.spann && !configuration.spann.space && overallEf.defaultSpace) {
      configuration.spann.space = overallEf.defaultSpace();
    }
    if (overallEf.supportedSpaces) {
      const supportedSpaces = overallEf.supportedSpaces();
      if (configuration?.hnsw?.space && !supportedSpaces.includes(configuration.hnsw.space)) {
        console.warn(
          `Space '${configuration.hnsw.space}' is not supported by embedding function '${overallEf.name || "unknown"}'. Supported spaces: ${supportedSpaces.join(", ")}`
        );
      }
      if (configuration?.spann?.space && !supportedSpaces.includes(configuration.spann.space)) {
        console.warn(
          `Space '${configuration.spann.space}' is not supported by embedding function '${overallEf.name || "unknown"}'. Supported spaces: ${supportedSpaces.join(", ")}`
        );
      }
      if (!configuration?.hnsw && !configuration?.spann && metadata && typeof metadata["hnsw:space"] === "string" && !supportedSpaces.includes(metadata["hnsw:space"])) {
        console.warn(
          `Space '${metadata["hnsw:space"]}' from metadata is not supported by embedding function '${overallEf.name || "unknown"}'. Supported spaces: ${supportedSpaces.join(", ")}`
        );
      }
    }
  }
  return {
    ...configuration || {},
    embedding_function: embeddingFunctionConfiguration
  };
};
var processUpdateCollectionConfig = async ({
  collectionName,
  currentConfiguration,
  currentEmbeddingFunction,
  newConfiguration
}) => {
  if (newConfiguration.hnsw && typeof newConfiguration.hnsw !== "object") {
    throw new ChromaValueError(
      "Invalid HNSW config provided in UpdateCollectionConfiguration"
    );
  }
  if (newConfiguration.spann && typeof newConfiguration.spann !== "object") {
    throw new ChromaValueError(
      "Invalid SPANN config provided in UpdateCollectionConfiguration"
    );
  }
  const embeddingFunction = currentEmbeddingFunction || await getEmbeddingFunction(
    collectionName,
    currentConfiguration.embeddingFunction ?? void 0
  );
  const newEmbeddingFunction = newConfiguration.embeddingFunction;
  if (embeddingFunction && embeddingFunction.validateConfigUpdate && newEmbeddingFunction && newEmbeddingFunction.getConfig) {
    embeddingFunction.validateConfigUpdate(newEmbeddingFunction.getConfig());
  }
  return {
    updateConfiguration: {
      hnsw: newConfiguration.hnsw,
      spann: newConfiguration.spann,
      embedding_function: newEmbeddingFunction && serializeEmbeddingFunction({ embeddingFunction: newEmbeddingFunction })
    },
    updateEmbeddingFunction: newEmbeddingFunction
  };
};

// src/collection.ts
var CollectionImpl = class _CollectionImpl {
  /**
   * Creates a new CollectionAPIImpl instance.
   * @param options - Configuration for the collection API
   */
  constructor({
    chromaClient,
    apiClient,
    id,
    name,
    metadata,
    configuration,
    embeddingFunction
  }) {
    this.chromaClient = chromaClient;
    this.apiClient = apiClient;
    this.id = id;
    this._name = name;
    this._metadata = metadata;
    this._configuration = configuration;
    this._embeddingFunction = embeddingFunction;
  }
  get name() {
    return this._name;
  }
  set name(name) {
    this._name = name;
  }
  get configuration() {
    return this._configuration;
  }
  set configuration(configuration) {
    this._configuration = configuration;
  }
  get metadata() {
    return this._metadata;
  }
  set metadata(metadata) {
    this._metadata = metadata;
  }
  get embeddingFunction() {
    return this._embeddingFunction;
  }
  set embeddingFunction(embeddingFunction) {
    this._embeddingFunction = embeddingFunction;
  }
  async path() {
    const clientPath = await this.chromaClient._path();
    return {
      ...clientPath,
      collection_id: this.id
    };
  }
  async embed(documents) {
    if (!this._embeddingFunction) {
      throw new ChromaValueError(
        "Embedding function must be defined for operations requiring embeddings."
      );
    }
    return await this._embeddingFunction.generate(documents);
  }
  async prepareRecords({
    recordSet,
    update = false
  }) {
    const maxBatchSize = await this.chromaClient.getMaxBatchSize();
    validateRecordSetLengthConsistency(recordSet);
    validateIDs(recordSet.ids);
    validateBaseRecordSet({ recordSet, update });
    validateMaxBatchSize(recordSet.ids.length, maxBatchSize);
    if (!recordSet.embeddings && recordSet.documents) {
      recordSet.embeddings = await this.embed(recordSet.documents);
    }
    const preparedRecordSet = { ...recordSet };
    const base64Supported = await this.chromaClient.supportsBase64Encoding();
    if (base64Supported && recordSet.embeddings) {
      preparedRecordSet.embeddings = embeddingsToBase64Bytes(
        recordSet.embeddings
      );
    }
    return preparedRecordSet;
  }
  validateGet(include, ids, where, whereDocument) {
    validateInclude({ include, exclude: ["distances"] });
    if (ids) validateIDs(ids);
    if (where) validateWhere(where);
    if (whereDocument) validateWhereDocument(whereDocument);
  }
  async prepareQuery(recordSet, include, ids, where, whereDocument, nResults) {
    validateBaseRecordSet({
      recordSet,
      embeddingsField: "queryEmbeddings",
      documentsField: "queryTexts"
    });
    validateInclude({ include });
    if (ids) validateIDs(ids);
    if (where) validateWhere(where);
    if (whereDocument) validateWhereDocument(whereDocument);
    if (nResults) validateNResults(nResults);
    let embeddings;
    if (!recordSet.embeddings) {
      embeddings = await this.embed(recordSet.documents);
    } else {
      embeddings = recordSet.embeddings;
    }
    return {
      ...recordSet,
      ids,
      embeddings
    };
  }
  validateDelete(ids, where, whereDocument) {
    if (ids) validateIDs(ids);
    if (where) validateWhere(where);
    if (whereDocument) validateWhereDocument(whereDocument);
  }
  async count() {
    const { data } = await DefaultService.collectionCount({
      client: this.apiClient,
      path: await this.path()
    });
    return data;
  }
  async add({
    ids,
    embeddings,
    metadatas,
    documents,
    uris
  }) {
    const recordSet = {
      ids,
      embeddings,
      documents,
      metadatas,
      uris
    };
    const preparedRecordSet = await this.prepareRecords({ recordSet });
    await DefaultService.collectionAdd({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids: preparedRecordSet.ids,
        embeddings: preparedRecordSet.embeddings,
        documents: preparedRecordSet.documents,
        metadatas: preparedRecordSet.metadatas,
        uris: preparedRecordSet.uris
      }
    });
  }
  async get(args = {}) {
    const {
      ids,
      where,
      limit,
      offset,
      whereDocument,
      include = ["documents", "metadatas"]
    } = args;
    this.validateGet(include, ids, where, whereDocument);
    const { data } = await DefaultService.collectionGet({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids,
        where,
        limit,
        offset,
        where_document: whereDocument,
        include
      }
    });
    return new GetResult({
      documents: data.documents ?? [],
      embeddings: data.embeddings ?? [],
      ids: data.ids,
      include: data.include,
      metadatas: data.metadatas ?? [],
      uris: data.uris ?? []
    });
  }
  async peek({ limit = 10 }) {
    return this.get({ limit });
  }
  async query({
    queryEmbeddings,
    queryTexts,
    queryURIs,
    ids,
    nResults = 10,
    where,
    whereDocument,
    include = ["metadatas", "documents", "distances"]
  }) {
    const recordSet = {
      embeddings: queryEmbeddings,
      documents: queryTexts,
      uris: queryURIs
    };
    const queryRecordSet = await this.prepareQuery(
      recordSet,
      include,
      ids,
      where,
      whereDocument,
      nResults
    );
    const { data } = await DefaultService.collectionQuery({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids: queryRecordSet.ids,
        include,
        n_results: nResults,
        query_embeddings: queryRecordSet.embeddings,
        where,
        where_document: whereDocument
      }
    });
    return new QueryResult({
      distances: data.distances ?? [],
      documents: data.documents ?? [],
      embeddings: data.embeddings ?? [],
      ids: data.ids ?? [],
      include: data.include,
      metadatas: data.metadatas ?? [],
      uris: data.uris ?? []
    });
  }
  async modify({
    name,
    metadata,
    configuration
  }) {
    if (name) this.name = name;
    if (metadata) {
      validateMetadata(metadata);
      this.metadata = metadata;
    }
    const { updateConfiguration, updateEmbeddingFunction } = configuration ? await processUpdateCollectionConfig({
      collectionName: this.name,
      currentConfiguration: this.configuration,
      newConfiguration: configuration,
      currentEmbeddingFunction: this.embeddingFunction
    }) : {};
    if (updateEmbeddingFunction) {
      this.embeddingFunction = updateEmbeddingFunction;
    }
    if (updateConfiguration) {
      this.configuration = {
        hnsw: { ...this.configuration.hnsw, ...updateConfiguration.hnsw },
        spann: { ...this.configuration.spann, ...updateConfiguration.spann },
        embeddingFunction: updateConfiguration.embedding_function
      };
    }
    await DefaultService.updateCollection({
      client: this.apiClient,
      path: await this.path(),
      body: {
        new_name: name,
        new_metadata: metadata,
        new_configuration: updateConfiguration
      }
    });
  }
  async fork({ name }) {
    const { data } = await DefaultService.forkCollection({
      client: this.apiClient,
      path: await this.path(),
      body: { new_name: name }
    });
    return new _CollectionImpl({
      chromaClient: this.chromaClient,
      apiClient: this.apiClient,
      name: data.name,
      id: data.id,
      embeddingFunction: this._embeddingFunction,
      metadata: data.metadata ?? void 0,
      configuration: data.configuration_json
    });
  }
  async update({
    ids,
    embeddings,
    metadatas,
    documents,
    uris
  }) {
    const recordSet = {
      ids,
      embeddings,
      documents,
      metadatas,
      uris
    };
    const preparedRecordSet = await this.prepareRecords({
      recordSet,
      update: true
    });
    await DefaultService.collectionUpdate({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids: preparedRecordSet.ids,
        embeddings: preparedRecordSet.embeddings,
        metadatas: preparedRecordSet.metadatas,
        uris: preparedRecordSet.uris,
        documents: preparedRecordSet.documents
      }
    });
  }
  async upsert({
    ids,
    embeddings,
    metadatas,
    documents,
    uris
  }) {
    const recordSet = {
      ids,
      embeddings,
      documents,
      metadatas,
      uris
    };
    const preparedRecordSet = await this.prepareRecords({
      recordSet
    });
    await DefaultService.collectionUpsert({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids: preparedRecordSet.ids,
        embeddings: preparedRecordSet.embeddings,
        metadatas: preparedRecordSet.metadatas,
        uris: preparedRecordSet.uris,
        documents: preparedRecordSet.documents
      }
    });
  }
  async delete({
    ids,
    where,
    whereDocument
  }) {
    this.validateDelete(ids, where, whereDocument);
    await DefaultService.collectionDelete({
      client: this.apiClient,
      path: await this.path(),
      body: {
        ids,
        where,
        where_document: whereDocument
      }
    });
  }
};

// src/next.ts
function withChroma(userNextConfig = {}) {
  const originalWebpackFunction = userNextConfig.webpack;
  const newWebpackFunction = (config, options) => {
    if (!Array.isArray(config.externals)) {
      config.externals = [];
    }
    const externalsToAdd = ["@huggingface/transformers", "chromadb"];
    for (const ext of externalsToAdd) {
      if (!config.externals.includes(ext)) {
        config.externals.push(ext);
      }
    }
    if (typeof originalWebpackFunction === "function") {
      return originalWebpackFunction(config, options);
    }
    return config;
  };
  return {
    ...userNextConfig,
    webpack: newWebpackFunction
  };
}

// src/chroma-fetch.ts
var offlineError = (error) => {
  return Boolean(
    (error?.name === "TypeError" || error?.name === "FetchError") && (error.message?.includes("fetch failed") || error.message?.includes("Failed to fetch") || error.message?.includes("ENOTFOUND"))
  );
};
var chromaFetch = async (input, init) => {
  let response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    if (offlineError(err)) {
      throw new ChromaConnectionError(
        "Failed to connect to chromadb. Make sure your server is running and try again. If you are running from a browser, make sure that your chromadb instance is configured to allow requests from the current origin using the CHROMA_SERVER_CORS_ALLOW_ORIGINS environment variable."
      );
    }
    throw new ChromaConnectionError("Failed to connect to Chroma");
  }
  if (response.ok) {
    return response;
  }
  switch (response.status) {
    case 400:
      let status = "Bad Request";
      try {
        const responseBody = await response.json();
        status = responseBody.message || status;
      } catch {
      }
      throw new ChromaClientError(
        `Bad request to ${input.url || "Chroma"} with status: ${status}`
      );
    case 401:
      throw new ChromaUnauthorizedError(`Unauthorized`);
    case 403:
      throw new ChromaForbiddenError(
        `You do not have permission to access the requested resource.`
      );
    case 404:
      throw new ChromaNotFoundError(
        `The requested resource could not be found`
      );
    case 409:
      throw new ChromaUniqueError("The resource already exists");
    case 422:
      const body = await response.json();
      if (body && body.message && (body.message.startsWith("Quota exceeded") || body.message.startsWith("Billing limit exceeded"))) {
        throw new ChromaQuotaExceededError(body?.message);
      }
      break;
    case 429:
      throw new ChromaRateLimitError("Rate limit exceeded");
  }
  throw new ChromaConnectionError(
    `Unable to connect to the chromadb server (status: ${response.status}). Please try again later.`
  );
};

// src/admin-client.ts
var AdminClient = class {
  /**
   * Creates a new AdminClient instance.
   * @param args - Optional configuration for the admin client
   */
  constructor(args) {
    const { host, port, ssl, headers, fetchOptions } = args || defaultAdminClientArgs;
    const baseUrl = `${ssl ? "https" : "http"}://${host}:${port}`;
    const configOptions = {
      ...fetchOptions,
      method: normalizeMethod(fetchOptions?.method),
      baseUrl,
      headers
    };
    this.apiClient = J(w(configOptions));
    this.apiClient.setConfig({ fetch: chromaFetch });
  }
  /**
   * Creates a new database within a tenant.
   * @param options - Database creation options
   * @param options.name - Name of the database to create
   * @param options.tenant - Tenant that will own the database
   */
  async createDatabase({
    name,
    tenant
  }) {
    await DefaultService.createDatabase({
      client: this.apiClient,
      path: { tenant },
      body: { name }
    });
  }
  /**
   * Retrieves information about a specific database.
   * @param options - Database retrieval options
   * @param options.name - Name of the database to retrieve
   * @param options.tenant - Tenant that owns the database
   * @returns Promise resolving to database information
   */
  async getDatabase({
    name,
    tenant
  }) {
    const { data } = await DefaultService.getDatabase({
      client: this.apiClient,
      path: { tenant, database: name }
    });
    return data;
  }
  /**
   * Deletes a database and all its data.
   * @param options - Database deletion options
   * @param options.name - Name of the database to delete
   * @param options.tenant - Tenant that owns the database
   * @warning This operation is irreversible and will delete all data
   */
  async deleteDatabase({
    name,
    tenant
  }) {
    await DefaultService.deleteDatabase({
      client: this.apiClient,
      path: { tenant, database: name }
    });
  }
  /**
   * Lists all databases within a tenant.
   * @param args - Listing parameters including tenant and pagination
   * @returns Promise resolving to an array of database information
   */
  async listDatabases(args) {
    const { limit = 100, offset = 0, tenant } = args;
    const { data } = await DefaultService.listDatabases({
      client: this.apiClient,
      path: { tenant },
      query: { limit, offset }
    });
    return data;
  }
  /**
   * Creates a new tenant.
   * @param options - Tenant creation options
   * @param options.name - Name of the tenant to create
   */
  async createTenant({ name }) {
    await DefaultService.createTenant({
      client: this.apiClient,
      body: { name }
    });
  }
  /**
   * Retrieves information about a specific tenant.
   * @param options - Tenant retrieval options
   * @param options.name - Name of the tenant to retrieve
   * @returns Promise resolving to the tenant name
   */
  async getTenant({ name }) {
    const { data } = await DefaultService.getTenant({
      client: this.apiClient,
      path: { tenant_name: name }
    });
    return data.name;
  }
};

// src/chroma-client.ts
import * as process from "node:process";
var ChromaClient = class {
  /**
   * Creates a new ChromaClient instance.
   * @param args - Configuration options for the client
   */
  constructor(args = {}) {
    let {
      host = defaultChromaClientArgs.host,
      port = defaultChromaClientArgs.port,
      ssl = defaultChromaClientArgs.ssl,
      tenant = defaultChromaClientArgs.tenant,
      database = defaultChromaClientArgs.database,
      headers = defaultChromaClientArgs.headers,
      fetchOptions = defaultChromaClientArgs.fetchOptions
    } = args;
    if (args.path) {
      console.warn(
        "The 'path' argument is deprecated. Please use 'ssl', 'host', and 'port' instead"
      );
      const parsedPath = parseConnectionPath(args.path);
      ssl = parsedPath.ssl;
      host = parsedPath.host;
      port = parsedPath.port;
    }
    if (args.auth) {
      console.warn(
        "The 'auth' argument is deprecated. Please use 'headers' instead"
      );
      if (!headers) {
        headers = {};
      }
      if (!headers["x-chroma-token"] && args.auth.tokenHeaderType === "X_CHROMA_TOKEN" && args.auth.credentials) {
        headers["x-chroma-token"] = args.auth.credentials;
      }
    }
    const baseUrl = `${ssl ? "https" : "http"}://${host}:${port}`;
    this._tenant = tenant || process.env.CHROMA_TENANT;
    this._database = database || process.env.CHROMA_DATABASE;
    const configOptions = {
      ...fetchOptions,
      method: normalizeMethod(fetchOptions?.method),
      baseUrl,
      headers
    };
    this.apiClient = J(w(configOptions));
    this.apiClient.setConfig({ fetch: chromaFetch });
  }
  /**
   * Gets the current tenant name.
   * @returns The tenant name or undefined if not set
   */
  get tenant() {
    return this._tenant;
  }
  set tenant(tenant) {
    this._tenant = tenant;
  }
  /**
   * Gets the current database name.
   * @returns The database name or undefined if not set
   */
  get database() {
    return this._database;
  }
  set database(database) {
    this._database = database;
  }
  /**
   * Gets the preflight checks
   * @returns The preflight checks or undefined if not set
   */
  get preflightChecks() {
    return this._preflightChecks;
  }
  set preflightChecks(preflightChecks) {
    this._preflightChecks = preflightChecks;
  }
  /** @ignore */
  async _path() {
    if (!this._tenant || !this._database) {
      const { tenant, databases } = await this.getUserIdentity();
      const uniqueDBs = [...new Set(databases)];
      this._tenant = tenant;
      if (uniqueDBs.length === 0) {
        throw new ChromaUnauthorizedError(
          `Your API key does not have access to any DBs for tenant ${this.tenant}`
        );
      }
      if (uniqueDBs.length > 1 || uniqueDBs[0] === "*") {
        throw new ChromaValueError(
          "Your API key is scoped to more than 1 DB. Please provide a DB name to the CloudClient constructor"
        );
      }
      this._database = uniqueDBs[0];
    }
    return { tenant: this._tenant, database: this._database };
  }
  /**
   * Gets the user identity information including tenant and accessible databases.
   * @returns Promise resolving to user identity data
   */
  async getUserIdentity() {
    const { data } = await DefaultService.getUserIdentity({
      client: this.apiClient
    });
    return data;
  }
  /**
   * Sends a heartbeat request to check server connectivity.
   * @returns Promise resolving to the server's nanosecond heartbeat timestamp
   */
  async heartbeat() {
    const { data } = await DefaultService.heartbeat({
      client: this.apiClient
    });
    return data["nanosecond heartbeat"];
  }
  /**
   * Lists all collections in the current database.
   * @param args - Optional pagination parameters
   * @param args.limit - Maximum number of collections to return (default: 100)
   * @param args.offset - Number of collections to skip (default: 0)
   * @returns Promise resolving to an array of Collection instances
   */
  async listCollections(args) {
    const { limit = 100, offset = 0 } = args || {};
    const { data } = await DefaultService.listCollections({
      client: this.apiClient,
      path: await this._path(),
      query: { limit, offset }
    });
    return Promise.all(
      data.map(
        async (collection) => new CollectionImpl({
          chromaClient: this,
          apiClient: this.apiClient,
          name: collection.name,
          id: collection.id,
          embeddingFunction: await getEmbeddingFunction(
            collection.name,
            collection.configuration_json.embedding_function ?? void 0
          ),
          configuration: collection.configuration_json,
          metadata: collection.metadata ?? void 0
        })
      )
    );
  }
  /**
   * Gets the total number of collections in the current database.
   * @returns Promise resolving to the collection count
   */
  async countCollections() {
    const { data } = await DefaultService.countCollections({
      client: this.apiClient,
      path: await this._path()
    });
    return data;
  }
  /**
   * Creates a new collection with the specified configuration.
   * @param options - Collection creation options
   * @param options.name - The name of the collection
   * @param options.configuration - Optional collection configuration
   * @param options.metadata - Optional metadata for the collection
   * @param options.embeddingFunction - Optional embedding function to use. Defaults to `DefaultEmbeddingFunction` from @chroma-core/default-embed
   * @returns Promise resolving to the created Collection instance
   * @throws Error if a collection with the same name already exists
   */
  async createCollection({
    name,
    configuration,
    metadata,
    embeddingFunction
  }) {
    const collectionConfig = await processCreateCollectionConfig({
      configuration,
      embeddingFunction,
      metadata
    });
    const { data } = await DefaultService.createCollection({
      client: this.apiClient,
      path: await this._path(),
      body: {
        name,
        configuration: collectionConfig,
        metadata,
        get_or_create: false
      }
    });
    return new CollectionImpl({
      chromaClient: this,
      apiClient: this.apiClient,
      name,
      configuration: data.configuration_json,
      metadata,
      embeddingFunction: embeddingFunction ?? await getEmbeddingFunction(
        data.name,
        data.configuration_json.embedding_function ?? void 0
      ),
      id: data.id
    });
  }
  /**
   * Retrieves an existing collection by name.
   * @param options - Collection retrieval options
   * @param options.name - The name of the collection to retrieve
   * @param options.embeddingFunction - Optional embedding function. Should match the one used to create the collection.
   * @returns Promise resolving to the Collection instance
   * @throws Error if the collection does not exist
   */
  async getCollection({
    name,
    embeddingFunction
  }) {
    const { data } = await DefaultService.getCollection({
      client: this.apiClient,
      path: { ...await this._path(), collection_id: name }
    });
    return new CollectionImpl({
      chromaClient: this,
      apiClient: this.apiClient,
      name,
      configuration: data.configuration_json,
      metadata: data.metadata ?? void 0,
      embeddingFunction: embeddingFunction ? embeddingFunction : await getEmbeddingFunction(
        data.name,
        data.configuration_json.embedding_function ?? void 0
      ),
      id: data.id
    });
  }
  /**
   * Retrieves multiple collections by name.
   * @param items - Array of collection names or objects with name and optional embedding function (should match the ones used to create the collections)
   * @returns Promise resolving to an array of Collection instances
   */
  async getCollections(items) {
    if (items.length === 0) return [];
    let requestedCollections = items;
    if (typeof items[0] === "string") {
      requestedCollections = items.map((item) => {
        return { name: item, embeddingFunction: void 0 };
      });
    }
    let collections = requestedCollections;
    return Promise.all(
      collections.map(async (collection) => {
        return this.getCollection({ ...collection });
      })
    );
  }
  /**
   * Gets an existing collection or creates it if it doesn't exist.
   * @param options - Collection options
   * @param options.name - The name of the collection
   * @param options.configuration - Optional collection configuration (used only if creating)
   * @param options.metadata - Optional metadata for the collection (used only if creating)
   * @param options.embeddingFunction - Optional embedding function to use
   * @returns Promise resolving to the Collection instance
   */
  async getOrCreateCollection({
    name,
    configuration,
    metadata,
    embeddingFunction
  }) {
    const collectionConfig = await processCreateCollectionConfig({
      configuration,
      embeddingFunction,
      metadata
    });
    const { data } = await DefaultService.createCollection({
      client: this.apiClient,
      path: await this._path(),
      body: {
        name,
        configuration: collectionConfig,
        metadata,
        get_or_create: true
      }
    });
    return new CollectionImpl({
      chromaClient: this,
      apiClient: this.apiClient,
      name,
      configuration: data.configuration_json,
      metadata: data.metadata ?? void 0,
      embeddingFunction: embeddingFunction ?? await getEmbeddingFunction(
        name,
        data.configuration_json.embedding_function ?? void 0
      ),
      id: data.id
    });
  }
  /**
   * Deletes a collection and all its data.
   * @param options - Deletion options
   * @param options.name - The name of the collection to delete
   */
  async deleteCollection({ name }) {
    await DefaultService.deleteCollection({
      client: this.apiClient,
      path: { ...await this._path(), collection_id: name }
    });
  }
  /**
   * Resets the entire database, deleting all collections and data.
   * @returns Promise that resolves when the reset is complete
   * @warning This operation is irreversible and will delete all data
   */
  async reset() {
    await DefaultService.reset({
      client: this.apiClient
    });
  }
  /**
   * Gets the version of the Chroma server.
   * @returns Promise resolving to the server version string
   */
  async version() {
    const { data } = await DefaultService.version({
      client: this.apiClient
    });
    return data;
  }
  /**
   * Gets the preflight checks
   * @returns Promise resolving to the preflight checks
   */
  async getPreflightChecks() {
    if (!this.preflightChecks) {
      const { data } = await DefaultService.preFlightChecks({
        client: this.apiClient
      });
      this.preflightChecks = data;
      return this.preflightChecks;
    }
    return this.preflightChecks;
  }
  /**
   * Gets the max batch size
   * @returns Promise resolving to the max batch size
   */
  async getMaxBatchSize() {
    const preflightChecks = await this.getPreflightChecks();
    return preflightChecks.max_batch_size ?? -1;
  }
  /**
   * Gets whether base64_encoding is supported by the connected server
   * @returns Promise resolving to whether base64_encoding is supported
   */
  async supportsBase64Encoding() {
    const preflightChecks = await this.getPreflightChecks();
    return preflightChecks.supports_base64_encoding ?? false;
  }
};

// src/cloud-client.ts
import * as process2 from "node:process";
var CloudClient = class extends ChromaClient {
  /**
   * Creates a new CloudClient instance for Chroma Cloud.
   * @param args - Cloud client configuration options
   */
  constructor(args = {}) {
    const apiKey = args.apiKey || process2.env.CHROMA_API_KEY;
    if (!apiKey) {
      throw new ChromaValueError(
        "Missing API key. Please provide it to the CloudClient constructor or set your CHROMA_API_KEY environment variable"
      );
    }
    const tenant = args.tenant || process2.env.CHROMA_TENANT;
    const database = args.database || process2.env.CHROMA_DATABASE;
    super({
      host: "api.trychroma.com",
      port: 8e3,
      ssl: true,
      tenant,
      database,
      headers: { "x-chroma-token": apiKey },
      fetchOptions: args.fetchOptions
    });
    this.tenant = tenant;
    this.database = database;
  }
};
var AdminCloudClient = class extends AdminClient {
  /**
   * Creates a new AdminCloudClient instance for cloud admin operations.
   * @param args - Admin cloud client configuration options
   */
  constructor(args = {}) {
    const apiKey = args.apiKey || process2.env.CHROMA_API_KEY;
    if (!apiKey) {
      throw new ChromaValueError(
        "Missing API key. Please provide it to the CloudClient constructor or set your CHROMA_API_KEY environment variable"
      );
    }
    super({
      host: "api.trychroma.com",
      port: 8e3,
      ssl: true,
      headers: { "x-chroma-token": apiKey },
      fetchOptions: args.fetchOptions
    });
  }
};
export {
  AdminClient,
  AdminCloudClient,
  ChromaClient,
  ChromaClientError,
  ChromaConnectionError,
  ChromaError,
  ChromaForbiddenError,
  ChromaNotFoundError,
  ChromaQuotaExceededError,
  ChromaRateLimitError,
  ChromaServerError,
  ChromaUnauthorizedError,
  ChromaUniqueError,
  ChromaValueError,
  CloudClient,
  GetResult,
  IncludeEnum,
  InvalidArgumentError,
  InvalidCollectionError,
  QueryResult,
  baseRecordSetFields,
  createErrorByType,
  getDefaultEFConfig,
  getEmbeddingFunction,
  knownEmbeddingFunctions,
  processCreateCollectionConfig,
  processUpdateCollectionConfig,
  recordSetFields,
  registerEmbeddingFunction,
  serializeEmbeddingFunction,
  withChroma
};
//# sourceMappingURL=chromadb.mjs.map