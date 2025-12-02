// src/consts.ts
var HUB_URL = "https://huggingface.co";

// src/error.ts
async function createApiError(response, opts) {
  const error = new HubApiError(response.url, response.status, response.headers.get("X-Request-Id") ?? opts?.requestId);
  error.message = `Api error with status ${error.statusCode}${opts?.message ? `. ${opts.message}` : ""}`;
  const trailer = [`URL: ${error.url}`, error.requestId ? `Request ID: ${error.requestId}` : void 0].filter(Boolean).join(". ");
  if (response.headers.get("Content-Type")?.startsWith("application/json")) {
    const json = await response.json();
    error.message = json.error || json.message || error.message;
    error.data = json;
  } else {
    error.data = { message: await response.text() };
  }
  error.message += `. ${trailer}`;
  throw error;
}
var HubApiError = class extends Error {
  statusCode;
  url;
  requestId;
  data;
  constructor(url, statusCode, requestId, message) {
    super(message);
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.url = url;
  }
};
var InvalidApiResponseFormatError = class extends Error {
};

// src/utils/checkCredentials.ts
function checkCredentials(credentials) {
  if (!credentials || credentials.accessToken === void 0 || credentials.accessToken === null) {
    return;
  }
  if (!credentials.accessToken.startsWith("hf_")) {
    throw new TypeError("Your access token must start with 'hf_'");
  }
}

// src/utils/range.ts
function range(n, b) {
  return b ? Array(b - n).fill(0).map((_, i) => n + i) : Array(n).fill(0).map((_, i) => i);
}

// src/utils/chunk.ts
function chunk(arr, chunkSize) {
  if (isNaN(chunkSize) || chunkSize < 1) {
    throw new RangeError("Invalid chunk size: " + chunkSize);
  }
  if (!arr.length) {
    return [];
  }
  if (arr.length <= chunkSize) {
    return [arr];
  }
  return range(Math.ceil(arr.length / chunkSize)).map((i) => {
    return arr.slice(i * chunkSize, (i + 1) * chunkSize);
  });
}

// src/utils/promisesQueue.ts
async function promisesQueue(factories, concurrency) {
  const results = [];
  const executing = /* @__PURE__ */ new Set();
  let index = 0;
  for (const factory of factories) {
    const closureIndex = index++;
    const e = factory().then((r) => {
      results[closureIndex] = r;
      executing.delete(e);
    });
    executing.add(e);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

// src/utils/promisesQueueStreaming.ts
async function promisesQueueStreaming(factories, concurrency) {
  const executing = [];
  for await (const factory of factories) {
    const e = factory().then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// src/utils/eventToGenerator.ts
async function* eventToGenerator(cb) {
  const promises = [];
  function addPromise() {
    let resolve2;
    let reject;
    const p = new Promise((res, rej) => {
      resolve2 = res;
      reject = rej;
    });
    promises.push({ p, resolve: resolve2, reject });
  }
  addPromise();
  const callbackRes = Promise.resolve().then(
    () => cb(
      (y) => {
        addPromise();
        promises.at(-2)?.resolve({ done: false, value: y });
      },
      (r) => {
        addPromise();
        promises.at(-2)?.resolve({ done: true, value: r });
      },
      (err) => promises.shift()?.reject(err)
    )
  ).catch((err) => promises.shift()?.reject(err));
  while (1) {
    const p = promises[0];
    if (!p) {
      throw new Error("Logic error in eventGenerator, promises should never be empty");
    }
    const result = await p.p;
    promises.shift();
    if (result.done) {
      await callbackRes;
      return result.value;
    }
    yield result.value;
  }
  throw new Error("Unreachable");
}

// src/utils/hexFromBytes.ts
function hexFromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("hex");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(byte.toString(16).padStart(2, "0"));
    });
    return bin.join("");
  }
}

// src/utils/isBackend.ts
var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
var isWebWorker = typeof self === "object" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope";
var isBackend = !isBrowser && !isWebWorker;

// src/utils/isFrontend.ts
var isFrontend = !isBackend;

// src/utils/sha256.ts
async function getWebWorkerCode() {
  const sha256Module = await import("./sha256-wrapper-DYTB3MXW.mjs");
  return URL.createObjectURL(new Blob([sha256Module.createSHA256WorkerCode()]));
}
var pendingWorkers = [];
var runningWorkers = /* @__PURE__ */ new Set();
var resolve;
var waitPromise = new Promise((r) => {
  resolve = r;
});
async function getWorker(poolSize) {
  {
    const worker2 = pendingWorkers.pop();
    if (worker2) {
      runningWorkers.add(worker2);
      return worker2;
    }
  }
  if (!poolSize) {
    const worker2 = new Worker(await getWebWorkerCode());
    runningWorkers.add(worker2);
    return worker2;
  }
  if (poolSize <= 0) {
    throw new TypeError("Invalid webworker pool size: " + poolSize);
  }
  while (runningWorkers.size >= poolSize) {
    await waitPromise;
  }
  const worker = new Worker(await getWebWorkerCode());
  runningWorkers.add(worker);
  return worker;
}
async function freeWorker(worker, poolSize) {
  if (!poolSize) {
    return destroyWorker(worker);
  }
  runningWorkers.delete(worker);
  pendingWorkers.push(worker);
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
function destroyWorker(worker) {
  runningWorkers.delete(worker);
  worker.terminate();
  const r = resolve;
  waitPromise = new Promise((r2) => {
    resolve = r2;
  });
  r();
}
async function* sha256(buffer, opts) {
  yield 0;
  const maxCryptoSize = typeof opts?.useWebWorker === "object" && opts?.useWebWorker.minSize !== void 0 ? opts.useWebWorker.minSize : 1e7;
  if (buffer.size < maxCryptoSize && globalThis.crypto?.subtle) {
    const res = hexFromBytes(
      new Uint8Array(
        await globalThis.crypto.subtle.digest("SHA-256", buffer instanceof Blob ? await buffer.arrayBuffer() : buffer)
      )
    );
    yield 1;
    return res;
  }
  if (isFrontend) {
    if (opts?.useWebWorker) {
      try {
        const poolSize = typeof opts?.useWebWorker === "object" ? opts.useWebWorker.poolSize : void 0;
        const worker = await getWorker(poolSize);
        return yield* eventToGenerator((yieldCallback, returnCallback, rejectCallack) => {
          worker.addEventListener("message", (event) => {
            if (event.data.sha256) {
              freeWorker(worker, poolSize);
              returnCallback(event.data.sha256);
            } else if (event.data.progress) {
              yieldCallback(event.data.progress);
              try {
                opts.abortSignal?.throwIfAborted();
              } catch (err) {
                destroyWorker(worker);
                rejectCallack(err);
              }
            } else {
              destroyWorker(worker);
              rejectCallack(event);
            }
          });
          worker.addEventListener("error", (event) => {
            destroyWorker(worker);
            rejectCallack(event.error);
          });
          worker.postMessage({ file: buffer });
        });
      } catch (err) {
        console.warn("Failed to use web worker for sha256", err);
      }
    }
    if (!wasmModule) {
      wasmModule = await import("./sha256-wrapper-DYTB3MXW.mjs");
    }
    const sha2562 = await wasmModule.createSHA256();
    sha2562.init();
    const reader = buffer.stream().getReader();
    const total = buffer.size;
    let bytesDone = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      sha2562.update(value);
      bytesDone += value.length;
      yield bytesDone / total;
      opts?.abortSignal?.throwIfAborted();
    }
    return sha2562.digest("hex");
  }
  if (!cryptoModule) {
    cryptoModule = await import("./sha256-node-2YU2V4BH.mjs");
  }
  return yield* cryptoModule.sha256Node(buffer, { abortSignal: opts?.abortSignal });
}
var cryptoModule;
var wasmModule;

// src/utils/toRepoId.ts
function toRepoId(repo) {
  if (typeof repo !== "string") {
    return repo;
  }
  if (repo.startsWith("model/") || repo.startsWith("models/")) {
    throw new TypeError(
      "A repo designation for a model should not start with 'models/', directly specify the model namespace / name"
    );
  }
  if (repo.startsWith("space/")) {
    throw new TypeError("Spaces should start with 'spaces/', plural, not 'space/'");
  }
  if (repo.startsWith("dataset/")) {
    throw new TypeError("Datasets should start with 'dataset/', plural, not 'dataset/'");
  }
  const slashes = repo.split("/").length - 1;
  if (repo.startsWith("spaces/")) {
    if (slashes !== 2) {
      throw new TypeError("Space Id must include namespace and name of the space");
    }
    return {
      type: "space",
      name: repo.slice("spaces/".length)
    };
  }
  if (repo.startsWith("datasets/")) {
    if (slashes > 2) {
      throw new TypeError("Too many slashes in repo designation: " + repo);
    }
    return {
      type: "dataset",
      name: repo.slice("datasets/".length)
    };
  }
  if (slashes > 1) {
    throw new TypeError("Too many slashes in repo designation: " + repo);
  }
  return {
    type: "model",
    name: repo
  };
}

// src/utils/WebBlob.ts
var WebBlob = class extends Blob {
  static async create(url, opts) {
    const customFetch = opts?.fetch ?? fetch;
    const response = await customFetch(url, { method: "HEAD" });
    const size = Number(response.headers.get("content-length"));
    const contentType = response.headers.get("content-type") || "";
    const supportRange = response.headers.get("accept-ranges") === "bytes";
    if (!supportRange || size < (opts?.cacheBelow ?? 1e6)) {
      return await (await customFetch(url)).blob();
    }
    return new WebBlob(url, 0, size, contentType, true, customFetch);
  }
  url;
  start;
  end;
  contentType;
  full;
  fetch;
  constructor(url, start, end, contentType, full, customFetch) {
    super([]);
    this.url = url;
    this.start = start;
    this.end = end;
    this.contentType = contentType;
    this.full = full;
    this.fetch = customFetch;
  }
  get size() {
    return this.end - this.start;
  }
  get type() {
    return this.contentType;
  }
  slice(start = 0, end = this.size) {
    if (start < 0 || end < 0) {
      new TypeError("Unsupported negative start/end on FileBlob.slice");
    }
    const slice = new WebBlob(
      this.url,
      this.start + start,
      Math.min(this.start + end, this.end),
      this.contentType,
      start === 0 && end === this.size ? this.full : false,
      this.fetch
    );
    return slice;
  }
  async arrayBuffer() {
    const result = await this.fetchRange();
    return result.arrayBuffer();
  }
  async text() {
    const result = await this.fetchRange();
    return result.text();
  }
  stream() {
    const stream = new TransformStream();
    this.fetchRange().then((response) => response.body?.pipeThrough(stream)).catch((error) => stream.writable.abort(error.message));
    return stream.readable;
  }
  fetchRange() {
    const fetch2 = this.fetch;
    if (this.full) {
      return fetch2(this.url);
    }
    return fetch2(this.url, {
      headers: {
        Range: `bytes=${this.start}-${this.end - 1}`
      }
    });
  }
};

// src/utils/createBlob.ts
async function createBlob(url, opts) {
  if (url.protocol === "http:" || url.protocol === "https:") {
    return WebBlob.create(url, { fetch: opts?.fetch });
  }
  if (isFrontend) {
    throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
  }
  if (url.protocol === "file:") {
    const { FileBlob } = await import("./FileBlob-GRW5ZULE.mjs");
    return FileBlob.create(url);
  }
  throw new TypeError(`Unsupported URL protocol "${url.protocol}"`);
}

// src/utils/base64FromBytes.ts
function base64FromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

// src/lib/commit.ts
var CONCURRENT_SHAS = 5;
var CONCURRENT_LFS_UPLOADS = 5;
var MULTIPART_PARALLEL_UPLOAD = 5;
function isFileOperation(op) {
  const ret = op.operation === "addOrUpdate";
  if (ret && !(op.content instanceof Blob)) {
    throw new TypeError("Precondition failed: op.content should be a Blob");
  }
  return ret;
}
async function* commitIter(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  yield { event: "phase", phase: "preuploading" };
  const lfsShas = /* @__PURE__ */ new Map();
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  if (!abortSignal.throwIfAborted) {
    abortSignal.throwIfAborted = () => {
      if (abortSignal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
    };
  }
  if (params.abortSignal) {
    params.abortSignal.addEventListener("abort", () => abortController.abort());
  }
  try {
    const allOperations = await Promise.all(
      params.operations.map(async (operation) => {
        if (operation.operation !== "addOrUpdate") {
          return operation;
        }
        if (!(operation.content instanceof URL)) {
          return { ...operation, content: operation.content };
        }
        const lazyBlob = await createBlob(operation.content, { fetch: params.fetch });
        abortSignal?.throwIfAborted();
        return {
          ...operation,
          content: lazyBlob
        };
      })
    );
    const gitAttributes = allOperations.filter(isFileOperation).find((op) => op.path === ".gitattributes")?.content;
    for (const operations of chunk(allOperations.filter(isFileOperation), 100)) {
      const payload = {
        gitAttributes: gitAttributes && await gitAttributes.text(),
        files: await Promise.all(
          operations.map(async (operation) => ({
            path: operation.path,
            size: operation.content.size,
            sample: base64FromBytes(new Uint8Array(await operation.content.slice(0, 512).arrayBuffer()))
          }))
        )
      };
      abortSignal?.throwIfAborted();
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/preupload/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      for (const file of json.files) {
        if (file.uploadMode === "lfs") {
          lfsShas.set(file.path, null);
        }
      }
    }
    yield { event: "phase", phase: "uploadingLargeFiles" };
    for (const operations of chunk(
      allOperations.filter(isFileOperation).filter((op) => lfsShas.has(op.path)),
      100
    )) {
      const shas = yield* eventToGenerator((yieldCallback, returnCallback, rejectCallack) => {
        return promisesQueue(
          operations.map((op) => async () => {
            const iterator = sha256(op.content, { useWebWorker: params.useWebWorkers, abortSignal });
            let res2;
            do {
              res2 = await iterator.next();
              if (!res2.done) {
                yieldCallback({ event: "fileProgress", path: op.path, progress: res2.value, state: "hashing" });
              }
            } while (!res2.done);
            const sha = res2.value;
            lfsShas.set(op.path, res2.value);
            return sha;
          }),
          CONCURRENT_SHAS
        ).then(returnCallback, rejectCallack);
      });
      abortSignal?.throwIfAborted();
      const payload = {
        operation: "upload",
        // multipart is a custom protocol for HF
        transfers: ["basic", "multipart"],
        hash_algo: "sha_256",
        ...!params.isPullRequest && {
          ref: {
            name: params.branch ?? "main"
          }
        },
        objects: operations.map((op, i) => ({
          oid: shas[i],
          size: op.content.size
        }))
      };
      const res = await (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/${repoId.type === "model" ? "" : repoId.type + "s/"}${repoId.name}.git/info/lfs/objects/batch`,
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            Accept: "application/vnd.git-lfs+json",
            "Content-Type": "application/vnd.git-lfs+json"
          },
          body: JSON.stringify(payload),
          signal: abortSignal
        }
      );
      if (!res.ok) {
        throw await createApiError(res);
      }
      const json = await res.json();
      const batchRequestId = res.headers.get("X-Request-Id") || void 0;
      const shaToOperation = new Map(operations.map((op, i) => [shas[i], op]));
      yield* eventToGenerator((yieldCallback, returnCallback, rejectCallback) => {
        return promisesQueueStreaming(
          json.objects.map((obj) => async () => {
            const op = shaToOperation.get(obj.oid);
            if (!op) {
              throw new InvalidApiResponseFormatError("Unrequested object ID in response");
            }
            abortSignal?.throwIfAborted();
            if (obj.error) {
              const errorMessage = `Error while doing LFS batch call for ${operations[shas.indexOf(obj.oid)].path}: ${obj.error.message}${batchRequestId ? ` - Request ID: ${batchRequestId}` : ""}`;
              throw new HubApiError(res.url, obj.error.code, batchRequestId, errorMessage);
            }
            if (!obj.actions?.upload) {
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
              return;
            }
            yieldCallback({
              event: "fileProgress",
              path: op.path,
              progress: 0,
              state: "uploading"
            });
            const content = op.content;
            const header = obj.actions.upload.header;
            if (header?.chunk_size) {
              const chunkSize = parseInt(header.chunk_size);
              const completionUrl = obj.actions.upload.href;
              const parts = Object.keys(header).filter((key) => /^[0-9]+$/.test(key));
              if (parts.length !== Math.ceil(content.size / chunkSize)) {
                throw new Error("Invalid server response to upload large LFS file, wrong number of parts");
              }
              const completeReq = {
                oid: obj.oid,
                parts: parts.map((part) => ({
                  partNumber: +part,
                  etag: ""
                }))
              };
              const progressCallback = (progress) => yieldCallback({ event: "fileProgress", path: op.path, progress, state: "uploading" });
              await promisesQueueStreaming(
                parts.map((part) => async () => {
                  abortSignal?.throwIfAborted();
                  const index = parseInt(part) - 1;
                  const slice = content.slice(index * chunkSize, (index + 1) * chunkSize);
                  const res3 = await (params.fetch ?? fetch)(header[part], {
                    method: "PUT",
                    /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                    body: slice instanceof WebBlob && isFrontend ? await slice.arrayBuffer() : slice,
                    signal: abortSignal,
                    ...{
                      progressHint: {
                        path: op.path,
                        part: index,
                        numParts: parts.length,
                        progressCallback
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    }
                  });
                  if (!res3.ok) {
                    throw await createApiError(res3, {
                      requestId: batchRequestId,
                      message: `Error while uploading part ${part} of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                    });
                  }
                  const eTag = res3.headers.get("ETag");
                  if (!eTag) {
                    throw new Error("Cannot get ETag of part during multipart upload");
                  }
                  completeReq.parts[Number(part) - 1].etag = eTag;
                }),
                MULTIPART_PARALLEL_UPLOAD
              );
              abortSignal?.throwIfAborted();
              const res2 = await (params.fetch ?? fetch)(completionUrl, {
                method: "POST",
                body: JSON.stringify(completeReq),
                headers: {
                  Accept: "application/vnd.git-lfs+json",
                  "Content-Type": "application/vnd.git-lfs+json"
                },
                signal: abortSignal
              });
              if (!res2.ok) {
                throw await createApiError(res2, {
                  requestId: batchRequestId,
                  message: `Error completing multipart upload of ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                });
              }
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
            } else {
              const res2 = await (params.fetch ?? fetch)(obj.actions.upload.href, {
                method: "PUT",
                headers: {
                  ...batchRequestId ? { "X-Request-Id": batchRequestId } : void 0
                },
                /** Unfortunately, browsers don't support our inherited version of Blob in fetch calls */
                body: content instanceof WebBlob && isFrontend ? await content.arrayBuffer() : content,
                signal: abortSignal,
                ...{
                  progressHint: {
                    path: op.path,
                    progressCallback: (progress) => yieldCallback({
                      event: "fileProgress",
                      path: op.path,
                      progress,
                      state: "uploading"
                    })
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }
              });
              if (!res2.ok) {
                throw await createApiError(res2, {
                  requestId: batchRequestId,
                  message: `Error while uploading ${operations[shas.indexOf(obj.oid)].path} to LFS storage`
                });
              }
              yieldCallback({
                event: "fileProgress",
                path: op.path,
                progress: 1,
                state: "uploading"
              });
            }
          }),
          CONCURRENT_LFS_UPLOADS
        ).then(returnCallback, rejectCallback);
      });
    }
    abortSignal?.throwIfAborted();
    yield { event: "phase", phase: "committing" };
    return yield* eventToGenerator(
      async (yieldCallback, returnCallback, rejectCallback) => (params.fetch ?? fetch)(
        `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commit/${encodeURIComponent(
          params.branch ?? "main"
        )}` + (params.isPullRequest ? "?create_pr=1" : ""),
        {
          method: "POST",
          headers: {
            ...params.credentials && { Authorization: `Bearer ${params.credentials.accessToken}` },
            "Content-Type": "application/x-ndjson"
          },
          body: [
            {
              key: "header",
              value: {
                summary: params.title,
                description: params.description,
                parentCommit: params.parentCommit
              }
            },
            ...await Promise.all(
              allOperations.map((operation) => {
                if (isFileOperation(operation)) {
                  const sha = lfsShas.get(operation.path);
                  if (sha) {
                    return {
                      key: "lfsFile",
                      value: {
                        path: operation.path,
                        algo: "sha256",
                        size: operation.content.size,
                        oid: sha
                      }
                    };
                  }
                }
                return convertOperationToNdJson(operation);
              })
            )
          ].map((x) => JSON.stringify(x)).join("\n"),
          signal: abortSignal,
          ...{
            progressHint: {
              progressCallback: (progress) => {
                for (const op of allOperations) {
                  if (isFileOperation(op) && !lfsShas.has(op.path)) {
                    yieldCallback({
                      event: "fileProgress",
                      path: op.path,
                      progress,
                      state: "uploading"
                    });
                  }
                }
              }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }
        }
      ).then(async (res) => {
        if (!res.ok) {
          throw await createApiError(res);
        }
        const json = await res.json();
        returnCallback({
          pullRequestUrl: json.pullRequestUrl,
          commit: {
            oid: json.commitOid,
            url: json.commitUrl
          },
          hookOutput: json.hookOutput
        });
      }).catch(rejectCallback)
    );
  } catch (err) {
    abortController.abort();
    throw err;
  }
}
async function commit(params) {
  const iterator = commitIter(params);
  let res = await iterator.next();
  while (!res.done) {
    res = await iterator.next();
  }
  return res.value;
}
async function convertOperationToNdJson(operation) {
  switch (operation.operation) {
    case "addOrUpdate": {
      return {
        key: "file",
        value: {
          content: base64FromBytes(new Uint8Array(await operation.content.arrayBuffer())),
          path: operation.path,
          encoding: "base64"
        }
      };
    }
    case "delete": {
      return {
        key: "deletedFile",
        value: {
          path: operation.path
        }
      };
    }
    default:
      throw new TypeError("Unknown operation: " + operation.operation);
  }
}

// src/lib/count-commits.ts
async function countCommits(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=1`;
  const res = await (params.fetch ?? fetch)(url, {
    headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  return parseInt(res.headers.get("x-total-count") ?? "0", 10);
}

// src/lib/create-repo.ts
async function createRepo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  if (!namespace || !repoName) {
    throw new TypeError(
      `"${repoId.name}" is not a fully qualified repo name. It should be of the form "{namespace}/{repoName}".`
    );
  }
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/create`, {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      private: params.private,
      organization: namespace,
      license: params.license,
      ...repoId.type === "space" ? {
        type: "space",
        sdk: "static"
      } : {
        type: repoId.type
      },
      files: params.files ? await Promise.all(
        params.files.map(async (file) => ({
          encoding: "base64",
          path: file.path,
          content: base64FromBytes(
            new Uint8Array(file.content instanceof Blob ? await file.content.arrayBuffer() : file.content)
          )
        }))
      ) : void 0
    }),
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const output = await res.json();
  return { repoUrl: output.url };
}

// src/lib/delete-file.ts
function deleteFile(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: [
      {
        operation: "delete",
        path: params.path
      }
    ],
    title: params.commitTitle ?? `Delete ${params.path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
}

// src/lib/delete-files.ts
function deleteFiles(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.paths.map((path) => ({
      operation: "delete",
      path
    })),
    title: params.commitTitle ?? `Deletes ${params.paths.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch
  });
}

// src/lib/delete-repo.ts
async function deleteRepo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const [namespace, repoName] = repoId.name.split("/");
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/delete`, {
    method: "DELETE",
    body: JSON.stringify({
      name: repoName,
      organization: namespace,
      type: repoId.type
    }),
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
}

// src/lib/download-file.ts
async function downloadFile(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const url = `${params.hubUrl ?? HUB_URL}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${params.raw ? "raw" : "resolve"}/${encodeURIComponent(params.revision ?? "main")}/${params.path}`;
  const resp = await (params.fetch ?? fetch)(url, {
    headers: {
      ...params.credentials ? {
        Authorization: `Bearer ${params.credentials.accessToken}`
      } : {},
      ...params.range ? {
        Range: `bytes=${params.range[0]}-${params.range[1]}`
      } : {}
    }
  });
  if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
    return null;
  } else if (!resp.ok) {
    throw await createApiError(resp);
  }
  return resp;
}

// src/lib/file-download-info.ts
async function fileDownloadInfo(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${params.raw ? "raw" : "resolve"}/${encodeURIComponent(params.revision ?? "main")}/${params.path}` + (params.noContentDisposition ? "?noContentDisposition=1" : "");
  const resp = await (params.fetch ?? fetch)(url, {
    method: "GET",
    headers: {
      ...params.credentials && {
        Authorization: `Bearer ${params.credentials.accessToken}`
      },
      Range: "bytes=0-0"
    }
  });
  if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
    return null;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  const etag = resp.headers.get("ETag");
  if (!etag) {
    throw new InvalidApiResponseFormatError("Expected ETag");
  }
  const contentRangeHeader = resp.headers.get("content-range");
  if (!contentRangeHeader) {
    throw new InvalidApiResponseFormatError("Expected size information");
  }
  const [, parsedSize] = contentRangeHeader.split("/");
  const size = parseInt(parsedSize);
  if (isNaN(size)) {
    throw new InvalidApiResponseFormatError("Invalid file size received");
  }
  return {
    etag,
    size,
    downloadLink: new URL(resp.url).hostname !== new URL(hubUrl).hostname ? resp.url : null
  };
}

// src/lib/file-exists.ts
async function fileExists(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  const hubUrl = params.hubUrl ?? HUB_URL;
  const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/raw/${encodeURIComponent(
    params.revision ?? "main"
  )}/${params.path}`;
  const resp = await (params.fetch ?? fetch)(url, {
    method: "HEAD",
    headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
  });
  if (resp.status === 404) {
    return false;
  }
  if (!resp.ok) {
    throw await createApiError(resp);
  }
  return true;
}

// src/utils/parseLinkHeader.ts
function parseLinkHeader(header) {
  const regex = /<(https?:[/][/][^>]+)>;\s+rel="([^"]+)"/g;
  return Object.fromEntries([...header.matchAll(regex)].map(([, url, rel]) => [rel, url]));
}

// src/lib/list-commits.ts
async function* listCommits(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${params.revision ?? "main"}?limit=${params.batchSize ?? 100}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : {}
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const resJson = await res.json();
    for (const commit2 of resJson) {
      yield {
        oid: commit2.id,
        title: commit2.title,
        message: commit2.message,
        authors: commit2.authors.map((author) => ({
          username: author.user,
          avatarUrl: author.avatar
        })),
        date: new Date(commit2.date)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/utils/pick.ts
function pick(o, props) {
  return Object.assign(
    {},
    ...props.map((prop) => {
      if (o[prop] !== void 0) {
        return { [prop]: o[prop] };
      }
    })
  );
}

// src/lib/list-datasets.ts
var EXPAND_KEYS = [
  "private",
  "downloads",
  "gated",
  "likes",
  "lastModified"
];
async function* listDatasets(params) {
  checkCredentials(params?.credentials);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...EXPAND_KEYS.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/datasets` + (search ? "?" + search : "");
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        downloads: item.downloads,
        likes: item.likes,
        gated: item.gated,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-files.ts
async function* listFiles(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  let url = `${params.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}/tree/${params.revision || "main"}${params.path ? "/" + params.path : ""}?recursive=${!!params.recursive}&expand=${!!params.expand}`;
  while (url) {
    const res = await (params.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield item;
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-models.ts
var EXPAND_KEYS2 = [
  "pipeline_tag",
  "private",
  "gated",
  "downloads",
  "likes",
  "lastModified"
];
async function* listModels(params) {
  checkCredentials(params?.credentials);
  let totalToFetch = params?.limit ?? Infinity;
  const search = new URLSearchParams([
    ...Object.entries({
      limit: String(Math.min(totalToFetch, 500)),
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.task ? { pipeline_tag: params.search.task } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...EXPAND_KEYS2.map((val) => ["expand", val]),
    ...params?.additionalFields?.map((val) => ["expand", val]) ?? []
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/models?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        private: item.private,
        task: item.pipeline_tag,
        downloads: item.downloads,
        gated: item.gated,
        likes: item.likes,
        updatedAt: new Date(item.lastModified)
      };
      totalToFetch--;
      if (totalToFetch <= 0) {
        return;
      }
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/list-spaces.ts
var EXPAND_KEYS3 = ["sdk", "likes", "private", "lastModified"];
async function* listSpaces(params) {
  checkCredentials(params?.credentials);
  const search = new URLSearchParams([
    ...Object.entries({
      limit: "500",
      ...params?.search?.owner ? { author: params.search.owner } : void 0,
      ...params?.search?.query ? { search: params.search.query } : void 0
    }),
    ...params?.search?.tags?.map((tag) => ["filter", tag]) ?? [],
    ...[...EXPAND_KEYS3, ...params?.additionalFields ?? []].map((val) => ["expand", val])
  ]).toString();
  let url = `${params?.hubUrl || HUB_URL}/api/spaces?${search}`;
  while (url) {
    const res = await (params?.fetch ?? fetch)(url, {
      headers: {
        accept: "application/json",
        ...params?.credentials ? { Authorization: `Bearer ${params.credentials.accessToken}` } : void 0
      }
    });
    if (!res.ok) {
      throw await createApiError(res);
    }
    const items = await res.json();
    for (const item of items) {
      yield {
        ...params?.additionalFields && pick(item, params.additionalFields),
        id: item._id,
        name: item.id,
        sdk: item.sdk,
        likes: item.likes,
        private: item.private,
        updatedAt: new Date(item.lastModified)
      };
    }
    const linkHeader = res.headers.get("Link");
    url = linkHeader ? parseLinkHeader(linkHeader).next : void 0;
  }
}

// src/lib/oauth-handle-redirect.ts
async function oauthHandleRedirect(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthHandleRedirect is only available in the browser");
  }
  const searchParams = new URLSearchParams(window.location.search);
  const [error, errorDescription] = [searchParams.get("error"), searchParams.get("error_description")];
  if (error) {
    throw new Error(`${error}: ${errorDescription}`);
  }
  const code = searchParams.get("code");
  const nonce = localStorage.getItem("huggingface.co:oauth:nonce");
  if (!code) {
    throw new Error("Missing oauth code from query parameters in redirected URL");
  }
  if (!nonce) {
    throw new Error("Missing oauth nonce from localStorage");
  }
  const codeVerifier = localStorage.getItem("huggingface.co:oauth:code_verifier");
  if (!codeVerifier) {
    throw new Error("Missing oauth code_verifier from localStorage");
  }
  const state = searchParams.get("state");
  if (!state) {
    throw new Error("Missing oauth state from query parameters in redirected URL");
  }
  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch {
    throw new Error("Invalid oauth state in redirected URL, unable to parse JSON: " + state);
  }
  if (parsedState.nonce !== nonce) {
    throw new Error("Invalid oauth state in redirected URL");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const tokenRes = await fetch(opendidConfig.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: parsedState.redirectUri,
      code_verifier: codeVerifier
    }).toString()
  });
  localStorage.removeItem("huggingface.co:oauth:code_verifier");
  localStorage.removeItem("huggingface.co:oauth:nonce");
  if (!tokenRes.ok) {
    throw await createApiError(tokenRes);
  }
  const token = await tokenRes.json();
  const accessTokenExpiresAt = new Date(Date.now() + token.expires_in * 1e3);
  const userInfoRes = await fetch(opendidConfig.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });
  if (!userInfoRes.ok) {
    throw await createApiError(userInfoRes);
  }
  const userInfo = await userInfoRes.json();
  return {
    accessToken: token.access_token,
    accessTokenExpiresAt,
    userInfo: {
      id: userInfo.sub,
      name: userInfo.name,
      fullname: userInfo.preferred_username,
      email: userInfo.email,
      emailVerified: userInfo.email_verified,
      avatarUrl: userInfo.picture,
      websiteUrl: userInfo.website,
      isPro: userInfo.isPro,
      orgs: userInfo.orgs?.map((org) => ({
        id: org.sub,
        name: org.name,
        fullname: org.name,
        isEnterprise: org.isEnterprise,
        canPay: org.canPay,
        avatarUrl: org.picture,
        roleInOrg: org.roleInOrg
      })) ?? []
    },
    state: parsedState.state,
    scope: token.scope
  };
}
async function oauthHandleRedirectIfPresent(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthHandleRedirect is only available in the browser");
  }
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("error")) {
    return oauthHandleRedirect(opts);
  }
  if (searchParams.has("code")) {
    if (!localStorage.getItem("huggingface.co:oauth:nonce")) {
      console.warn(
        "Missing oauth nonce from localStorage. This can happen when the user refreshes the page after logging in, without changing the URL."
      );
      return false;
    }
    return oauthHandleRedirect(opts);
  }
  return false;
}

// src/lib/oauth-login-url.ts
async function oauthLoginUrl(opts) {
  if (typeof window === "undefined") {
    throw new Error("oauthLogin is only available in the browser");
  }
  const hubUrl = opts?.hubUrl || HUB_URL;
  const openidConfigUrl = `${new URL(hubUrl).origin}/.well-known/openid-configuration`;
  const openidConfigRes = await fetch(openidConfigUrl, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!openidConfigRes.ok) {
    throw await createApiError(openidConfigRes);
  }
  const opendidConfig = await openidConfigRes.json();
  const newNonce = globalThis.crypto.randomUUID();
  const newCodeVerifier = globalThis.crypto.randomUUID() + globalThis.crypto.randomUUID();
  localStorage.setItem("huggingface.co:oauth:nonce", newNonce);
  localStorage.setItem("huggingface.co:oauth:code_verifier", newCodeVerifier);
  const redirectUri = opts?.redirectUrl || window.location.href;
  const state = JSON.stringify({
    nonce: newNonce,
    redirectUri,
    state: opts?.state
  });
  const variables = window?.huggingface?.variables ?? null;
  const clientId = opts?.clientId || variables?.OAUTH_CLIENT_ID;
  if (!clientId) {
    if (variables) {
      throw new Error("Missing clientId, please add hf_oauth: true to the README.md's metadata in your static Space");
    }
    throw new Error("Missing clientId");
  }
  const challenge = base64FromBytes(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(newCodeVerifier)))
  ).replace(/[+]/g, "-").replace(/[/]/g, "_").replace(/=/g, "");
  return `${opendidConfig.authorization_endpoint}?${new URLSearchParams({
    client_id: clientId,
    scope: opts?.scopes || variables?.OAUTH_SCOPES || "openid profile",
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString()}`;
}

// src/utils/typedInclude.ts
function typedInclude(arr, v) {
  return arr.includes(v);
}

// src/utils/omit.ts
function omit(o, props) {
  const propsArr = Array.isArray(props) ? props : [props];
  const letsKeep = Object.keys(o).filter((prop) => !typedInclude(propsArr, prop));
  return pick(o, letsKeep);
}

// src/utils/typedEntries.ts
function typedEntries(obj) {
  return Object.entries(obj);
}

// src/lib/parse-safetensors-metadata.ts
var SAFETENSORS_FILE = "model.safetensors";
var SAFETENSORS_INDEX_FILE = "model.safetensors.index.json";
var RE_SAFETENSORS_FILE = /\.safetensors$/;
var RE_SAFETENSORS_INDEX_FILE = /\.safetensors\.index\.json$/;
var RE_SAFETENSORS_SHARD_FILE = /^(?<prefix>(?<basePrefix>.*?)[_-])(?<shard>\d{5})-of-(?<total>\d{5})\.safetensors$/;
function parseSafetensorsShardFilename(filename) {
  const match = RE_SAFETENSORS_SHARD_FILE.exec(filename);
  if (match && match.groups) {
    return {
      prefix: match.groups["prefix"],
      basePrefix: match.groups["basePrefix"],
      shard: match.groups["shard"],
      total: match.groups["total"]
    };
  }
  return null;
}
var PARALLEL_DOWNLOADS = 20;
var MAX_HEADER_LENGTH = 25e6;
var SafetensorParseError = class extends Error {
};
async function parseSingleFile(path, params) {
  const firstResp = await downloadFile({
    ...params,
    path,
    range: [0, 7]
  });
  if (!firstResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header length.`);
  }
  const bufLengthOfHeaderLE = await firstResp.arrayBuffer();
  const lengthOfHeader = new DataView(bufLengthOfHeaderLE).getBigUint64(0, true);
  if (lengthOfHeader <= 0) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is malformed.`);
  }
  if (lengthOfHeader > MAX_HEADER_LENGTH) {
    throw new SafetensorParseError(
      `Failed to parse file ${path}: safetensor header is too big. Maximum supported size is ${MAX_HEADER_LENGTH} bytes.`
    );
  }
  const secondResp = await downloadFile({ ...params, path, range: [8, 7 + Number(lengthOfHeader)] });
  if (!secondResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors header.`);
  }
  try {
    const header = await secondResp.json();
    return header;
  } catch (err) {
    throw new SafetensorParseError(`Failed to parse file ${path}: safetensors header is not valid JSON.`);
  }
}
async function parseShardedIndex(path, params) {
  const indexResp = await downloadFile({
    ...params,
    path,
    range: [0, 1e7]
  });
  if (!indexResp) {
    throw new SafetensorParseError(`Failed to parse file ${path}: failed to fetch safetensors index.`);
  }
  let index;
  try {
    index = await indexResp.json();
  } catch (error) {
    throw new SafetensorParseError(`Failed to parse file ${path}: not a valid JSON.`);
  }
  const pathPrefix = path.slice(0, path.lastIndexOf("/") + 1);
  const filenames = [...new Set(Object.values(index.weight_map))];
  const shardedMap = Object.fromEntries(
    await promisesQueue(
      filenames.map(
        (filename) => async () => [filename, await parseSingleFile(pathPrefix + filename, params)]
      ),
      PARALLEL_DOWNLOADS
    )
  );
  return { index, headers: shardedMap };
}
async function parseSafetensorsMetadata(params) {
  checkCredentials(params.credentials);
  const repoId = toRepoId(params.repo);
  if (repoId.type !== "model") {
    throw new TypeError("Only model repos should contain safetensors files.");
  }
  if (RE_SAFETENSORS_FILE.test(params.path ?? "") || await fileExists({ ...params, path: SAFETENSORS_FILE })) {
    const header = await parseSingleFile(params.path ?? SAFETENSORS_FILE, params);
    return {
      sharded: false,
      header,
      ...params.computeParametersCount && {
        parameterCount: computeNumOfParamsByDtypeSingleFile(header)
      }
    };
  } else if (RE_SAFETENSORS_INDEX_FILE.test(params.path ?? "") || await fileExists({ ...params, path: SAFETENSORS_INDEX_FILE })) {
    const { index, headers } = await parseShardedIndex(params.path ?? SAFETENSORS_INDEX_FILE, params);
    return {
      sharded: true,
      index,
      headers,
      ...params.computeParametersCount && {
        parameterCount: computeNumOfParamsByDtypeSharded(headers)
      }
    };
  } else {
    throw new Error("model id does not seem to contain safetensors weights");
  }
}
function computeNumOfParamsByDtypeSingleFile(header) {
  const counter = {};
  const tensors = omit(header, "__metadata__");
  for (const [, v] of typedEntries(tensors)) {
    if (v.shape.length === 0) {
      continue;
    }
    counter[v.dtype] = (counter[v.dtype] ?? 0) + v.shape.reduce((a, b) => a * b);
  }
  return counter;
}
function computeNumOfParamsByDtypeSharded(shardedMap) {
  const counter = {};
  for (const header of Object.values(shardedMap)) {
    for (const [k, v] of typedEntries(computeNumOfParamsByDtypeSingleFile(header))) {
      counter[k] = (counter[k] ?? 0) + (v ?? 0);
    }
  }
  return counter;
}

// src/lib/upload-file.ts
function uploadFile(params) {
  const path = params.file instanceof URL ? params.file.pathname.split("/").at(-1) ?? "file" : "path" in params.file ? params.file.path : params.file.name;
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: [
      {
        operation: "addOrUpdate",
        path,
        content: "content" in params.file ? params.file.content : params.file
      }
    ],
    title: params.commitTitle ?? `Add ${path}`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal
  });
}

// src/lib/upload-files.ts
function uploadFiles(params) {
  return commit({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.files.map((file) => ({
      operation: "addOrUpdate",
      path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
      content: "content" in file ? file.content : file
    })),
    title: params.commitTitle ?? `Add ${params.files.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    fetch: params.fetch,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal
  });
}

// src/lib/upload-files-with-progress.ts
var multipartUploadTracking = /* @__PURE__ */ new WeakMap();
async function* uploadFilesWithProgress(params) {
  return yield* commitIter({
    credentials: params.credentials,
    repo: params.repo,
    operations: params.files.map((file) => ({
      operation: "addOrUpdate",
      path: file instanceof URL ? file.pathname.split("/").at(-1) ?? "file" : "path" in file ? file.path : file.name,
      content: "content" in file ? file.content : file
    })),
    title: params.commitTitle ?? `Add ${params.files.length} files`,
    description: params.commitDescription,
    hubUrl: params.hubUrl,
    branch: params.branch,
    isPullRequest: params.isPullRequest,
    parentCommit: params.parentCommit,
    useWebWorkers: params.useWebWorkers,
    abortSignal: params.abortSignal,
    fetch: async (input, init) => {
      if (!init) {
        return fetch(input);
      }
      if (!typedInclude(["PUT", "POST"], init.method) || !("progressHint" in init) || !init.progressHint || typeof XMLHttpRequest === "undefined" || typeof input !== "string" || !(init.body instanceof ArrayBuffer) && !(init.body instanceof Blob) && !(init.body instanceof File) && typeof init.body !== "string") {
        return fetch(input, init);
      }
      const progressHint = init.progressHint;
      const progressCallback = progressHint.progressCallback;
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          if (progressHint.part !== void 0) {
            let tracking = multipartUploadTracking.get(progressCallback);
            if (!tracking) {
              tracking = { numParts: progressHint.numParts, partsProgress: {} };
              multipartUploadTracking.set(progressCallback, tracking);
            }
            tracking.partsProgress[progressHint.part] = event.loaded / event.total;
            let totalProgress = 0;
            for (const partProgress of Object.values(tracking.partsProgress)) {
              totalProgress += partProgress;
            }
            if (totalProgress === tracking.numParts) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(totalProgress / tracking.numParts);
            }
          } else {
            if (event.loaded === event.total) {
              progressCallback(0.9999999999);
            } else {
              progressCallback(event.loaded / event.total);
            }
          }
        }
      });
      xhr.open(init.method, input, true);
      if (init.headers) {
        const headers = new Headers(init.headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
      }
      init.signal?.throwIfAborted();
      xhr.send(init.body);
      return new Promise((resolve2, reject) => {
        xhr.addEventListener("load", () => {
          resolve2(
            new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: Object.fromEntries(
                xhr.getAllResponseHeaders().trim().split("\n").map((header) => [header.slice(0, header.indexOf(":")), header.slice(header.indexOf(":") + 1).trim()])
              )
            })
          );
        });
        xhr.addEventListener("error", () => {
          reject(new Error(xhr.statusText));
        });
        if (init.signal) {
          init.signal.addEventListener("abort", () => {
            xhr.abort();
            try {
              init.signal?.throwIfAborted();
            } catch (err) {
              reject(err);
            }
          });
        }
      });
    }
  });
}

// src/lib/who-am-i.ts
async function whoAmI(params) {
  checkCredentials(params.credentials);
  const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/whoami-v2`, {
    headers: {
      Authorization: `Bearer ${params.credentials.accessToken}`
    }
  });
  if (!res.ok) {
    throw await createApiError(res);
  }
  const response = await res.json();
  if (typeof response.auth.accessToken?.createdAt === "string") {
    response.auth.accessToken.createdAt = new Date(response.auth.accessToken.createdAt);
  }
  return response;
}
export {
  HubApiError,
  InvalidApiResponseFormatError,
  RE_SAFETENSORS_FILE,
  RE_SAFETENSORS_INDEX_FILE,
  RE_SAFETENSORS_SHARD_FILE,
  SAFETENSORS_FILE,
  SAFETENSORS_INDEX_FILE,
  sha256 as __internal_sha256,
  commit,
  commitIter,
  countCommits,
  createRepo,
  deleteFile,
  deleteFiles,
  deleteRepo,
  downloadFile,
  fileDownloadInfo,
  fileExists,
  listCommits,
  listDatasets,
  listFiles,
  listModels,
  listSpaces,
  oauthHandleRedirect,
  oauthHandleRedirectIfPresent,
  oauthLoginUrl,
  parseSafetensorsMetadata,
  parseSafetensorsShardFilename,
  uploadFile,
  uploadFiles,
  uploadFilesWithProgress,
  whoAmI
};
