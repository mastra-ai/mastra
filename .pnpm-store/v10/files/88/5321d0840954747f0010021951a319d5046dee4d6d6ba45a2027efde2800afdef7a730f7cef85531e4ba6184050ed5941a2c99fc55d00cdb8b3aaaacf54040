// src/workers/shared/blob.worker.ts
import assert from "node-internal:internal_assert";
import { Buffer as Buffer2 } from "node-internal:internal_buffer";

// src/workers/shared/data.ts
import { Buffer } from "node-internal:internal_buffer";
function viewToBuffer(view) {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  );
}
function base64Encode(value) {
  return Buffer.from(value, "utf8").toString("base64");
}
function base64Decode(encoded) {
  return Buffer.from(encoded, "base64").toString("utf8");
}
var dotRegexp = /(^|\/|\\)(\.+)(\/|\\|$)/g, illegalRegexp = /[?<>*"'^/\\:|\x00-\x1f\x80-\x9f]/g, windowsReservedRegexp = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i, leadingRegexp = /^[ /\\]+/, trailingRegexp = /[ /\\]+$/;
function dotReplacement(match, g1, g2, g3) {
  return `${g1}${"".padStart(g2.length, "_")}${g3}`;
}
function underscoreReplacement(match) {
  return "".padStart(match.length, "_");
}
function sanitisePath(unsafe) {
  return unsafe.replace(dotRegexp, dotReplacement).replace(dotRegexp, dotReplacement).replace(illegalRegexp, "_").replace(windowsReservedRegexp, "_").replace(leadingRegexp, underscoreReplacement).replace(trailingRegexp, underscoreReplacement).substring(0, 255);
}

// src/workers/shared/blob.worker.ts
var ENCODER = new TextEncoder();
async function readPrefix(stream, prefixLength) {
  let reader = await stream.getReader({ mode: "byob" }), result = await reader.readAtLeast(
    prefixLength,
    new Uint8Array(prefixLength)
  );
  assert(result.value !== void 0), reader.releaseLock();
  let rest = stream.pipeThrough(new IdentityTransformStream());
  return [result.value, rest];
}
function rangeHeaders(range) {
  return { Range: `bytes=${range.start}-${range.end}` };
}
function assertFullRangeRequest(range, contentLength) {
  assert(
    range.start === 0 && range.end === contentLength - 1,
    "Received full content, but requested partial content"
  );
}
async function fetchSingleRange(fetcher, url, range) {
  let headers = range === void 0 ? {} : rangeHeaders(range), res = await fetcher.fetch(url, { headers });
  if (res.status === 404) return null;
  if (assert(res.ok && res.body !== null), range !== void 0 && res.status !== 206) {
    let contentLength = parseInt(res.headers.get("Content-Length"));
    assert(!Number.isNaN(contentLength)), assertFullRangeRequest(range, contentLength);
  }
  return res.body;
}
async function writeMultipleRanges(fetcher, url, ranges, boundary, writable, contentLength, contentType) {
  for (let i = 0; i < ranges.length; i++) {
    let range = ranges[i], writer2 = writable.getWriter();
    i > 0 && await writer2.write(ENCODER.encode(`\r
`)), await writer2.write(ENCODER.encode(`--${boundary}\r
`)), contentType !== void 0 && await writer2.write(ENCODER.encode(`Content-Type: ${contentType}\r
`));
    let start = range.start, end = Math.min(range.end, contentLength - 1);
    await writer2.write(
      ENCODER.encode(
        `Content-Range: bytes ${start}-${end}/${contentLength}\r
\r
`
      )
    ), writer2.releaseLock();
    let res = await fetcher.fetch(url, { headers: rangeHeaders(range) });
    assert(
      res.ok && res.body !== null,
      `Failed to fetch ${url}[${range.start},${range.end}], received ${res.status} ${res.statusText}`
    ), res.status !== 206 && assertFullRangeRequest(range, contentLength), await res.body.pipeTo(writable, { preventClose: !0 });
  }
  let writer = writable.getWriter();
  ranges.length > 0 && await writer.write(ENCODER.encode(`\r
`)), await writer.write(ENCODER.encode(`--${boundary}--`)), await writer.close();
}
async function fetchMultipleRanges(fetcher, url, ranges, opts) {
  let res = await fetcher.fetch(url, { method: "HEAD" });
  if (res.status === 404) return null;
  assert(res.ok);
  let contentLength = parseInt(res.headers.get("Content-Length"));
  assert(!Number.isNaN(contentLength));
  let boundary = `miniflare-boundary-${crypto.randomUUID()}`, multipartContentType = `multipart/byteranges; boundary=${boundary}`, { readable, writable } = new IdentityTransformStream();
  return writeMultipleRanges(
    fetcher,
    url,
    ranges,
    boundary,
    writable,
    contentLength,
    opts?.contentType
  ).catch((e) => console.error("Error writing multipart stream:", e)), { multipartContentType, body: readable };
}
async function fetchRange(fetcher, url, range, opts) {
  return Array.isArray(range) ? fetchMultipleRanges(fetcher, url, range, opts) : fetchSingleRange(fetcher, url, range);
}
function generateBlobId() {
  let idBuffer = Buffer2.alloc(40);
  return crypto.getRandomValues(
    new Uint8Array(idBuffer.buffer, idBuffer.byteOffset, 32)
  ), idBuffer.writeBigInt64BE(
    BigInt(performance.timeOrigin + performance.now()),
    32
  ), idBuffer.toString("hex");
}
var BlobStore = class {
  // Database for binary large objects. Provides single and multi-ranged
  // streaming reads and writes.
  //
  // Blobs have unguessable identifiers, can be deleted, but are otherwise
  // immutable. These properties make it possible to perform atomic updates with
  // the SQLite metadata store. No other operations will be able to interact
  // with the blob until it's committed to the metadata store, because they
  // won't be able to guess the ID, and we don't allow listing blobs.
  //
  // For example, if we put a blob in the store, then fail to insert the blob ID
  // into the SQLite database for some reason during a transaction (e.g.
  // `onlyIf` condition failed), no other operations can read that blob because
  // the ID is lost (we'll just background-delete the blob in this case).
  #fetcher;
  #baseURL;
  #stickyBlobs;
  constructor(fetcher, namespace, stickyBlobs) {
    namespace = encodeURIComponent(sanitisePath(namespace)), this.#fetcher = fetcher, this.#baseURL = `http://placeholder/${namespace}/blobs/`, this.#stickyBlobs = stickyBlobs;
  }
  idURL(id) {
    let url = new URL(this.#baseURL + id);
    return url.toString().startsWith(this.#baseURL) ? url : null;
  }
  async get(id, range, opts) {
    let idURL = this.idURL(id);
    return idURL === null ? null : fetchRange(this.#fetcher, idURL, range, opts);
  }
  async put(stream) {
    let id = generateBlobId(), idURL = this.idURL(id);
    return assert(idURL !== null), await this.#fetcher.fetch(idURL, {
      method: "PUT",
      body: stream
    }), id;
  }
  async delete(id) {
    if (this.#stickyBlobs) return;
    let idURL = this.idURL(id);
    if (idURL === null) return;
    let res = await this.#fetcher.fetch(idURL, { method: "DELETE" });
    assert(res.ok || res.status === 404);
  }
};

// src/workers/shared/constants.ts
var SharedHeaders = {
  LOG_LEVEL: "MF-Log-Level"
}, SharedBindings = {
  TEXT_NAMESPACE: "MINIFLARE_NAMESPACE",
  DURABLE_OBJECT_NAMESPACE_OBJECT: "MINIFLARE_OBJECT",
  MAYBE_SERVICE_BLOBS: "MINIFLARE_BLOBS",
  MAYBE_SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK",
  MAYBE_JSON_ENABLE_CONTROL_ENDPOINTS: "MINIFLARE_ENABLE_CONTROL_ENDPOINTS",
  MAYBE_JSON_ENABLE_STICKY_BLOBS: "MINIFLARE_STICKY_BLOBS"
}, LogLevel = /* @__PURE__ */ ((LogLevel3) => (LogLevel3[LogLevel3.NONE = 0] = "NONE", LogLevel3[LogLevel3.ERROR = 1] = "ERROR", LogLevel3[LogLevel3.WARN = 2] = "WARN", LogLevel3[LogLevel3.INFO = 3] = "INFO", LogLevel3[LogLevel3.DEBUG = 4] = "DEBUG", LogLevel3[LogLevel3.VERBOSE = 5] = "VERBOSE", LogLevel3))(LogLevel || {});

// src/workers/shared/keyvalue.worker.ts
import assert3 from "node-internal:internal_assert";

// src/workers/shared/sql.worker.ts
import assert2 from "node-internal:internal_assert";
function isTypedValue(value) {
  return value === null || typeof value == "string" || typeof value == "number" || value instanceof ArrayBuffer;
}
function createStatementFactory(sql) {
  return (query) => {
    let keyIndices = /* @__PURE__ */ new Map();
    query = query.replace(/[:@$]([a-z0-9_]+)/gi, (_, name) => {
      let index = keyIndices.get(name);
      return index === void 0 && (index = keyIndices.size, keyIndices.set(name, index)), `?${index + 1}`;
    });
    let stmt = sql.prepare(query);
    return (argsObject) => {
      let entries = Object.entries(argsObject);
      assert2.strictEqual(
        entries.length,
        keyIndices.size,
        "Expected same number of keys in bindings and query"
      );
      let argsArray = new Array(entries.length);
      for (let [key, value] of entries) {
        let index = keyIndices.get(key);
        assert2(index !== void 0, `Unexpected binding key: ${key}`), argsArray[index] = value;
      }
      return stmt(...argsArray);
    };
  };
}
function createTransactionFactory(storage) {
  return (closure) => (...args) => storage.transactionSync(() => closure(...args));
}
function createTypedSql(storage) {
  let sql = storage.sql;
  return sql.stmt = createStatementFactory(sql), sql.txn = createTransactionFactory(storage), sql;
}
function get(cursor) {
  let result;
  for (let row of cursor) result ??= row;
  return result;
}
function all(cursor) {
  return Array.from(cursor);
}
function drain(cursor) {
  for (let _ of cursor)
    ;
}

// src/workers/shared/keyvalue.worker.ts
var SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS _mf_entries (
  key TEXT PRIMARY KEY,
  blob_id TEXT NOT NULL,
  expiration INTEGER,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS _mf_entries_expiration_idx ON _mf_entries(expiration);
`;
function sqlStmts(db) {
  let stmtGetBlobIdByKey = db.stmt(
    "SELECT blob_id FROM _mf_entries WHERE key = :key"
  ), stmtPut = db.stmt(
    `INSERT OR REPLACE INTO _mf_entries (key, blob_id, expiration, metadata)
    VALUES (:key, :blob_id, :expiration, :metadata)`
  );
  return {
    getByKey: db.prepare(
      "SELECT key, blob_id, expiration, metadata FROM _mf_entries WHERE key = ?1"
    ),
    put: db.txn((newEntry) => {
      let key = newEntry.key, previousEntry = get(stmtGetBlobIdByKey({ key }));
      return stmtPut(newEntry), previousEntry?.blob_id;
    }),
    deleteByKey: db.stmt(
      "DELETE FROM _mf_entries WHERE key = :key RETURNING blob_id, expiration"
    ),
    deleteExpired: db.stmt(
      // `expiration` may be `NULL`, but `NULL < ...` should be falsy
      "DELETE FROM _mf_entries WHERE expiration < :now RETURNING blob_id"
    ),
    list: db.stmt(
      `SELECT key, expiration, metadata FROM _mf_entries
        WHERE substr(key, 1, length(:prefix)) = :prefix
        AND key > :start_after
        AND (expiration IS NULL OR expiration >= :now)
        ORDER BY key LIMIT :limit`
    )
  };
}
function rowEntry(entry) {
  return {
    key: entry.key,
    expiration: entry.expiration ?? void 0,
    metadata: entry.metadata === null ? void 0 : JSON.parse(entry.metadata)
  };
}
var KeyValueStorage = class {
  #stmts;
  #blob;
  #timers;
  constructor(object) {
    object.db.exec("PRAGMA case_sensitive_like = TRUE"), object.db.exec(SQL_SCHEMA), this.#stmts = sqlStmts(object.db), this.#blob = object.blob, this.#timers = object.timers;
  }
  #hasExpired(entry) {
    return entry.expiration !== null && entry.expiration <= this.#timers.now();
  }
  #backgroundDelete(blobId) {
    this.#timers.queueMicrotask(
      () => this.#blob.delete(blobId).catch(() => {
      })
    );
  }
  async get(key, optsFactory) {
    let row = get(this.#stmts.getByKey(key));
    if (row === void 0) return null;
    if (this.#hasExpired(row))
      return drain(this.#stmts.deleteByKey({ key })), this.#backgroundDelete(row.blob_id), null;
    let entry = rowEntry(row), opts = entry.metadata && optsFactory?.(entry.metadata);
    if (opts?.ranges === void 0 || opts.ranges.length <= 1) {
      let value = await this.#blob.get(row.blob_id, opts?.ranges?.[0]);
      return value === null ? null : { ...entry, value };
    } else {
      let value = await this.#blob.get(row.blob_id, opts.ranges, opts);
      return value === null ? null : { ...entry, value };
    }
  }
  async put(entry) {
    assert3(entry.key !== "");
    let blobId = await this.#blob.put(entry.value);
    entry.signal?.aborted && (this.#backgroundDelete(blobId), entry.signal.throwIfAborted());
    let maybeOldBlobId = this.#stmts.put({
      key: entry.key,
      blob_id: blobId,
      expiration: entry.expiration ?? null,
      metadata: entry.metadata === void 0 ? null : JSON.stringify(await entry.metadata)
    });
    maybeOldBlobId !== void 0 && this.#backgroundDelete(maybeOldBlobId);
  }
  async delete(key) {
    let cursor = this.#stmts.deleteByKey({ key }), row = get(cursor);
    return row === void 0 ? !1 : (this.#backgroundDelete(row.blob_id), !this.#hasExpired(row));
  }
  async list(opts) {
    let now = this.#timers.now(), prefix = opts.prefix ?? "", start_after = opts.cursor === void 0 ? "" : base64Decode(opts.cursor), limit = opts.limit + 1, rowsCursor = this.#stmts.list({
      now,
      prefix,
      start_after,
      limit
    }), rows = Array.from(rowsCursor), expiredRows = this.#stmts.deleteExpired({ now });
    for (let row of expiredRows) this.#backgroundDelete(row.blob_id);
    let hasMoreRows = rows.length === opts.limit + 1;
    rows.splice(opts.limit, 1);
    let keys = rows.map((row) => rowEntry(row)), nextCursor = hasMoreRows ? base64Encode(rows[opts.limit - 1].key) : void 0;
    return { keys, cursor: nextCursor };
  }
};

// src/workers/shared/matcher.ts
function testRegExps(matcher, value) {
  for (let exclude of matcher.exclude) if (exclude.test(value)) return !1;
  for (let include of matcher.include) if (include.test(value)) return !0;
  return !1;
}

// src/workers/shared/object.worker.ts
import assert5 from "node-internal:internal_assert";

// src/workers/shared/router.worker.ts
var HttpError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype), this.name = `${new.target.name} [${code}]`;
  }
  toResponse() {
    return new Response(this.message, {
      status: this.code,
      // Custom statusMessage is required for runtime error messages
      statusText: this.message.substring(0, 512)
    });
  }
}, kRoutesTemplate = Symbol("kRoutesTemplate"), Router = class {
  // Routes added by @METHOD decorators
  #routes;
  constructor() {
    this.#routes = new.target.prototype[kRoutesTemplate];
  }
  async fetch(req) {
    let url = new URL(req.url), methodRoutes = this.#routes?.get(req.method);
    if (methodRoutes === void 0) return new Response(null, { status: 405 });
    let handlers = this;
    try {
      for (let [path, key] of methodRoutes) {
        let match = path.exec(url.pathname);
        if (match !== null) return await handlers[key](req, match.groups, url);
      }
      return new Response(null, { status: 404 });
    } catch (e) {
      if (e instanceof HttpError)
        return e.toResponse();
      throw e;
    }
  }
};
function pathToRegexp(path) {
  return path === void 0 ? /^.*$/ : (path.endsWith("/") || (path += "/?"), path = path.replace(/\//g, "\\/"), path = path.replace(/:(\w+)/g, "(?<$1>[^\\/]+)"), new RegExp(`^${path}$`));
}
var createRouteDecorator = (method) => (path) => (prototype, key) => {
  let route = [pathToRegexp(path), key], routes = prototype[kRoutesTemplate] ??= /* @__PURE__ */ new Map(), methodRoutes = routes.get(method);
  methodRoutes ? methodRoutes.push(route) : routes.set(method, [route]);
}, GET = createRouteDecorator("GET"), HEAD = createRouteDecorator("HEAD"), POST = createRouteDecorator("POST"), PUT = createRouteDecorator("PUT"), DELETE = createRouteDecorator("DELETE"), PURGE = createRouteDecorator("PURGE"), PATCH = createRouteDecorator("PATCH");

// src/workers/shared/timers.worker.ts
import assert4 from "node-internal:internal_assert";
var kFakeTimerHandle = Symbol("kFakeTimerHandle"), Timers = class {
  // Fake unix time in milliseconds. If defined, fake timers will be enabled.
  #fakeTimestamp;
  #fakeNextTimerHandle = 0;
  #fakePendingTimeouts = /* @__PURE__ */ new Map();
  #fakeRunningTasks = /* @__PURE__ */ new Set();
  // Timers API
  now = () => this.#fakeTimestamp ?? Date.now();
  setTimeout(closure, delay, ...args) {
    if (this.#fakeTimestamp === void 0)
      return setTimeout(closure, delay, ...args);
    let handle = this.#fakeNextTimerHandle++, argsClosure = () => closure(...args);
    if (delay === 0)
      this.queueMicrotask(argsClosure);
    else {
      let timeout = {
        triggerTimestamp: this.#fakeTimestamp + delay,
        closure: argsClosure
      };
      this.#fakePendingTimeouts.set(handle, timeout);
    }
    return { [kFakeTimerHandle]: handle };
  }
  clearTimeout(handle) {
    if (typeof handle == "number") return clearTimeout(handle);
    this.#fakePendingTimeouts.delete(handle[kFakeTimerHandle]);
  }
  queueMicrotask(closure) {
    if (this.#fakeTimestamp === void 0) return queueMicrotask(closure);
    let result = closure();
    result instanceof Promise && (this.#fakeRunningTasks.add(result), result.finally(() => this.#fakeRunningTasks.delete(result)));
  }
  // Fake Timers Control API
  #runPendingTimeouts() {
    if (this.#fakeTimestamp !== void 0)
      for (let [handle, timeout] of this.#fakePendingTimeouts)
        timeout.triggerTimestamp <= this.#fakeTimestamp && (this.#fakePendingTimeouts.delete(handle), this.queueMicrotask(timeout.closure));
  }
  enableFakeTimers(timestamp) {
    this.#fakeTimestamp = timestamp, this.#runPendingTimeouts();
  }
  disableFakeTimers() {
    this.#fakeTimestamp = void 0, this.#fakePendingTimeouts.clear();
  }
  advanceFakeTime(delta) {
    assert4(
      this.#fakeTimestamp !== void 0,
      "Expected fake timers to be enabled before `advanceFakeTime()` call"
    ), this.#fakeTimestamp += delta, this.#runPendingTimeouts();
  }
  async waitForFakeTasks() {
    for (; this.#fakeRunningTasks.size > 0; )
      await Promise.all(this.#fakeRunningTasks);
  }
};

// src/workers/shared/types.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
function maybeApply(f, maybeValue) {
  return maybeValue === void 0 ? void 0 : f(maybeValue);
}

// src/workers/shared/object.worker.ts
var MiniflareDurableObject = class extends Router {
  constructor(state, env) {
    super();
    this.state = state;
    this.env = env;
  }
  timers = new Timers();
  // If this Durable Object receives a control op, assume it's being tested.
  // We use this to adjust some limits in tests.
  beingTested = !1;
  #db;
  get db() {
    return this.#db ??= createTypedSql(this.state.storage);
  }
  #name;
  get name() {
    return assert5(
      this.#name !== void 0,
      "Expected `MiniflareDurableObject#fetch()` call before `name` access"
    ), this.#name;
  }
  #blob;
  get blob() {
    if (this.#blob !== void 0) return this.#blob;
    let maybeBlobsService = this.env[SharedBindings.MAYBE_SERVICE_BLOBS], stickyBlobs = !!this.env[SharedBindings.MAYBE_JSON_ENABLE_STICKY_BLOBS];
    return assert5(
      maybeBlobsService !== void 0,
      `Expected ${SharedBindings.MAYBE_SERVICE_BLOBS} service binding`
    ), this.#blob = new BlobStore(maybeBlobsService, this.name, stickyBlobs), this.#blob;
  }
  async logWithLevel(level, message) {
    await this.env[SharedBindings.MAYBE_SERVICE_LOOPBACK]?.fetch(
      "http://localhost/core/log",
      {
        method: "POST",
        headers: { [SharedHeaders.LOG_LEVEL]: level.toString() },
        body: message
      }
    );
  }
  async #handleControlOp({
    name,
    args
  }) {
    if (this.beingTested = !0, name === "sqlQuery") {
      assert5(args !== void 0);
      let [query, ...params] = args;
      assert5(typeof query == "string"), assert5(params.every(isTypedValue));
      let results = all(this.db.prepare(query)(...params));
      return Response.json(results);
    } else if (name === "getBlob") {
      assert5(args !== void 0);
      let [id] = args;
      assert5(typeof id == "string");
      let stream = await this.blob.get(id);
      return new Response(stream, { status: stream === null ? 404 : 200 });
    } else {
      let func = this.timers[name];
      assert5(typeof func == "function");
      let result = await func.apply(this.timers, args);
      return Response.json(result ?? null);
    }
  }
  async fetch(req) {
    if (this.env[SharedBindings.MAYBE_JSON_ENABLE_CONTROL_ENDPOINTS] === !0) {
      let controlOp = req?.cf?.miniflare?.controlOp;
      if (controlOp !== void 0) return this.#handleControlOp(controlOp);
    }
    let name = req.cf?.miniflare?.name;
    assert5(name !== void 0, "Expected `cf.miniflare.name`"), this.#name = name;
    try {
      return await super.fetch(req);
    } catch (e) {
      let error = reduceError(e), fallback = error.stack ?? error.message, loopbackService = this.env[SharedBindings.MAYBE_SERVICE_LOOPBACK];
      return loopbackService !== void 0 ? loopbackService.fetch("http://localhost/core/error", {
        method: "POST",
        body: JSON.stringify(error)
      }).catch(() => {
        console.error(fallback);
      }) : console.error(fallback), new Response(fallback, { status: 500 });
    } finally {
      req.body !== null && !req.bodyUsed && await req.body.pipeTo(new WritableStream());
    }
  }
};

// src/workers/shared/range.ts
var rangePrefixRegexp = /^ *bytes *=/i, rangeRegexp = /^ *(?<start>\d+)? *- *(?<end>\d+)? *$/;
function parseRanges(rangeHeader, length) {
  let prefixMatch = rangePrefixRegexp.exec(rangeHeader);
  if (prefixMatch === null) return;
  if (rangeHeader = rangeHeader.substring(prefixMatch[0].length), rangeHeader.trimStart() === "") return [];
  let ranges = rangeHeader.split(","), result = [];
  for (let range of ranges) {
    let match = rangeRegexp.exec(range);
    if (match === null) return;
    let { start, end } = match.groups;
    if (start !== void 0 && end !== void 0) {
      let rangeStart = parseInt(start), rangeEnd = parseInt(end);
      if (rangeStart > rangeEnd || rangeStart >= length) return;
      rangeEnd >= length && (rangeEnd = length - 1), result.push({ start: rangeStart, end: rangeEnd });
    } else if (start !== void 0 && end === void 0) {
      let rangeStart = parseInt(start);
      if (rangeStart >= length) return;
      result.push({ start: rangeStart, end: length - 1 });
    } else if (start === void 0 && end !== void 0) {
      let suffix = parseInt(end);
      if (suffix >= length) return [];
      if (suffix === 0) continue;
      result.push({ start: length - suffix, end: length - 1 });
    } else
      return;
  }
  return result;
}

// src/workers/shared/sync.ts
import assert6 from "node-internal:internal_assert";
var DeferredPromise = class extends Promise {
  resolve;
  reject;
  constructor(executor = () => {
  }) {
    let promiseResolve, promiseReject;
    super((resolve, reject) => (promiseResolve = resolve, promiseReject = reject, executor(resolve, reject))), this.resolve = promiseResolve, this.reject = promiseReject;
  }
}, Mutex = class {
  locked = !1;
  resolveQueue = [];
  drainQueue = [];
  lock() {
    if (!this.locked) {
      this.locked = !0;
      return;
    }
    return new Promise((resolve) => this.resolveQueue.push(resolve));
  }
  unlock() {
    if (assert6(this.locked), this.resolveQueue.length > 0)
      this.resolveQueue.shift()?.();
    else {
      this.locked = !1;
      let resolve;
      for (; (resolve = this.drainQueue.shift()) !== void 0; ) resolve();
    }
  }
  get hasWaiting() {
    return this.resolveQueue.length > 0;
  }
  async runWith(closure) {
    let acquireAwaitable = this.lock();
    acquireAwaitable instanceof Promise && await acquireAwaitable;
    try {
      let awaitable = closure();
      return awaitable instanceof Promise ? await awaitable : awaitable;
    } finally {
      this.unlock();
    }
  }
  async drained() {
    if (!(this.resolveQueue.length === 0 && !this.locked))
      return new Promise((resolve) => this.drainQueue.push(resolve));
  }
}, WaitGroup = class {
  counter = 0;
  resolveQueue = [];
  add() {
    this.counter++;
  }
  done() {
    if (assert6(this.counter > 0), this.counter--, this.counter === 0) {
      let resolve;
      for (; (resolve = this.resolveQueue.shift()) !== void 0; ) resolve();
    }
  }
  wait() {
    return this.counter === 0 ? Promise.resolve() : new Promise((resolve) => this.resolveQueue.push(resolve));
  }
};
export {
  BlobStore,
  DELETE,
  DeferredPromise,
  GET,
  HEAD,
  HttpError,
  KeyValueStorage,
  LogLevel,
  MiniflareDurableObject,
  Mutex,
  PATCH,
  POST,
  PURGE,
  PUT,
  Router,
  SharedBindings,
  SharedHeaders,
  Timers,
  WaitGroup,
  all,
  base64Decode,
  base64Encode,
  drain,
  get,
  maybeApply,
  parseRanges,
  readPrefix,
  reduceError,
  testRegExps,
  viewToBuffer
};
/*! Path sanitisation regexps adapted from node-sanitize-filename:
 * https://github.com/parshap/node-sanitize-filename/blob/209c39b914c8eb48ee27bcbde64b2c7822fdf3de/index.js#L4-L37
 *
 * Licensed under the ISC license:
 *
 * Copyright Parsha Pourkhomami <parshap@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the
 * above copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
 * DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
 * ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
//# sourceMappingURL=index.worker.js.map
