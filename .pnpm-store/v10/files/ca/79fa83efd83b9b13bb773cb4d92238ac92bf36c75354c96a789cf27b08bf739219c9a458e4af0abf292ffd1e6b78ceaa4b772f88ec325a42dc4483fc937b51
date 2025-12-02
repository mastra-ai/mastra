var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  for (var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target, i = decorators.length - 1, decorator; i >= 0; i--)
    (decorator = decorators[i]) && (result = (kind ? decorator(target, key, result) : decorator(result)) || result);
  return kind && result && __defProp(target, key, result), result;
};

// src/workers/queues/broker.worker.ts
import assert from "node:assert";
import { Buffer as Buffer2 } from "node:buffer";

// ../../node_modules/.pnpm/kleur@4.1.5/node_modules/kleur/colors.mjs
var FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, isTTY = !0;
typeof process < "u" && ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {}, isTTY = process.stdout && process.stdout.isTTY);
var $ = {
  enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY)
};
function init(x, y) {
  let rgx = new RegExp(`\\x1b\\[${y}m`, "g"), open = `\x1B[${x}m`, close = `\x1B[${y}m`;
  return function(txt) {
    return !$.enabled || txt == null ? txt : open + (~("" + txt).indexOf(close) ? txt.replace(rgx, close + open) : txt) + close;
  };
}
var reset = init(0, 0), bold = init(1, 22), dim = init(2, 22), italic = init(3, 23), underline = init(4, 24), inverse = init(7, 27), hidden = init(8, 28), strikethrough = init(9, 29), black = init(30, 39), red = init(31, 39), green = init(32, 39), yellow = init(33, 39), blue = init(34, 39), magenta = init(35, 39), cyan = init(36, 39), white = init(37, 39), gray = init(90, 39), grey = init(90, 39), bgBlack = init(40, 49), bgRed = init(41, 49), bgGreen = init(42, 49), bgYellow = init(43, 49), bgBlue = init(44, 49), bgMagenta = init(45, 49), bgCyan = init(46, 49), bgWhite = init(47, 49);

// src/workers/queues/broker.worker.ts
import {
  HttpError,
  LogLevel,
  MiniflareDurableObject,
  POST,
  SharedBindings,
  viewToBuffer
} from "miniflare:shared";

// src/workers/queues/constants.ts
var QueueBindings = {
  SERVICE_WORKER_PREFIX: "MINIFLARE_WORKER_",
  MAYBE_JSON_QUEUE_PRODUCERS: "MINIFLARE_QUEUE_PRODUCERS",
  MAYBE_JSON_QUEUE_CONSUMERS: "MINIFLARE_QUEUE_CONSUMERS"
};

// src/workers/queues/schemas.ts
import { Base64DataSchema, z } from "miniflare:zod";
var QueueMessageDelaySchema = z.number().int().min(0).max(43200).optional(), QueueProducerOptionsSchema = /* @__PURE__ */ z.object({
  // https://developers.cloudflare.com/queues/platform/configuration/#producer
  queueName: z.string(),
  deliveryDelay: QueueMessageDelaySchema
}), QueueProducerSchema = /* @__PURE__ */ z.intersection(
  QueueProducerOptionsSchema,
  z.object({ workerName: z.string() })
), QueueProducersSchema = /* @__PURE__ */ z.record(QueueProducerSchema), QueueConsumerOptionsSchema = /* @__PURE__ */ z.object({
  // https://developers.cloudflare.com/queues/platform/configuration/#consumer
  // https://developers.cloudflare.com/queues/platform/limits/
  maxBatchSize: z.number().min(0).max(100).optional(),
  maxBatchTimeout: z.number().min(0).max(60).optional(),
  // seconds
  maxRetires: z.number().min(0).max(100).optional(),
  // deprecated
  maxRetries: z.number().min(0).max(100).optional(),
  deadLetterQueue: z.ostring(),
  retryDelay: QueueMessageDelaySchema
}).transform((queue) => (queue.maxRetires !== void 0 && (queue.maxRetries = queue.maxRetires), queue)), QueueConsumerSchema = /* @__PURE__ */ z.intersection(
  QueueConsumerOptionsSchema,
  z.object({ workerName: z.string() })
), QueueConsumersSchema = /* @__PURE__ */ z.record(QueueConsumerSchema), QueueContentTypeSchema = /* @__PURE__ */ z.enum(["text", "json", "bytes", "v8"]).default("v8"), QueueIncomingMessageSchema = /* @__PURE__ */ z.object({
  contentType: QueueContentTypeSchema,
  delaySecs: QueueMessageDelaySchema,
  body: Base64DataSchema,
  // When enqueuing messages on dead-letter queues, we want to reuse the same ID
  // and timestamp
  id: z.ostring(),
  timestamp: z.onumber()
}), QueuesBatchRequestSchema = /* @__PURE__ */ z.object({
  messages: z.array(QueueIncomingMessageSchema)
});

// src/workers/queues/broker.worker.ts
var MAX_MESSAGE_SIZE_BYTES = 128 * 1e3, MAX_MESSAGE_BATCH_COUNT = 100, MAX_MESSAGE_BATCH_SIZE = 288 * 1e3, DEFAULT_BATCH_SIZE = 5, DEFAULT_BATCH_TIMEOUT = 1, DEFAULT_RETRIES = 2, exceptionQueueResponse = {
  outcome: "exception",
  retryBatch: { retry: !1 },
  ackAll: !1,
  retryMessages: [],
  explicitAcks: []
}, PayloadTooLargeError = class extends HttpError {
  constructor(message) {
    super(413, message);
  }
};
function validateMessageSize(headers) {
  let size = headers.get("Content-Length");
  if (size !== null && parseInt(size) > MAX_MESSAGE_SIZE_BYTES)
    throw new PayloadTooLargeError(
      `message length of ${size} bytes exceeds limit of ${MAX_MESSAGE_SIZE_BYTES}`
    );
}
function validateContentType(headers) {
  let format = headers.get("X-Msg-Fmt") ?? void 0, result = QueueContentTypeSchema.safeParse(format);
  if (!result.success)
    throw new HttpError(
      400,
      `message content type ${format} is invalid; if specified, must be one of 'text', 'json', 'bytes', or 'v8'`
    );
  return result.data;
}
function validateMessageDelay(headers) {
  let format = headers.get("X-Msg-Delay-Secs");
  if (!format) return;
  let result = QueueMessageDelaySchema.safeParse(Number(format));
  if (!result.success)
    throw new HttpError(
      400,
      `message delay ${format} is invalid: ${result.error}`
    );
  return result.data;
}
function validateBatchSize(headers) {
  let count = headers.get("CF-Queue-Batch-Count");
  if (count !== null && parseInt(count) > MAX_MESSAGE_BATCH_COUNT)
    throw new PayloadTooLargeError(
      `batch message count of ${count} exceeds limit of ${MAX_MESSAGE_BATCH_COUNT}`
    );
  let largestSize = headers.get("CF-Queue-Largest-Msg");
  if (largestSize !== null && parseInt(largestSize) > MAX_MESSAGE_SIZE_BYTES)
    throw new PayloadTooLargeError(
      `message in batch has length ${largestSize} bytes which exceeds single message size limit of ${MAX_MESSAGE_SIZE_BYTES}`
    );
  let batchSize = headers.get("CF-Queue-Batch-Bytes");
  if (batchSize !== null && parseInt(batchSize) > MAX_MESSAGE_BATCH_SIZE)
    throw new PayloadTooLargeError(
      `batch size of ${batchSize} bytes exceeds limit of 256000`
    );
}
function deserialise({ contentType, body }) {
  return contentType === "text" ? { contentType, body: body.toString() } : contentType === "json" ? { contentType, body: JSON.parse(body.toString()) } : contentType === "bytes" ? { contentType, body: viewToBuffer(body) } : { contentType, body };
}
function serialise(msg) {
  let body;
  return msg.body.contentType === "text" ? body = Buffer2.from(msg.body.body) : msg.body.contentType === "json" ? body = Buffer2.from(JSON.stringify(msg.body.body)) : msg.body.contentType === "bytes" ? body = Buffer2.from(msg.body.body) : body = msg.body.body, {
    id: msg.id,
    timestamp: msg.timestamp.getTime(),
    contentType: msg.body.contentType,
    body: body.toString("base64")
  };
}
var QueueMessage = class {
  constructor(id, timestamp, body) {
    this.id = id;
    this.timestamp = timestamp;
    this.body = body;
  }
  #failedAttempts = 0;
  incrementFailedAttempts() {
    return ++this.#failedAttempts;
  }
  get failedAttempts() {
    return this.#failedAttempts;
  }
};
function formatQueueResponse(queueName, acked, total, time) {
  let colour;
  acked === total ? colour = green : acked > 0 ? colour = yellow : colour = red;
  let message = `${bold("QUEUE")} ${queueName} ${colour(`${acked}/${total}`)}`;
  return time !== void 0 && (message += grey(` (${time}ms)`)), reset(message);
}
var QueueBrokerObject = class extends MiniflareDurableObject {
  #producers;
  #consumers;
  #messages = [];
  #pendingFlush;
  constructor(state, env) {
    super(state, env);
    let maybeProducers = env[QueueBindings.MAYBE_JSON_QUEUE_PRODUCERS];
    maybeProducers === void 0 ? this.#producers = {} : this.#producers = QueueProducersSchema.parse(maybeProducers);
    let maybeConsumers = env[QueueBindings.MAYBE_JSON_QUEUE_CONSUMERS];
    maybeConsumers === void 0 ? this.#consumers = {} : this.#consumers = QueueConsumersSchema.parse(maybeConsumers);
  }
  get #maybeProducer() {
    return Object.values(this.#producers).find(
      (p) => p?.queueName === this.name
    );
  }
  get #maybeConsumer() {
    return this.#consumers[this.name];
  }
  #dispatchBatch(workerName, batch) {
    let bindingName = `${QueueBindings.SERVICE_WORKER_PREFIX}${workerName}`, maybeService = this.env[bindingName];
    assert(
      maybeService !== void 0,
      `Expected ${bindingName} service binding`
    );
    let messages = batch.map(({ id, timestamp, body, failedAttempts }) => {
      let attempts = failedAttempts + 1;
      return body.contentType === "v8" ? { id, timestamp, serializedBody: body.body, attempts } : { id, timestamp, body: body.body, attempts };
    });
    return maybeService.queue(this.name, messages);
  }
  #flush = async () => {
    let consumer = this.#maybeConsumer;
    assert(consumer !== void 0);
    let batchSize = consumer.maxBatchSize ?? DEFAULT_BATCH_SIZE, maxAttempts = (consumer.maxRetries ?? DEFAULT_RETRIES) + 1, maxAttemptsS = maxAttempts === 1 ? "" : "s", batch = this.#messages.splice(0, batchSize), startTime = Date.now(), endTime, response;
    try {
      response = await this.#dispatchBatch(consumer.workerName, batch), endTime = Date.now();
    } catch (e) {
      endTime = Date.now(), await this.logWithLevel(LogLevel.ERROR, String(e)), response = exceptionQueueResponse;
    }
    let retryAll = response.retryBatch.retry || response.outcome !== "ok", retryMessages = new Map(
      response.retryMessages?.map((r) => [r.msgId, r.delaySeconds])
    ), globalDelay = response.retryBatch.delaySeconds ?? consumer.retryDelay ?? 0, failedMessages = 0, toDeadLetterQueue = [];
    for (let message of batch)
      if (retryAll || retryMessages.has(message.id))
        if (failedMessages++, message.incrementFailedAttempts() < maxAttempts) {
          await this.logWithLevel(
            LogLevel.DEBUG,
            `Retrying message "${message.id}" on queue "${this.name}"...`
          );
          let fn = () => {
            this.#messages.push(message), this.#ensurePendingFlush();
          }, delay = retryMessages.get(message.id) ?? globalDelay;
          this.timers.setTimeout(fn, delay * 1e3);
        } else consumer.deadLetterQueue !== void 0 ? (await this.logWithLevel(
          LogLevel.WARN,
          `Moving message "${message.id}" on queue "${this.name}" to dead letter queue "${consumer.deadLetterQueue}" after ${maxAttempts} failed attempt${maxAttemptsS}...`
        ), toDeadLetterQueue.push(message)) : await this.logWithLevel(
          LogLevel.WARN,
          `Dropped message "${message.id}" on queue "${this.name}" after ${maxAttempts} failed attempt${maxAttemptsS}!`
        );
    let acked = batch.length - failedMessages;
    if (await this.logWithLevel(
      LogLevel.INFO,
      formatQueueResponse(this.name, acked, batch.length, endTime - startTime)
    ), this.#pendingFlush = void 0, this.#messages.length > 0 && this.#ensurePendingFlush(), toDeadLetterQueue.length > 0) {
      let name = consumer.deadLetterQueue;
      assert(name !== void 0);
      let ns = this.env[SharedBindings.DURABLE_OBJECT_NAMESPACE_OBJECT], id = ns.idFromName(name), stub = ns.get(id), cf = { miniflare: { name } }, batchRequest = {
        messages: toDeadLetterQueue.map(serialise)
      }, res = await stub.fetch("http://placeholder/batch", {
        method: "POST",
        body: JSON.stringify(batchRequest),
        cf
      });
      assert(res.ok);
    }
  };
  #ensurePendingFlush() {
    let consumer = this.#maybeConsumer;
    assert(consumer !== void 0);
    let batchSize = consumer.maxBatchSize ?? DEFAULT_BATCH_SIZE, batchTimeout = consumer.maxBatchTimeout ?? DEFAULT_BATCH_TIMEOUT, batchHasSpace = this.#messages.length < batchSize;
    if (this.#pendingFlush !== void 0) {
      if (this.#pendingFlush.immediate || batchHasSpace) return;
      this.timers.clearTimeout(this.#pendingFlush.timeout), this.#pendingFlush = void 0;
    }
    let delay = batchHasSpace ? batchTimeout * 1e3 : 0, timeout = this.timers.setTimeout(this.#flush, delay);
    this.#pendingFlush = { immediate: delay === 0, timeout };
  }
  #enqueue(messages, globalDelay = 0) {
    for (let message of messages) {
      let randomness = crypto.getRandomValues(new Uint8Array(16)), id = message.id ?? Buffer2.from(randomness).toString("hex"), timestamp = new Date(message.timestamp ?? this.timers.now()), body = deserialise(message), msg = new QueueMessage(id, timestamp, body), fn = () => {
        this.#messages.push(msg), this.#ensurePendingFlush();
      }, delay = message.delaySecs ?? globalDelay;
      this.timers.setTimeout(fn, delay * 1e3);
    }
  }
  message = async (req) => {
    if (this.#maybeConsumer === void 0) return new Response();
    validateMessageSize(req.headers);
    let contentType = validateContentType(req.headers), delay = validateMessageDelay(req.headers) ?? this.#maybeProducer?.deliveryDelay, body = Buffer2.from(await req.arrayBuffer());
    return this.#enqueue(
      [{ contentType, delaySecs: delay, body }],
      this.#maybeProducer?.deliveryDelay
    ), new Response();
  };
  batch = async (req) => {
    if (this.#maybeConsumer === void 0) return new Response();
    validateBatchSize(req.headers);
    let delay = validateMessageDelay(req.headers) ?? this.#maybeProducer?.deliveryDelay, body = QueuesBatchRequestSchema.parse(await req.json());
    return this.#enqueue(body.messages, delay), new Response();
  };
};
__decorateClass([
  POST("/message")
], QueueBrokerObject.prototype, "message", 2), __decorateClass([
  POST("/batch")
], QueueBrokerObject.prototype, "batch", 2);
export {
  QueueBrokerObject
};
//# sourceMappingURL=broker.worker.js.map
