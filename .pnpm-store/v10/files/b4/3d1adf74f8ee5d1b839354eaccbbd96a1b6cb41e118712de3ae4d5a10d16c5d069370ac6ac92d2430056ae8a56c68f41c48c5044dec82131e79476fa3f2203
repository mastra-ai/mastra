var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  for (var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target, i = decorators.length - 1, decorator; i >= 0; i--)
    (decorator = decorators[i]) && (result = (kind ? decorator(target, key, result) : decorator(result)) || result);
  return kind && result && __defProp(target, key, result), result;
};

// src/workers/r2/bucket.worker.ts
import assert2 from "node:assert";
import { Buffer as Buffer3 } from "node:buffer";
import { createHash } from "node:crypto";
import {
  all,
  base64Decode,
  base64Encode,
  DeferredPromise,
  GET,
  get,
  maybeApply,
  MiniflareDurableObject,
  PUT,
  readPrefix,
  WaitGroup
} from "miniflare:shared";

// src/workers/r2/constants.ts
var R2Limits = {
  MAX_LIST_KEYS: 1e3,
  MAX_KEY_SIZE: 1024,
  // https://developers.cloudflare.com/r2/platform/limits/
  MAX_VALUE_SIZE: 5363466240,
  // 5 GiB - 5 MiB
  MAX_METADATA_SIZE: 2048,
  // 2048 B
  MIN_MULTIPART_PART_SIZE: 5242880,
  MIN_MULTIPART_PART_SIZE_TEST: 50
}, R2Headers = {
  ERROR: "cf-r2-error",
  REQUEST: "cf-r2-request",
  METADATA_SIZE: "cf-r2-metadata-size"
};

// src/workers/r2/errors.worker.ts
import { HttpError } from "miniflare:shared";
var R2ErrorCode = {
  INTERNAL_ERROR: 10001,
  NO_SUCH_OBJECT_KEY: 10007,
  ENTITY_TOO_LARGE: 100100,
  ENTITY_TOO_SMALL: 10011,
  METADATA_TOO_LARGE: 10012,
  INVALID_OBJECT_NAME: 10020,
  INVALID_MAX_KEYS: 10022,
  NO_SUCH_UPLOAD: 10024,
  INVALID_PART: 10025,
  INVALID_ARGUMENT: 10029,
  PRECONDITION_FAILED: 10031,
  BAD_DIGEST: 10037,
  INVALID_RANGE: 10039,
  BAD_UPLOAD: 10048
}, R2Error = class extends HttpError {
  constructor(code, message, v4Code) {
    super(code, message);
    this.v4Code = v4Code;
  }
  object;
  toResponse() {
    if (this.object !== void 0) {
      let { metadataSize, value } = this.object.encode();
      return new Response(value, {
        status: this.code,
        headers: {
          [R2Headers.METADATA_SIZE]: `${metadataSize}`,
          "Content-Type": "application/json",
          [R2Headers.ERROR]: JSON.stringify({
            message: this.message,
            version: 1,
            // Note the lowercase 'c', which the runtime expects
            v4code: this.v4Code
          })
        }
      });
    }
    return new Response(null, {
      status: this.code,
      headers: {
        [R2Headers.ERROR]: JSON.stringify({
          message: this.message,
          version: 1,
          // Note the lowercase 'c', which the runtime expects
          v4code: this.v4Code
        })
      }
    });
  }
  context(info) {
    return this.message += ` (${info})`, this;
  }
  attach(object) {
    return this.object = object, this;
  }
}, InvalidMetadata = class extends R2Error {
  constructor() {
    super(400, "Metadata missing or invalid", R2ErrorCode.INVALID_ARGUMENT);
  }
}, InternalError = class extends R2Error {
  constructor() {
    super(
      500,
      "We encountered an internal error. Please try again.",
      R2ErrorCode.INTERNAL_ERROR
    );
  }
}, NoSuchKey = class extends R2Error {
  constructor() {
    super(
      404,
      "The specified key does not exist.",
      R2ErrorCode.NO_SUCH_OBJECT_KEY
    );
  }
}, EntityTooLarge = class extends R2Error {
  constructor() {
    super(
      400,
      "Your proposed upload exceeds the maximum allowed object size.",
      R2ErrorCode.ENTITY_TOO_LARGE
    );
  }
}, EntityTooSmall = class extends R2Error {
  constructor() {
    super(
      400,
      "Your proposed upload is smaller than the minimum allowed object size.",
      R2ErrorCode.ENTITY_TOO_SMALL
    );
  }
}, MetadataTooLarge = class extends R2Error {
  constructor() {
    super(
      400,
      "Your metadata headers exceed the maximum allowed metadata size.",
      R2ErrorCode.METADATA_TOO_LARGE
    );
  }
}, BadDigest = class extends R2Error {
  constructor(algorithm, provided, calculated) {
    super(
      400,
      [
        `The ${algorithm} checksum you specified did not match what we received.`,
        `You provided a ${algorithm} checksum with value: ${provided.toString(
          "hex"
        )}`,
        `Actual ${algorithm} was: ${calculated.toString("hex")}`
      ].join(`
`),
      R2ErrorCode.BAD_DIGEST
    );
  }
}, InvalidObjectName = class extends R2Error {
  constructor() {
    super(
      400,
      "The specified object name is not valid.",
      R2ErrorCode.INVALID_OBJECT_NAME
    );
  }
}, InvalidMaxKeys = class extends R2Error {
  constructor() {
    super(
      400,
      "MaxKeys params must be positive integer <= 1000.",
      R2ErrorCode.INVALID_MAX_KEYS
    );
  }
}, NoSuchUpload = class extends R2Error {
  constructor() {
    super(
      400,
      "The specified multipart upload does not exist.",
      R2ErrorCode.NO_SUCH_UPLOAD
    );
  }
}, InvalidPart = class extends R2Error {
  constructor() {
    super(
      400,
      "One or more of the specified parts could not be found.",
      R2ErrorCode.INVALID_PART
    );
  }
}, PreconditionFailed = class extends R2Error {
  constructor() {
    super(
      412,
      "At least one of the pre-conditions you specified did not hold.",
      R2ErrorCode.PRECONDITION_FAILED
    );
  }
}, InvalidRange = class extends R2Error {
  constructor() {
    super(
      416,
      "The requested range is not satisfiable",
      R2ErrorCode.INVALID_RANGE
    );
  }
}, BadUpload = class extends R2Error {
  constructor() {
    super(
      500,
      "There was a problem with the multipart upload.",
      R2ErrorCode.BAD_UPLOAD
    );
  }
};

// src/workers/r2/r2Object.worker.ts
import { HEX_REGEXP } from "miniflare:zod";
var InternalR2Object = class {
  key;
  version;
  size;
  etag;
  uploaded;
  httpMetadata;
  customMetadata;
  range;
  checksums;
  constructor(row, range) {
    this.key = row.key, this.version = row.version, this.size = row.size, this.etag = row.etag, this.uploaded = row.uploaded, this.httpMetadata = JSON.parse(row.http_metadata), this.customMetadata = JSON.parse(row.custom_metadata), this.range = range;
    let checksums = JSON.parse(row.checksums);
    this.etag.length === 32 && HEX_REGEXP.test(this.etag) && (checksums.md5 = row.etag), this.checksums = checksums;
  }
  // Format for return to the Workers Runtime
  #rawProperties() {
    return {
      name: this.key,
      version: this.version,
      size: this.size,
      etag: this.etag,
      uploaded: this.uploaded,
      httpFields: this.httpMetadata,
      customFields: Object.entries(this.customMetadata).map(([k, v]) => ({
        k,
        v
      })),
      range: this.range,
      checksums: {
        0: this.checksums.md5,
        1: this.checksums.sha1,
        2: this.checksums.sha256,
        3: this.checksums.sha384,
        4: this.checksums.sha512
      }
    };
  }
  encode() {
    let json = JSON.stringify(this.#rawProperties()), blob = new Blob([json]);
    return { metadataSize: blob.size, value: blob.stream(), size: blob.size };
  }
  static encodeMultiple(objects) {
    let json = JSON.stringify({
      ...objects,
      objects: objects.objects.map((o) => o.#rawProperties())
    }), blob = new Blob([json]);
    return { metadataSize: blob.size, value: blob.stream(), size: blob.size };
  }
}, InternalR2ObjectBody = class extends InternalR2Object {
  constructor(metadata, body, range) {
    super(metadata, range);
    this.body = body;
  }
  encode() {
    let { metadataSize, value: metadata } = super.encode(), size = this.range?.length ?? this.size, identity2 = new FixedLengthStream(size + metadataSize);
    return metadata.pipeTo(identity2.writable, { preventClose: !0 }).then(() => this.body.pipeTo(identity2.writable)), {
      metadataSize,
      value: identity2.readable,
      size
    };
  }
};

// src/workers/r2/schemas.worker.ts
import { Base64DataSchema, HexDataSchema, z } from "miniflare:zod";
var MultipartUploadState = {
  IN_PROGRESS: 0,
  COMPLETED: 1,
  ABORTED: 2
}, SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS _mf_objects (
    key TEXT PRIMARY KEY,
    blob_id TEXT,
    version TEXT NOT NULL,
    size INTEGER NOT NULL,
    etag TEXT NOT NULL,
    uploaded INTEGER NOT NULL,
    checksums TEXT NOT NULL,
    http_metadata TEXT NOT NULL,
    custom_metadata TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS _mf_multipart_uploads (
    upload_id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    http_metadata TEXT NOT NULL,
    custom_metadata TEXT NOT NULL,
    state TINYINT DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS _mf_multipart_parts (
    upload_id TEXT NOT NULL REFERENCES _mf_multipart_uploads(upload_id),
    part_number INTEGER NOT NULL,
    blob_id TEXT NOT NULL,
    size INTEGER NOT NULL,
    etag TEXT NOT NULL,
    checksum_md5 TEXT NOT NULL,
    object_key TEXT REFERENCES _mf_objects(key) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (upload_id, part_number)
);
`, DateSchema = z.coerce.number().transform((value) => new Date(value)), RecordSchema = z.object({
  k: z.string(),
  v: z.string()
}).array().transform(
  (entries) => Object.fromEntries(entries.map(({ k, v }) => [k, v]))
), R2RangeSchema = z.object({
  offset: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
  suffix: z.coerce.number().optional()
}), R2EtagSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("strong"), value: z.string() }),
  z.object({ type: z.literal("weak"), value: z.string() }),
  z.object({ type: z.literal("wildcard") })
]), R2EtagMatchSchema = R2EtagSchema.array().min(1).optional(), R2ConditionalSchema = z.object({
  // Performs the operation if the object's ETag matches the given string
  etagMatches: R2EtagMatchSchema,
  // "If-Match"
  // Performs the operation if the object's ETag does NOT match the given string
  etagDoesNotMatch: R2EtagMatchSchema,
  // "If-None-Match"
  // Performs the operation if the object was uploaded BEFORE the given date
  uploadedBefore: DateSchema.optional(),
  // "If-Unmodified-Since"
  // Performs the operation if the object was uploaded AFTER the given date
  uploadedAfter: DateSchema.optional(),
  // "If-Modified-Since"
  // Truncates dates to seconds before performing comparisons
  secondsGranularity: z.oboolean()
}), R2ChecksumsSchema = z.object({
  0: HexDataSchema.optional(),
  1: HexDataSchema.optional(),
  2: HexDataSchema.optional(),
  3: HexDataSchema.optional(),
  4: HexDataSchema.optional()
}).transform((checksums) => ({
  md5: checksums[0],
  sha1: checksums[1],
  sha256: checksums[2],
  sha384: checksums[3],
  sha512: checksums[4]
})), R2PublishedPartSchema = z.object({
  etag: z.string(),
  part: z.number()
}), R2HttpFieldsSchema = z.object({
  contentType: z.ostring(),
  contentLanguage: z.ostring(),
  contentDisposition: z.ostring(),
  contentEncoding: z.ostring(),
  cacheControl: z.ostring(),
  cacheExpiry: z.coerce.number().optional()
}), R2HeadRequestSchema = z.object({
  method: z.literal("head"),
  object: z.string()
}), R2GetRequestSchema = z.object({
  method: z.literal("get"),
  object: z.string(),
  // Specifies that only a specific length (from an optional offset) or suffix
  // of bytes from the object should be returned. Refer to
  // https://developers.cloudflare.com/r2/runtime-apis/#ranged-reads.
  range: R2RangeSchema.optional(),
  rangeHeader: z.ostring(),
  // Specifies that the object should only be returned given satisfaction of
  // certain conditions in the R2Conditional. Refer to R2Conditional above.
  onlyIf: R2ConditionalSchema.optional()
}), R2PutRequestSchema = z.object({
  method: z.literal("put"),
  object: z.string(),
  customFields: RecordSchema.optional(),
  // (renamed in transform)
  httpFields: R2HttpFieldsSchema.optional(),
  // (renamed in transform)
  onlyIf: R2ConditionalSchema.optional(),
  md5: Base64DataSchema.optional(),
  // (intentionally base64, not hex)
  sha1: HexDataSchema.optional(),
  sha256: HexDataSchema.optional(),
  sha384: HexDataSchema.optional(),
  sha512: HexDataSchema.optional()
}).transform((value) => ({
  method: value.method,
  object: value.object,
  customMetadata: value.customFields,
  httpMetadata: value.httpFields,
  onlyIf: value.onlyIf,
  md5: value.md5,
  sha1: value.sha1,
  sha256: value.sha256,
  sha384: value.sha384,
  sha512: value.sha512
})), R2CreateMultipartUploadRequestSchema = z.object({
  method: z.literal("createMultipartUpload"),
  object: z.string(),
  customFields: RecordSchema.optional(),
  // (renamed in transform)
  httpFields: R2HttpFieldsSchema.optional()
  // (renamed in transform)
}).transform((value) => ({
  method: value.method,
  object: value.object,
  customMetadata: value.customFields,
  httpMetadata: value.httpFields
})), R2UploadPartRequestSchema = z.object({
  method: z.literal("uploadPart"),
  object: z.string(),
  uploadId: z.string(),
  partNumber: z.number()
}), R2CompleteMultipartUploadRequestSchema = z.object({
  method: z.literal("completeMultipartUpload"),
  object: z.string(),
  uploadId: z.string(),
  parts: R2PublishedPartSchema.array()
}), R2AbortMultipartUploadRequestSchema = z.object({
  method: z.literal("abortMultipartUpload"),
  object: z.string(),
  uploadId: z.string()
}), R2ListRequestSchema = z.object({
  method: z.literal("list"),
  limit: z.onumber(),
  prefix: z.ostring(),
  cursor: z.ostring(),
  delimiter: z.ostring(),
  startAfter: z.ostring(),
  include: z.union([z.literal(0), z.literal(1)]).transform((value) => value === 0 ? "httpMetadata" : "customMetadata").array().optional()
}), R2DeleteRequestSchema = z.intersection(
  z.object({ method: z.literal("delete") }),
  z.union([
    z.object({ object: z.string() }),
    z.object({ objects: z.string().array() })
  ])
), R2BindingRequestSchema = z.union([
  R2HeadRequestSchema,
  R2GetRequestSchema,
  R2PutRequestSchema,
  R2CreateMultipartUploadRequestSchema,
  R2UploadPartRequestSchema,
  R2CompleteMultipartUploadRequestSchema,
  R2AbortMultipartUploadRequestSchema,
  R2ListRequestSchema,
  R2DeleteRequestSchema
]);

// src/workers/r2/validator.worker.ts
import assert from "node:assert";
import { Buffer as Buffer2 } from "node:buffer";
import { parseRanges } from "miniflare:shared";
function identity(ms) {
  return ms;
}
function truncateToSeconds(ms) {
  return Math.floor(ms / 1e3) * 1e3;
}
function includesEtag(conditions, etag, comparison) {
  for (let condition of conditions)
    if (condition.type === "wildcard" || condition.value === etag && (condition.type === "strong" || comparison === "weak"))
      return !0;
  return !1;
}
function _testR2Conditional(cond, metadata) {
  if (metadata === void 0) {
    let ifMatch2 = cond.etagMatches === void 0, ifModifiedSince2 = cond.uploadedAfter === void 0;
    return ifMatch2 && ifModifiedSince2;
  }
  let { etag, uploaded: lastModifiedRaw } = metadata, ifMatch = cond.etagMatches === void 0 || includesEtag(cond.etagMatches, etag, "strong"), ifNoneMatch = cond.etagDoesNotMatch === void 0 || !includesEtag(cond.etagDoesNotMatch, etag, "weak"), maybeTruncate = cond.secondsGranularity ? truncateToSeconds : identity, lastModified = maybeTruncate(lastModifiedRaw), ifModifiedSince = cond.uploadedAfter === void 0 || maybeTruncate(cond.uploadedAfter.getTime()) < lastModified || cond.etagDoesNotMatch !== void 0 && ifNoneMatch, ifUnmodifiedSince = cond.uploadedBefore === void 0 || lastModified < maybeTruncate(cond.uploadedBefore.getTime()) || cond.etagMatches !== void 0 && ifMatch;
  return ifMatch && ifNoneMatch && ifModifiedSince && ifUnmodifiedSince;
}
var R2_HASH_ALGORITHMS = [
  { name: "MD5", field: "md5" },
  { name: "SHA-1", field: "sha1" },
  { name: "SHA-256", field: "sha256" },
  { name: "SHA-384", field: "sha384" },
  { name: "SHA-512", field: "sha512" }
];
function serialisedLength(x) {
  for (let i = 0; i < x.length; i++)
    if (x.charCodeAt(i) >= 256) return x.length * 2;
  return x.length;
}
var Validator = class {
  hash(digests, hashes) {
    let checksums = {};
    for (let { name, field } of R2_HASH_ALGORITHMS) {
      let providedHash = hashes[field];
      if (providedHash !== void 0) {
        let computedHash = digests.get(name);
        if (assert(computedHash !== void 0), !providedHash.equals(computedHash))
          throw new BadDigest(name, providedHash, computedHash);
        checksums[field] = computedHash.toString("hex");
      }
    }
    return checksums;
  }
  condition(meta, onlyIf) {
    if (onlyIf !== void 0 && !_testR2Conditional(onlyIf, meta))
      throw new PreconditionFailed();
    return this;
  }
  range(options, size) {
    if (options.rangeHeader !== void 0) {
      let ranges = parseRanges(options.rangeHeader, size);
      if (ranges?.length === 1) return ranges[0];
    } else if (options.range !== void 0) {
      let { offset, length, suffix } = options.range;
      if (suffix !== void 0) {
        if (suffix <= 0) throw new InvalidRange();
        suffix > size && (suffix = size), offset = size - suffix, length = suffix;
      }
      if (offset === void 0 && (offset = 0), length === void 0 && (length = size - offset), offset < 0 || offset > size || length <= 0) throw new InvalidRange();
      return offset + length > size && (length = size - offset), { start: offset, end: offset + length - 1 };
    }
  }
  size(size) {
    if (size > R2Limits.MAX_VALUE_SIZE)
      throw new EntityTooLarge();
    return this;
  }
  metadataSize(customMetadata) {
    if (customMetadata === void 0) return this;
    let metadataLength = 0;
    for (let [key, value] of Object.entries(customMetadata))
      metadataLength += serialisedLength(key) + serialisedLength(value);
    if (metadataLength > R2Limits.MAX_METADATA_SIZE)
      throw new MetadataTooLarge();
    return this;
  }
  key(key) {
    if (Buffer2.byteLength(key) > R2Limits.MAX_KEY_SIZE)
      throw new InvalidObjectName();
    return this;
  }
  limit(limit) {
    if (limit !== void 0 && (limit < 1 || limit > R2Limits.MAX_LIST_KEYS))
      throw new InvalidMaxKeys();
    return this;
  }
};

// src/workers/r2/bucket.worker.ts
var DigestingStream = class extends TransformStream {
  digests;
  constructor(algorithms) {
    let digests = new DeferredPromise(), hashes = algorithms.map((alg) => {
      let stream = new crypto.DigestStream(alg), writer = stream.getWriter();
      return { stream, writer };
    });
    super({
      async transform(chunk, controller) {
        for (let hash of hashes) await hash.writer.write(chunk);
        controller.enqueue(chunk);
      },
      async flush() {
        let result = /* @__PURE__ */ new Map();
        for (let i = 0; i < hashes.length; i++)
          await hashes[i].writer.close(), result.set(algorithms[i], Buffer3.from(await hashes[i].stream.digest));
        digests.resolve(result);
      }
    }), this.digests = digests;
  }
}, validate = new Validator(), decoder = new TextDecoder();
function generateVersion() {
  return Buffer3.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "hex"
  );
}
function generateId() {
  return Buffer3.from(crypto.getRandomValues(new Uint8Array(128))).toString(
    "base64url"
  );
}
function generateMultipartEtag(md5Hexes) {
  let hash = createHash("md5");
  for (let md5Hex of md5Hexes) hash.update(md5Hex, "hex");
  return `${hash.digest("hex")}-${md5Hexes.length}`;
}
function rangeOverlaps(a, b) {
  return a.start <= b.end && b.start <= a.end;
}
async function decodeMetadata(req) {
  let metadataSize = parseInt(req.headers.get(R2Headers.METADATA_SIZE));
  if (Number.isNaN(metadataSize)) throw new InvalidMetadata();
  assert2(req.body !== null);
  let body = req.body, [metadataBuffer, value] = await readPrefix(body, metadataSize), metadataJson = decoder.decode(metadataBuffer);
  return { metadata: R2BindingRequestSchema.parse(JSON.parse(metadataJson)), metadataSize, value };
}
function decodeHeaderMetadata(req) {
  let header = req.headers.get(R2Headers.REQUEST);
  if (header === null) throw new InvalidMetadata();
  return R2BindingRequestSchema.parse(JSON.parse(header));
}
function encodeResult(result) {
  let encoded;
  return result instanceof InternalR2Object ? encoded = result.encode() : encoded = InternalR2Object.encodeMultiple(result), new Response(encoded.value, {
    headers: {
      [R2Headers.METADATA_SIZE]: `${encoded.metadataSize}`,
      "Content-Type": "application/json",
      "Content-Length": `${encoded.size}`
    }
  });
}
function encodeJSONResult(result) {
  let encoded = JSON.stringify(result);
  return new Response(encoded, {
    headers: {
      [R2Headers.METADATA_SIZE]: `${Buffer3.byteLength(encoded)}`,
      "Content-Type": "application/json"
    }
  });
}
function sqlStmts(db) {
  let stmtGetPreviousByKey = db.stmt("SELECT blob_id, etag, uploaded FROM _mf_objects WHERE key = :key"), stmtGetByKey = db.stmt(`
    SELECT key, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata
    FROM _mf_objects WHERE key = :key
  `), stmtPut = db.stmt(`
    INSERT OR REPLACE INTO _mf_objects (key, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata)
    VALUES (:key, :blob_id, :version, :size, :etag, :uploaded, :checksums, :http_metadata, :custom_metadata)
  `), stmtDelete = db.stmt("DELETE FROM _mf_objects WHERE key = :key RETURNING blob_id");
  function stmtListWithoutDelimiter(...extraColumns) {
    let columns = [
      "key",
      "version",
      "size",
      "etag",
      "uploaded",
      "checksums",
      ...extraColumns
    ];
    return db.stmt(`
      SELECT ${columns.join(", ")}
      FROM _mf_objects
      WHERE substr(key, 1, length(:prefix)) = :prefix
      AND (:start_after IS NULL OR key > :start_after)
      ORDER BY key LIMIT :limit
    `);
  }
  let stmtGetUploadState = db.stmt(
    // For checking current upload state
    "SELECT state FROM _mf_multipart_uploads WHERE upload_id = :upload_id AND key = :key"
  ), stmtGetUploadMetadata = db.stmt(
    // For checking current upload state, and getting metadata for completion
    "SELECT http_metadata, custom_metadata, state FROM _mf_multipart_uploads WHERE upload_id = :upload_id AND key = :key"
  ), stmtUpdateUploadState = db.stmt(
    // For completing/aborting uploads
    "UPDATE _mf_multipart_uploads SET state = :state WHERE upload_id = :upload_id"
  ), stmtGetPreviousPartByNumber = db.stmt(
    // For getting part number's previous blob ID to garbage collect
    "SELECT blob_id FROM _mf_multipart_parts WHERE upload_id = :upload_id AND part_number = :part_number"
  ), stmtPutPart = db.stmt(
    // For recording metadata when uploading parts
    `INSERT OR REPLACE INTO _mf_multipart_parts (upload_id, part_number, blob_id, size, etag, checksum_md5)
    VALUES (:upload_id, :part_number, :blob_id, :size, :etag, :checksum_md5)`
  ), stmtLinkPart = db.stmt(
    // For linking parts with an object when completing uploads
    `UPDATE _mf_multipart_parts SET object_key = :object_key
    WHERE upload_id = :upload_id AND part_number = :part_number`
  ), stmtDeletePartsByUploadId = db.stmt(
    // For deleting parts when aborting uploads
    "DELETE FROM _mf_multipart_parts WHERE upload_id = :upload_id RETURNING blob_id"
  ), stmtDeleteUnlinkedPartsByUploadId = db.stmt(
    // For deleting unused parts when completing uploads
    "DELETE FROM _mf_multipart_parts WHERE upload_id = :upload_id AND object_key IS NULL RETURNING blob_id"
  ), stmtDeletePartsByKey = db.stmt(
    // For deleting dangling parts when overwriting an existing key
    "DELETE FROM _mf_multipart_parts WHERE object_key = :object_key RETURNING blob_id"
  ), stmtListPartsByUploadId = db.stmt(
    // For getting part metadata when completing uploads
    `SELECT upload_id, part_number, blob_id, size, etag, checksum_md5, object_key
    FROM _mf_multipart_parts WHERE upload_id = :upload_id`
  ), stmtListPartsByKey = db.stmt(
    // For getting part metadata when getting values, size included for range
    // requests, so we only need to read blobs containing the required data
    "SELECT blob_id, size FROM _mf_multipart_parts WHERE object_key = :object_key ORDER BY part_number"
  );
  return {
    getByKey: stmtGetByKey,
    getPartsByKey: db.txn((key) => {
      let row = get(stmtGetByKey({ key }));
      if (row !== void 0)
        if (row.blob_id === null) {
          let partsRows = all(stmtListPartsByKey({ object_key: key }));
          return { row, parts: partsRows };
        } else
          return { row };
    }),
    put: db.txn((newRow, onlyIf) => {
      let key = newRow.key, row = get(stmtGetPreviousByKey({ key }));
      onlyIf !== void 0 && validate.condition(row, onlyIf), stmtPut(newRow);
      let maybeOldBlobId = row?.blob_id;
      return maybeOldBlobId === void 0 ? [] : maybeOldBlobId === null ? all(stmtDeletePartsByKey({ object_key: key })).map(({ blob_id }) => blob_id) : [maybeOldBlobId];
    }),
    deleteByKeys: db.txn((keys) => {
      let oldBlobIds = [];
      for (let key of keys) {
        let maybeOldBlobId = get(stmtDelete({ key }))?.blob_id;
        if (maybeOldBlobId === null) {
          let partRows = stmtDeletePartsByKey({ object_key: key });
          for (let partRow of partRows) oldBlobIds.push(partRow.blob_id);
        } else maybeOldBlobId !== void 0 && oldBlobIds.push(maybeOldBlobId);
      }
      return oldBlobIds;
    }),
    listWithoutDelimiter: stmtListWithoutDelimiter(),
    listHttpMetadataWithoutDelimiter: stmtListWithoutDelimiter("http_metadata"),
    listCustomMetadataWithoutDelimiter: stmtListWithoutDelimiter("custom_metadata"),
    listHttpCustomMetadataWithoutDelimiter: stmtListWithoutDelimiter(
      "http_metadata",
      "custom_metadata"
    ),
    listMetadata: db.stmt(`
      SELECT
        -- When grouping by a delimited prefix, this will give us the last key with that prefix.
        --   NOTE: we'll use this for the next cursor. If we didn't return the last key, the next page may return the
        --   same delimited prefix. Essentially, we're skipping over all keys with this group's delimited prefix.
        -- When grouping by a key, this will just give us the key.
        max(key) AS last_key,
        iif(
            -- Try get 1-indexed position \`i\` of :delimiter in rest of key after :prefix...
                                                       instr(substr(key, length(:prefix) + 1), :delimiter),
            -- ...if found, we have a delimited prefix of the :prefix followed by the rest of key up to and including the :delimiter
            'dlp:' || substr(key, 1, length(:prefix) + instr(substr(key, length(:prefix) + 1), :delimiter) + length(:delimiter) - 1),
            -- ...otherwise, we just have a regular key
            'key:' || key
        ) AS delimited_prefix_or_key,
        -- NOTE: we'll ignore metadata for delimited prefix rows, so it doesn't matter which keys' we return
        version, size, etag, uploaded, checksums, http_metadata, custom_metadata
      FROM _mf_objects
      WHERE substr(key, 1, length(:prefix)) = :prefix
      AND (:start_after IS NULL OR key > :start_after)
      GROUP BY delimited_prefix_or_key -- Group keys with same delimited prefix into a row, leaving others in their own rows
      ORDER BY last_key LIMIT :limit;
    `),
    createMultipartUpload: db.stmt(`
      INSERT INTO _mf_multipart_uploads (upload_id, key, http_metadata, custom_metadata)
      VALUES (:upload_id, :key, :http_metadata, :custom_metadata)
    `),
    putPart: db.txn(
      (key, newRow) => {
        if (get(
          stmtGetUploadState({
            key,
            upload_id: newRow.upload_id
          })
        )?.state !== MultipartUploadState.IN_PROGRESS)
          throw new NoSuchUpload();
        let partRow = get(
          stmtGetPreviousPartByNumber({
            upload_id: newRow.upload_id,
            part_number: newRow.part_number
          })
        );
        return stmtPutPart(newRow), partRow?.blob_id;
      }
    ),
    completeMultipartUpload: db.txn(
      (key, upload_id, selectedParts, minPartSize) => {
        let uploadRow = get(stmtGetUploadMetadata({ key, upload_id }));
        if (uploadRow === void 0)
          throw new InternalError();
        if (uploadRow.state > MultipartUploadState.IN_PROGRESS)
          throw new NoSuchUpload();
        let partNumberSet = /* @__PURE__ */ new Set();
        for (let { part } of selectedParts) {
          if (partNumberSet.has(part)) throw new InternalError();
          partNumberSet.add(part);
        }
        let uploadedPartRows = stmtListPartsByUploadId({ upload_id }), uploadedParts = /* @__PURE__ */ new Map();
        for (let row of uploadedPartRows)
          uploadedParts.set(row.part_number, row);
        let parts = selectedParts.map((selectedPart) => {
          let uploadedPart = uploadedParts.get(selectedPart.part);
          if (uploadedPart?.etag !== selectedPart.etag)
            throw new InvalidPart();
          return uploadedPart;
        });
        for (let part of parts.slice(0, -1))
          if (part.size < minPartSize)
            throw new EntityTooSmall();
        parts.sort((a, b) => a.part_number - b.part_number);
        let partSize;
        for (let part of parts.slice(0, -1))
          if (partSize ??= part.size, part.size < minPartSize || part.size !== partSize)
            throw new BadUpload();
        if (partSize !== void 0 && parts[parts.length - 1].size > partSize)
          throw new BadUpload();
        let oldBlobIds = [], maybeOldBlobId = get(stmtGetPreviousByKey({ key }))?.blob_id;
        if (maybeOldBlobId === null) {
          let partRows2 = stmtDeletePartsByKey({ object_key: key });
          for (let partRow of partRows2) oldBlobIds.push(partRow.blob_id);
        } else maybeOldBlobId !== void 0 && oldBlobIds.push(maybeOldBlobId);
        let totalSize = parts.reduce((acc, { size }) => acc + size, 0), etag = generateMultipartEtag(
          parts.map(({ checksum_md5 }) => checksum_md5)
        ), newRow = {
          key,
          blob_id: null,
          version: generateVersion(),
          size: totalSize,
          etag,
          uploaded: Date.now(),
          checksums: "{}",
          http_metadata: uploadRow.http_metadata,
          custom_metadata: uploadRow.custom_metadata
        };
        stmtPut(newRow);
        for (let part of parts)
          stmtLinkPart({
            upload_id,
            part_number: part.part_number,
            object_key: key
          });
        let partRows = stmtDeleteUnlinkedPartsByUploadId({ upload_id });
        for (let partRow of partRows) oldBlobIds.push(partRow.blob_id);
        return stmtUpdateUploadState({
          upload_id,
          state: MultipartUploadState.COMPLETED
        }), { newRow, oldBlobIds };
      }
    ),
    abortMultipartUpload: db.txn((key, upload_id) => {
      let uploadRow = get(stmtGetUploadState({ key, upload_id }));
      if (uploadRow === void 0)
        throw new InternalError();
      if (uploadRow.state > MultipartUploadState.IN_PROGRESS)
        return [];
      let oldBlobIds = all(stmtDeletePartsByUploadId({ upload_id })).map(({ blob_id }) => blob_id);
      return stmtUpdateUploadState({
        upload_id,
        state: MultipartUploadState.ABORTED
      }), oldBlobIds;
    })
  };
}
var R2BucketObject = class extends MiniflareDurableObject {
  #stmts;
  // Multipart uploads are stored as multiple blobs. Therefore, when reading a
  // multipart upload, we'll be reading multiple blobs. When an object is
  // deleted, all its blobs are deleted in the background.
  //
  // Normally for single part objects, this is fine, since we'd open a handle to
  // a single blob, which we'd have until we closed it, at which point the blob
  // may be deleted. With multipart, we don't want to open handles for all blobs
  // as we could hit open file descriptor limits. Similarly, we don't want to
  // read all blobs first, as we'd have to buffer them.
  //
  // Instead, we set up in-process locking on blobs needed for multipart reads.
  // When we start a multipart read, we acquire all the blobs we need, then
  // release them as we've streamed each part. Multiple multipart reads may be
  // in-progress at any given time, so we use a wait group.
  //
  // This assumes we only ever have a single Miniflare instance operating on a
  // blob store, which is always true for in-memory stores, and usually true for
  // on-disk ones. If we really wanted to do this properly, we could store the
  // bookkeeping for the wait group in SQLite, but then we'd have to implement
  // some inter-process signalling/subscription system.
  #inUseBlobs = /* @__PURE__ */ new Map();
  constructor(state, env) {
    super(state, env), this.db.exec("PRAGMA case_sensitive_like = TRUE"), this.db.exec(SQL_SCHEMA), this.#stmts = sqlStmts(this.db);
  }
  #acquireBlob(blobId) {
    let waitGroup = this.#inUseBlobs.get(blobId);
    waitGroup === void 0 ? (waitGroup = new WaitGroup(), this.#inUseBlobs.set(blobId, waitGroup), waitGroup.add(), waitGroup.wait().then(() => this.#inUseBlobs.delete(blobId))) : waitGroup.add();
  }
  #releaseBlob(blobId) {
    this.#inUseBlobs.get(blobId)?.done();
  }
  #backgroundDelete(blobId) {
    this.timers.queueMicrotask(async () => (await this.#inUseBlobs.get(blobId)?.wait(), this.blob.delete(blobId).catch((e) => {
      console.error("R2BucketObject##backgroundDelete():", e);
    })));
  }
  #assembleMultipartValue(parts, queryRange) {
    let requiredParts = [], start = 0;
    for (let part of parts) {
      let partRange = { start, end: start + part.size - 1 };
      if (rangeOverlaps(partRange, queryRange)) {
        let range = {
          start: Math.max(partRange.start, queryRange.start) - partRange.start,
          end: Math.min(partRange.end, queryRange.end) - partRange.start
        };
        this.#acquireBlob(part.blob_id), requiredParts.push({ blobId: part.blob_id, range });
      }
      start = partRange.end + 1;
    }
    let identity2 = new TransformStream();
    return (async () => {
      let i = 0;
      try {
        for (; i < requiredParts.length; i++) {
          let { blobId, range } = requiredParts[i], value = await this.blob.get(blobId, range), msg = `Expected to find blob "${blobId}" for multipart value`;
          assert2(value !== null, msg), await value.pipeTo(identity2.writable, { preventClose: !0 }), this.#releaseBlob(blobId);
        }
        await identity2.writable.close();
      } catch (e) {
        await identity2.writable.abort(e);
      } finally {
        for (; i < requiredParts.length; i++)
          this.#releaseBlob(requiredParts[i].blobId);
      }
    })(), identity2.readable;
  }
  async #head(key) {
    validate.key(key);
    let row = get(this.#stmts.getByKey({ key }));
    if (row === void 0) throw new NoSuchKey();
    let range = { offset: 0, length: row.size };
    return new InternalR2Object(row, range);
  }
  async #get(key, opts) {
    validate.key(key);
    let result = this.#stmts.getPartsByKey(key);
    if (result === void 0) throw new NoSuchKey();
    let { row, parts } = result, defaultR2Range = { offset: 0, length: row.size };
    try {
      validate.condition(row, opts.onlyIf);
    } catch (e) {
      throw e instanceof PreconditionFailed && e.attach(new InternalR2Object(row, defaultR2Range)), e;
    }
    let range = validate.range(opts, row.size), r2Range;
    if (range === void 0)
      r2Range = defaultR2Range;
    else {
      let start = range.start, end = Math.min(range.end, row.size);
      r2Range = { offset: start, length: end - start + 1 };
    }
    let value;
    if (row.blob_id === null) {
      assert2(parts !== void 0);
      let defaultRange = { start: 0, end: row.size - 1 };
      value = this.#assembleMultipartValue(parts, range ?? defaultRange);
    } else if (value = await this.blob.get(row.blob_id, range), value === null) throw new NoSuchKey();
    return new InternalR2ObjectBody(row, value, r2Range);
  }
  async #put(key, value, valueSize, opts) {
    let algorithms = [];
    for (let { name, field } of R2_HASH_ALGORITHMS)
      (field === "md5" || opts[field] !== void 0) && algorithms.push(name);
    let digesting = new DigestingStream(algorithms), blobId = await this.blob.put(value.pipeThrough(digesting)), digests = await digesting.digests, md5Digest = digests.get("MD5");
    assert2(md5Digest !== void 0);
    let md5DigestHex = md5Digest.toString("hex"), checksums = validate.key(key).size(valueSize).metadataSize(opts.customMetadata).hash(digests, opts), row = {
      key,
      blob_id: blobId,
      version: generateVersion(),
      size: valueSize,
      etag: md5DigestHex,
      uploaded: Date.now(),
      checksums: JSON.stringify(checksums),
      http_metadata: JSON.stringify(opts.httpMetadata ?? {}),
      custom_metadata: JSON.stringify(opts.customMetadata ?? {})
    }, oldBlobIds;
    try {
      oldBlobIds = this.#stmts.put(row, opts.onlyIf);
    } catch (e) {
      throw this.#backgroundDelete(blobId), e;
    }
    if (oldBlobIds !== void 0)
      for (let blobId2 of oldBlobIds) this.#backgroundDelete(blobId2);
    return new InternalR2Object(row);
  }
  #delete(keys) {
    Array.isArray(keys) || (keys = [keys]);
    for (let key of keys) validate.key(key);
    let oldBlobIds = this.#stmts.deleteByKeys(keys);
    for (let blobId of oldBlobIds) this.#backgroundDelete(blobId);
  }
  #listWithoutDelimiterQuery(excludeHttp, excludeCustom) {
    return excludeHttp && excludeCustom ? this.#stmts.listWithoutDelimiter : excludeHttp ? this.#stmts.listCustomMetadataWithoutDelimiter : excludeCustom ? this.#stmts.listHttpMetadataWithoutDelimiter : this.#stmts.listHttpCustomMetadataWithoutDelimiter;
  }
  async #list(opts) {
    let prefix = opts.prefix ?? "", limit = opts.limit ?? R2Limits.MAX_LIST_KEYS;
    validate.limit(limit);
    let include = opts.include ?? [];
    include.length > 0 && (limit = Math.min(limit, 100));
    let excludeHttp = !include.includes("httpMetadata"), excludeCustom = !include.includes("customMetadata"), rowObject = (row) => ((row.http_metadata === void 0 || excludeHttp) && (row.http_metadata = "{}"), (row.custom_metadata === void 0 || excludeCustom) && (row.custom_metadata = "{}"), new InternalR2Object(row)), startAfter = opts.startAfter;
    if (opts.cursor !== void 0) {
      let cursorStartAfter = base64Decode(opts.cursor);
      (startAfter === void 0 || cursorStartAfter > startAfter) && (startAfter = cursorStartAfter);
    }
    let delimiter = opts.delimiter;
    delimiter === "" && (delimiter = void 0);
    let params = {
      prefix,
      start_after: startAfter ?? null,
      // Increase the queried limit by 1, if we return this many results, we
      // know there are more rows. We'll truncate to the original limit before
      // returning results.
      limit: limit + 1
    }, objects, delimitedPrefixes = [], nextCursorStartAfter;
    if (delimiter !== void 0) {
      let rows = all(this.#stmts.listMetadata({ ...params, delimiter })), hasMoreRows = rows.length === limit + 1;
      rows.splice(limit, 1), objects = [];
      for (let row of rows)
        row.delimited_prefix_or_key.startsWith("dlp:") ? delimitedPrefixes.push(row.delimited_prefix_or_key.substring(4)) : objects.push(rowObject({ ...row, key: row.last_key }));
      hasMoreRows && (nextCursorStartAfter = rows[limit - 1].last_key);
    } else {
      let query = this.#listWithoutDelimiterQuery(excludeHttp, excludeCustom), rows = all(query(params)), hasMoreRows = rows.length === limit + 1;
      rows.splice(limit, 1), objects = rows.map(rowObject), hasMoreRows && (nextCursorStartAfter = rows[limit - 1].key);
    }
    let nextCursor = maybeApply(base64Encode, nextCursorStartAfter);
    return {
      objects,
      truncated: nextCursor !== void 0,
      cursor: nextCursor,
      delimitedPrefixes
    };
  }
  async #createMultipartUpload(key, opts) {
    validate.key(key);
    let uploadId = generateId();
    return this.#stmts.createMultipartUpload({
      key,
      upload_id: uploadId,
      http_metadata: JSON.stringify(opts.httpMetadata ?? {}),
      custom_metadata: JSON.stringify(opts.customMetadata ?? {})
    }), { uploadId };
  }
  async #uploadPart(key, uploadId, partNumber, value, valueSize) {
    validate.key(key);
    let digesting = new DigestingStream(["MD5"]), blobId = await this.blob.put(value.pipeThrough(digesting)), md5Digest = (await digesting.digests).get("MD5");
    assert2(md5Digest !== void 0);
    let etag = generateId(), maybeOldBlobId;
    try {
      maybeOldBlobId = this.#stmts.putPart(key, {
        upload_id: uploadId,
        part_number: partNumber,
        blob_id: blobId,
        size: valueSize,
        etag,
        checksum_md5: md5Digest.toString("hex")
      });
    } catch (e) {
      throw this.#backgroundDelete(blobId), e;
    }
    return maybeOldBlobId !== void 0 && this.#backgroundDelete(maybeOldBlobId), { etag };
  }
  async #completeMultipartUpload(key, uploadId, parts) {
    validate.key(key);
    let minPartSize = this.beingTested ? R2Limits.MIN_MULTIPART_PART_SIZE_TEST : R2Limits.MIN_MULTIPART_PART_SIZE, { newRow, oldBlobIds } = this.#stmts.completeMultipartUpload(
      key,
      uploadId,
      parts,
      minPartSize
    );
    for (let blobId of oldBlobIds) this.#backgroundDelete(blobId);
    return new InternalR2Object(newRow);
  }
  async #abortMultipartUpload(key, uploadId) {
    validate.key(key);
    let oldBlobIds = this.#stmts.abortMultipartUpload(key, uploadId);
    for (let blobId of oldBlobIds) this.#backgroundDelete(blobId);
  }
  get = async (req) => {
    let metadata = decodeHeaderMetadata(req), result;
    if (metadata.method === "head")
      result = await this.#head(metadata.object);
    else if (metadata.method === "get")
      result = await this.#get(metadata.object, metadata);
    else if (metadata.method === "list")
      result = await this.#list(metadata);
    else
      throw new InternalError();
    return encodeResult(result);
  };
  put = async (req) => {
    let { metadata, metadataSize, value } = await decodeMetadata(req);
    if (metadata.method === "delete")
      return await this.#delete(
        "object" in metadata ? metadata.object : metadata.objects
      ), new Response();
    if (metadata.method === "put") {
      let contentLength = parseInt(req.headers.get("Content-Length"));
      assert2(!isNaN(contentLength));
      let valueSize = contentLength - metadataSize, result = await this.#put(
        metadata.object,
        value,
        valueSize,
        metadata
      );
      return encodeResult(result);
    } else if (metadata.method === "createMultipartUpload") {
      let result = await this.#createMultipartUpload(
        metadata.object,
        metadata
      );
      return encodeJSONResult(result);
    } else if (metadata.method === "uploadPart") {
      let contentLength = parseInt(req.headers.get("Content-Length"));
      assert2(!isNaN(contentLength));
      let valueSize = contentLength - metadataSize, result = await this.#uploadPart(
        metadata.object,
        metadata.uploadId,
        metadata.partNumber,
        value,
        valueSize
      );
      return encodeJSONResult(result);
    } else if (metadata.method === "completeMultipartUpload") {
      let result = await this.#completeMultipartUpload(
        metadata.object,
        metadata.uploadId,
        metadata.parts
      );
      return encodeResult(result);
    } else {
      if (metadata.method === "abortMultipartUpload")
        return await this.#abortMultipartUpload(metadata.object, metadata.uploadId), new Response();
      throw new InternalError();
    }
  };
};
__decorateClass([
  GET("/")
], R2BucketObject.prototype, "get", 2), __decorateClass([
  PUT("/")
], R2BucketObject.prototype, "put", 2);
export {
  R2BucketObject
};
//# sourceMappingURL=bucket.worker.js.map
