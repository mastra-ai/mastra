var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name17 in all)
    __defProp(target, name17, { get: all[name17], enumerable: true });
};

// core/index.ts
import { createIdGenerator as createIdGenerator5, generateId as generateId2 } from "@ai-sdk/provider-utils";
import {
  formatAssistantStreamPart,
  formatDataStreamPart as formatDataStreamPart3,
  jsonSchema as jsonSchema2,
  parseAssistantStreamPart,
  parseDataStreamPart,
  processDataStream,
  processTextStream,
  zodSchema
} from "@ai-sdk/ui-utils";

// core/data-stream/create-data-stream.ts
import { formatDataStreamPart } from "@ai-sdk/ui-utils";
function createDataStream({
  execute,
  onError = () => "An error occurred."
  // mask error messages for safety by default
}) {
  let controller;
  const ongoingStreamPromises = [];
  const stream = new ReadableStream({
    start(controllerArg) {
      controller = controllerArg;
    }
  });
  function safeEnqueue(data) {
    try {
      controller.enqueue(data);
    } catch (error) {
    }
  }
  try {
    const result = execute({
      write(data) {
        safeEnqueue(data);
      },
      writeData(data) {
        safeEnqueue(formatDataStreamPart("data", [data]));
      },
      writeMessageAnnotation(annotation) {
        safeEnqueue(formatDataStreamPart("message_annotations", [annotation]));
      },
      writeSource(source) {
        safeEnqueue(formatDataStreamPart("source", source));
      },
      merge(streamArg) {
        ongoingStreamPromises.push(
          (async () => {
            const reader = streamArg.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done)
                break;
              safeEnqueue(value);
            }
          })().catch((error) => {
            safeEnqueue(formatDataStreamPart("error", onError(error)));
          })
        );
      },
      onError
    });
    if (result) {
      ongoingStreamPromises.push(
        result.catch((error) => {
          safeEnqueue(formatDataStreamPart("error", onError(error)));
        })
      );
    }
  } catch (error) {
    safeEnqueue(formatDataStreamPart("error", onError(error)));
  }
  const waitForStreams = new Promise(async (resolve) => {
    while (ongoingStreamPromises.length > 0) {
      await ongoingStreamPromises.shift();
    }
    resolve();
  });
  waitForStreams.finally(() => {
    try {
      controller.close();
    } catch (error) {
    }
  });
  return stream;
}

// core/util/prepare-response-headers.ts
function prepareResponseHeaders(headers, {
  contentType,
  dataStreamVersion
}) {
  const responseHeaders = new Headers(headers != null ? headers : {});
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", contentType);
  }
  if (dataStreamVersion !== void 0) {
    responseHeaders.set("X-Vercel-AI-Data-Stream", dataStreamVersion);
  }
  return responseHeaders;
}

// core/data-stream/create-data-stream-response.ts
function createDataStreamResponse({
  status,
  statusText,
  headers,
  execute,
  onError
}) {
  return new Response(
    createDataStream({ execute, onError }).pipeThrough(new TextEncoderStream()),
    {
      status,
      statusText,
      headers: prepareResponseHeaders(headers, {
        contentType: "text/plain; charset=utf-8",
        dataStreamVersion: "v1"
      })
    }
  );
}

// core/util/prepare-outgoing-http-headers.ts
function prepareOutgoingHttpHeaders(headers, {
  contentType,
  dataStreamVersion
}) {
  const outgoingHeaders = {};
  if (headers != null) {
    for (const [key, value] of Object.entries(headers)) {
      outgoingHeaders[key] = value;
    }
  }
  if (outgoingHeaders["Content-Type"] == null) {
    outgoingHeaders["Content-Type"] = contentType;
  }
  if (dataStreamVersion !== void 0) {
    outgoingHeaders["X-Vercel-AI-Data-Stream"] = dataStreamVersion;
  }
  return outgoingHeaders;
}

// core/util/write-to-server-response.ts
function writeToServerResponse({
  response,
  status,
  statusText,
  headers,
  stream
}) {
  response.writeHead(status != null ? status : 200, statusText, headers);
  const reader = stream.getReader();
  const read = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        response.write(value);
      }
    } catch (error) {
      throw error;
    } finally {
      response.end();
    }
  };
  read();
}

// core/data-stream/pipe-data-stream-to-response.ts
function pipeDataStreamToResponse(response, {
  status,
  statusText,
  headers,
  execute,
  onError
}) {
  writeToServerResponse({
    response,
    status,
    statusText,
    headers: prepareOutgoingHttpHeaders(headers, {
      contentType: "text/plain; charset=utf-8",
      dataStreamVersion: "v1"
    }),
    stream: createDataStream({ execute, onError }).pipeThrough(
      new TextEncoderStream()
    )
  });
}

// errors/unsupported-model-version-error.ts
import { AISDKError } from "@ai-sdk/provider";
var UnsupportedModelVersionError = class extends AISDKError {
  constructor() {
    super({
      name: "AI_UnsupportedModelVersionError",
      message: `Unsupported model version. AI SDK 4 only supports models that implement specification version "v1". Please upgrade to AI SDK 5 to use this model.`
    });
  }
};

// errors/invalid-argument-error.ts
import { AISDKError as AISDKError2 } from "@ai-sdk/provider";
var name = "AI_InvalidArgumentError";
var marker = `vercel.ai.error.${name}`;
var symbol = Symbol.for(marker);
var _a;
var InvalidArgumentError = class extends AISDKError2 {
  constructor({
    parameter,
    value,
    message
  }) {
    super({
      name,
      message: `Invalid argument for parameter ${parameter}: ${message}`
    });
    this[_a] = true;
    this.parameter = parameter;
    this.value = value;
  }
  static isInstance(error) {
    return AISDKError2.hasMarker(error, marker);
  }
};
_a = symbol;

// util/retry-with-exponential-backoff.ts
import { APICallError } from "@ai-sdk/provider";
import { delay, getErrorMessage, isAbortError } from "@ai-sdk/provider-utils";

// util/retry-error.ts
import { AISDKError as AISDKError3 } from "@ai-sdk/provider";
var name2 = "AI_RetryError";
var marker2 = `vercel.ai.error.${name2}`;
var symbol2 = Symbol.for(marker2);
var _a2;
var RetryError = class extends AISDKError3 {
  constructor({
    message,
    reason,
    errors
  }) {
    super({ name: name2, message });
    this[_a2] = true;
    this.reason = reason;
    this.errors = errors;
    this.lastError = errors[errors.length - 1];
  }
  static isInstance(error) {
    return AISDKError3.hasMarker(error, marker2);
  }
};
_a2 = symbol2;

// util/retry-with-exponential-backoff.ts
var retryWithExponentialBackoff = ({
  maxRetries = 2,
  initialDelayInMs = 2e3,
  backoffFactor = 2
} = {}) => async (f) => _retryWithExponentialBackoff(f, {
  maxRetries,
  delayInMs: initialDelayInMs,
  backoffFactor
});
async function _retryWithExponentialBackoff(f, {
  maxRetries,
  delayInMs,
  backoffFactor
}, errors = []) {
  try {
    return await f();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (maxRetries === 0) {
      throw error;
    }
    const errorMessage = getErrorMessage(error);
    const newErrors = [...errors, error];
    const tryNumber = newErrors.length;
    if (tryNumber > maxRetries) {
      throw new RetryError({
        message: `Failed after ${tryNumber} attempts. Last error: ${errorMessage}`,
        reason: "maxRetriesExceeded",
        errors: newErrors
      });
    }
    if (error instanceof Error && APICallError.isInstance(error) && error.isRetryable === true && tryNumber <= maxRetries) {
      await delay(delayInMs);
      return _retryWithExponentialBackoff(
        f,
        { maxRetries, delayInMs: backoffFactor * delayInMs, backoffFactor },
        newErrors
      );
    }
    if (tryNumber === 1) {
      throw error;
    }
    throw new RetryError({
      message: `Failed after ${tryNumber} attempts with non-retryable error: '${errorMessage}'`,
      reason: "errorNotRetryable",
      errors: newErrors
    });
  }
}

// core/prompt/prepare-retries.ts
function prepareRetries({
  maxRetries
}) {
  if (maxRetries != null) {
    if (!Number.isInteger(maxRetries)) {
      throw new InvalidArgumentError({
        parameter: "maxRetries",
        value: maxRetries,
        message: "maxRetries must be an integer"
      });
    }
    if (maxRetries < 0) {
      throw new InvalidArgumentError({
        parameter: "maxRetries",
        value: maxRetries,
        message: "maxRetries must be >= 0"
      });
    }
  }
  const maxRetriesResult = maxRetries != null ? maxRetries : 2;
  return {
    maxRetries: maxRetriesResult,
    retry: retryWithExponentialBackoff({ maxRetries: maxRetriesResult })
  };
}

// core/telemetry/assemble-operation-name.ts
function assembleOperationName({
  operationId,
  telemetry
}) {
  return {
    // standardized operation and resource name:
    "operation.name": `${operationId}${(telemetry == null ? void 0 : telemetry.functionId) != null ? ` ${telemetry.functionId}` : ""}`,
    "resource.name": telemetry == null ? void 0 : telemetry.functionId,
    // detailed, AI SDK specific data:
    "ai.operationId": operationId,
    "ai.telemetry.functionId": telemetry == null ? void 0 : telemetry.functionId
  };
}

// core/telemetry/get-base-telemetry-attributes.ts
function getBaseTelemetryAttributes({
  model,
  settings,
  telemetry,
  headers
}) {
  var _a17;
  return {
    "ai.model.provider": model.provider,
    "ai.model.id": model.modelId,
    // settings:
    ...Object.entries(settings).reduce((attributes, [key, value]) => {
      attributes[`ai.settings.${key}`] = value;
      return attributes;
    }, {}),
    // add metadata as attributes:
    ...Object.entries((_a17 = telemetry == null ? void 0 : telemetry.metadata) != null ? _a17 : {}).reduce(
      (attributes, [key, value]) => {
        attributes[`ai.telemetry.metadata.${key}`] = value;
        return attributes;
      },
      {}
    ),
    // request headers
    ...Object.entries(headers != null ? headers : {}).reduce((attributes, [key, value]) => {
      if (value !== void 0) {
        attributes[`ai.request.headers.${key}`] = value;
      }
      return attributes;
    }, {})
  };
}

// core/telemetry/get-tracer.ts
import { trace } from "@opentelemetry/api";

// core/telemetry/noop-tracer.ts
var noopTracer = {
  startSpan() {
    return noopSpan;
  },
  startActiveSpan(name17, arg1, arg2, arg3) {
    if (typeof arg1 === "function") {
      return arg1(noopSpan);
    }
    if (typeof arg2 === "function") {
      return arg2(noopSpan);
    }
    if (typeof arg3 === "function") {
      return arg3(noopSpan);
    }
  }
};
var noopSpan = {
  spanContext() {
    return noopSpanContext;
  },
  setAttribute() {
    return this;
  },
  setAttributes() {
    return this;
  },
  addEvent() {
    return this;
  },
  addLink() {
    return this;
  },
  addLinks() {
    return this;
  },
  setStatus() {
    return this;
  },
  updateName() {
    return this;
  },
  end() {
    return this;
  },
  isRecording() {
    return false;
  },
  recordException() {
    return this;
  }
};
var noopSpanContext = {
  traceId: "",
  spanId: "",
  traceFlags: 0
};

// core/telemetry/get-tracer.ts
function getTracer({
  isEnabled = false,
  tracer
} = {}) {
  if (!isEnabled) {
    return noopTracer;
  }
  if (tracer) {
    return tracer;
  }
  return trace.getTracer("ai");
}

// core/telemetry/record-span.ts
import { SpanStatusCode } from "@opentelemetry/api";
function recordSpan({
  name: name17,
  tracer,
  attributes,
  fn,
  endWhenDone = true
}) {
  return tracer.startActiveSpan(name17, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      if (endWhenDone) {
        span.end();
      }
      return result;
    } catch (error) {
      try {
        recordErrorOnSpan(span, error);
      } finally {
        span.end();
      }
      throw error;
    }
  });
}
function recordErrorOnSpan(span, error) {
  if (error instanceof Error) {
    span.recordException({
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
  } else {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}

// core/telemetry/select-telemetry-attributes.ts
function selectTelemetryAttributes({
  telemetry,
  attributes
}) {
  if ((telemetry == null ? void 0 : telemetry.isEnabled) !== true) {
    return {};
  }
  return Object.entries(attributes).reduce((attributes2, [key, value]) => {
    if (value === void 0) {
      return attributes2;
    }
    if (typeof value === "object" && "input" in value && typeof value.input === "function") {
      if ((telemetry == null ? void 0 : telemetry.recordInputs) === false) {
        return attributes2;
      }
      const result = value.input();
      return result === void 0 ? attributes2 : { ...attributes2, [key]: result };
    }
    if (typeof value === "object" && "output" in value && typeof value.output === "function") {
      if ((telemetry == null ? void 0 : telemetry.recordOutputs) === false) {
        return attributes2;
      }
      const result = value.output();
      return result === void 0 ? attributes2 : { ...attributes2, [key]: result };
    }
    return { ...attributes2, [key]: value };
  }, {});
}

// core/embed/embed.ts
async function embed({
  model,
  value,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  experimental_telemetry: telemetry
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  const { maxRetries, retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model,
    telemetry,
    headers,
    settings: { maxRetries }
  });
  const tracer = getTracer(telemetry);
  return recordSpan({
    name: "ai.embed",
    attributes: selectTelemetryAttributes({
      telemetry,
      attributes: {
        ...assembleOperationName({ operationId: "ai.embed", telemetry }),
        ...baseTelemetryAttributes,
        "ai.value": { input: () => JSON.stringify(value) }
      }
    }),
    tracer,
    fn: async (span) => {
      const { embedding, usage, rawResponse } = await retry(
        () => (
          // nested spans to align with the embedMany telemetry data:
          recordSpan({
            name: "ai.embed.doEmbed",
            attributes: selectTelemetryAttributes({
              telemetry,
              attributes: {
                ...assembleOperationName({
                  operationId: "ai.embed.doEmbed",
                  telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.values": { input: () => [JSON.stringify(value)] }
              }
            }),
            tracer,
            fn: async (doEmbedSpan) => {
              var _a17;
              const modelResponse = await model.doEmbed({
                values: [value],
                abortSignal,
                headers
              });
              const embedding2 = modelResponse.embeddings[0];
              const usage2 = (_a17 = modelResponse.usage) != null ? _a17 : { tokens: NaN };
              doEmbedSpan.setAttributes(
                selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    "ai.embeddings": {
                      output: () => modelResponse.embeddings.map(
                        (embedding3) => JSON.stringify(embedding3)
                      )
                    },
                    "ai.usage.tokens": usage2.tokens
                  }
                })
              );
              return {
                embedding: embedding2,
                usage: usage2,
                rawResponse: modelResponse.rawResponse
              };
            }
          })
        )
      );
      span.setAttributes(
        selectTelemetryAttributes({
          telemetry,
          attributes: {
            "ai.embedding": { output: () => JSON.stringify(embedding) },
            "ai.usage.tokens": usage.tokens
          }
        })
      );
      return new DefaultEmbedResult({ value, embedding, usage, rawResponse });
    }
  });
}
var DefaultEmbedResult = class {
  constructor(options) {
    this.value = options.value;
    this.embedding = options.embedding;
    this.usage = options.usage;
    this.rawResponse = options.rawResponse;
  }
};

// core/util/split-array.ts
function splitArray(array, chunkSize) {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

// core/embed/embed-many.ts
async function embedMany({
  model,
  values,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  experimental_telemetry: telemetry
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  const { maxRetries, retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model,
    telemetry,
    headers,
    settings: { maxRetries }
  });
  const tracer = getTracer(telemetry);
  return recordSpan({
    name: "ai.embedMany",
    attributes: selectTelemetryAttributes({
      telemetry,
      attributes: {
        ...assembleOperationName({ operationId: "ai.embedMany", telemetry }),
        ...baseTelemetryAttributes,
        // specific settings that only make sense on the outer level:
        "ai.values": {
          input: () => values.map((value) => JSON.stringify(value))
        }
      }
    }),
    tracer,
    fn: async (span) => {
      const maxEmbeddingsPerCall = model.maxEmbeddingsPerCall;
      if (maxEmbeddingsPerCall == null) {
        const { embeddings: embeddings2, usage } = await retry(() => {
          return recordSpan({
            name: "ai.embedMany.doEmbed",
            attributes: selectTelemetryAttributes({
              telemetry,
              attributes: {
                ...assembleOperationName({
                  operationId: "ai.embedMany.doEmbed",
                  telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.values": {
                  input: () => values.map((value) => JSON.stringify(value))
                }
              }
            }),
            tracer,
            fn: async (doEmbedSpan) => {
              var _a17;
              const modelResponse = await model.doEmbed({
                values,
                abortSignal,
                headers
              });
              const embeddings3 = modelResponse.embeddings;
              const usage2 = (_a17 = modelResponse.usage) != null ? _a17 : { tokens: NaN };
              doEmbedSpan.setAttributes(
                selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    "ai.embeddings": {
                      output: () => embeddings3.map((embedding) => JSON.stringify(embedding))
                    },
                    "ai.usage.tokens": usage2.tokens
                  }
                })
              );
              return { embeddings: embeddings3, usage: usage2 };
            }
          });
        });
        span.setAttributes(
          selectTelemetryAttributes({
            telemetry,
            attributes: {
              "ai.embeddings": {
                output: () => embeddings2.map((embedding) => JSON.stringify(embedding))
              },
              "ai.usage.tokens": usage.tokens
            }
          })
        );
        return new DefaultEmbedManyResult({ values, embeddings: embeddings2, usage });
      }
      const valueChunks = splitArray(values, maxEmbeddingsPerCall);
      const embeddings = [];
      let tokens = 0;
      for (const chunk of valueChunks) {
        const { embeddings: responseEmbeddings, usage } = await retry(() => {
          return recordSpan({
            name: "ai.embedMany.doEmbed",
            attributes: selectTelemetryAttributes({
              telemetry,
              attributes: {
                ...assembleOperationName({
                  operationId: "ai.embedMany.doEmbed",
                  telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.values": {
                  input: () => chunk.map((value) => JSON.stringify(value))
                }
              }
            }),
            tracer,
            fn: async (doEmbedSpan) => {
              var _a17;
              const modelResponse = await model.doEmbed({
                values: chunk,
                abortSignal,
                headers
              });
              const embeddings2 = modelResponse.embeddings;
              const usage2 = (_a17 = modelResponse.usage) != null ? _a17 : { tokens: NaN };
              doEmbedSpan.setAttributes(
                selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    "ai.embeddings": {
                      output: () => embeddings2.map((embedding) => JSON.stringify(embedding))
                    },
                    "ai.usage.tokens": usage2.tokens
                  }
                })
              );
              return { embeddings: embeddings2, usage: usage2 };
            }
          });
        });
        embeddings.push(...responseEmbeddings);
        tokens += usage.tokens;
      }
      span.setAttributes(
        selectTelemetryAttributes({
          telemetry,
          attributes: {
            "ai.embeddings": {
              output: () => embeddings.map((embedding) => JSON.stringify(embedding))
            },
            "ai.usage.tokens": tokens
          }
        })
      );
      return new DefaultEmbedManyResult({
        values,
        embeddings,
        usage: { tokens }
      });
    }
  });
}
var DefaultEmbedManyResult = class {
  constructor(options) {
    this.values = options.values;
    this.embeddings = options.embeddings;
    this.usage = options.usage;
  }
};

// errors/no-image-generated-error.ts
import { AISDKError as AISDKError4 } from "@ai-sdk/provider";
var name3 = "AI_NoImageGeneratedError";
var marker3 = `vercel.ai.error.${name3}`;
var symbol3 = Symbol.for(marker3);
var _a3;
var NoImageGeneratedError = class extends AISDKError4 {
  constructor({
    message = "No image generated.",
    cause,
    responses
  }) {
    super({ name: name3, message, cause });
    this[_a3] = true;
    this.responses = responses;
  }
  static isInstance(error) {
    return AISDKError4.hasMarker(error, marker3);
  }
};
_a3 = symbol3;

// core/generate-text/generated-file.ts
import {
  convertBase64ToUint8Array,
  convertUint8ArrayToBase64
} from "@ai-sdk/provider-utils";
var DefaultGeneratedFile = class {
  constructor({
    data,
    mimeType
  }) {
    const isUint8Array = data instanceof Uint8Array;
    this.base64Data = isUint8Array ? void 0 : data;
    this.uint8ArrayData = isUint8Array ? data : void 0;
    this.mimeType = mimeType;
  }
  // lazy conversion with caching to avoid unnecessary conversion overhead:
  get base64() {
    if (this.base64Data == null) {
      this.base64Data = convertUint8ArrayToBase64(this.uint8ArrayData);
    }
    return this.base64Data;
  }
  // lazy conversion with caching to avoid unnecessary conversion overhead:
  get uint8Array() {
    if (this.uint8ArrayData == null) {
      this.uint8ArrayData = convertBase64ToUint8Array(this.base64Data);
    }
    return this.uint8ArrayData;
  }
};
var DefaultGeneratedFileWithType = class extends DefaultGeneratedFile {
  constructor(options) {
    super(options);
    this.type = "file";
  }
};

// core/util/detect-mimetype.ts
import { convertBase64ToUint8Array as convertBase64ToUint8Array2 } from "@ai-sdk/provider-utils";
var imageMimeTypeSignatures = [
  {
    mimeType: "image/gif",
    bytesPrefix: [71, 73, 70],
    base64Prefix: "R0lG"
  },
  {
    mimeType: "image/png",
    bytesPrefix: [137, 80, 78, 71],
    base64Prefix: "iVBORw"
  },
  {
    mimeType: "image/jpeg",
    bytesPrefix: [255, 216],
    base64Prefix: "/9j/"
  },
  {
    mimeType: "image/webp",
    bytesPrefix: [82, 73, 70, 70],
    base64Prefix: "UklGRg"
  },
  {
    mimeType: "image/bmp",
    bytesPrefix: [66, 77],
    base64Prefix: "Qk"
  },
  {
    mimeType: "image/tiff",
    bytesPrefix: [73, 73, 42, 0],
    base64Prefix: "SUkqAA"
  },
  {
    mimeType: "image/tiff",
    bytesPrefix: [77, 77, 0, 42],
    base64Prefix: "TU0AKg"
  },
  {
    mimeType: "image/avif",
    bytesPrefix: [
      0,
      0,
      0,
      32,
      102,
      116,
      121,
      112,
      97,
      118,
      105,
      102
    ],
    base64Prefix: "AAAAIGZ0eXBhdmlm"
  },
  {
    mimeType: "image/heic",
    bytesPrefix: [
      0,
      0,
      0,
      32,
      102,
      116,
      121,
      112,
      104,
      101,
      105,
      99
    ],
    base64Prefix: "AAAAIGZ0eXBoZWlj"
  }
];
var audioMimeTypeSignatures = [
  {
    mimeType: "audio/mpeg",
    bytesPrefix: [255, 251],
    base64Prefix: "//s="
  },
  {
    mimeType: "audio/wav",
    bytesPrefix: [82, 73, 70, 70],
    base64Prefix: "UklGR"
  },
  {
    mimeType: "audio/ogg",
    bytesPrefix: [79, 103, 103, 83],
    base64Prefix: "T2dnUw"
  },
  {
    mimeType: "audio/flac",
    bytesPrefix: [102, 76, 97, 67],
    base64Prefix: "ZkxhQw"
  },
  {
    mimeType: "audio/aac",
    bytesPrefix: [64, 21, 0, 0],
    base64Prefix: "QBUA"
  },
  {
    mimeType: "audio/mp4",
    bytesPrefix: [102, 116, 121, 112],
    base64Prefix: "ZnR5cA"
  }
];
var stripID3 = (data) => {
  const bytes = typeof data === "string" ? convertBase64ToUint8Array2(data) : data;
  const id3Size = (bytes[6] & 127) << 21 | (bytes[7] & 127) << 14 | (bytes[8] & 127) << 7 | bytes[9] & 127;
  return bytes.slice(id3Size + 10);
};
function stripID3TagsIfPresent(data) {
  const hasId3 = typeof data === "string" && data.startsWith("SUQz") || typeof data !== "string" && data.length > 10 && data[0] === 73 && // 'I'
  data[1] === 68 && // 'D'
  data[2] === 51;
  return hasId3 ? stripID3(data) : data;
}
function detectMimeType({
  data,
  signatures
}) {
  const processedData = stripID3TagsIfPresent(data);
  for (const signature of signatures) {
    if (typeof processedData === "string" ? processedData.startsWith(signature.base64Prefix) : processedData.length >= signature.bytesPrefix.length && signature.bytesPrefix.every(
      (byte, index) => processedData[index] === byte
    )) {
      return signature.mimeType;
    }
  }
  return void 0;
}

// core/generate-image/generate-image.ts
async function generateImage({
  model,
  prompt,
  n = 1,
  size,
  aspectRatio,
  seed,
  providerOptions,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers
}) {
  var _a17;
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  const { retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const maxImagesPerCall = (_a17 = model.maxImagesPerCall) != null ? _a17 : 1;
  const callCount = Math.ceil(n / maxImagesPerCall);
  const callImageCounts = Array.from({ length: callCount }, (_, i) => {
    if (i < callCount - 1) {
      return maxImagesPerCall;
    }
    const remainder = n % maxImagesPerCall;
    return remainder === 0 ? maxImagesPerCall : remainder;
  });
  const results = await Promise.all(
    callImageCounts.map(
      async (callImageCount) => retry(
        () => model.doGenerate({
          prompt,
          n: callImageCount,
          abortSignal,
          headers,
          size,
          aspectRatio,
          seed,
          providerOptions: providerOptions != null ? providerOptions : {}
        })
      )
    )
  );
  const images = [];
  const warnings = [];
  const responses = [];
  for (const result of results) {
    images.push(
      ...result.images.map(
        (image) => {
          var _a18;
          return new DefaultGeneratedFile({
            data: image,
            mimeType: (_a18 = detectMimeType({
              data: image,
              signatures: imageMimeTypeSignatures
            })) != null ? _a18 : "image/png"
          });
        }
      )
    );
    warnings.push(...result.warnings);
    responses.push(result.response);
  }
  if (!images.length) {
    throw new NoImageGeneratedError({ responses });
  }
  return new DefaultGenerateImageResult({ images, warnings, responses });
}
var DefaultGenerateImageResult = class {
  constructor(options) {
    this.images = options.images;
    this.warnings = options.warnings;
    this.responses = options.responses;
  }
  get image() {
    return this.images[0];
  }
};

// core/generate-object/generate-object.ts
import {
  JSONParseError,
  TypeValidationError as TypeValidationError2
} from "@ai-sdk/provider";
import { createIdGenerator, safeParseJSON } from "@ai-sdk/provider-utils";

// errors/no-object-generated-error.ts
import { AISDKError as AISDKError5 } from "@ai-sdk/provider";
var name4 = "AI_NoObjectGeneratedError";
var marker4 = `vercel.ai.error.${name4}`;
var symbol4 = Symbol.for(marker4);
var _a4;
var NoObjectGeneratedError = class extends AISDKError5 {
  constructor({
    message = "No object generated.",
    cause,
    text: text2,
    response,
    usage,
    finishReason
  }) {
    super({ name: name4, message, cause });
    this[_a4] = true;
    this.text = text2;
    this.response = response;
    this.usage = usage;
    this.finishReason = finishReason;
  }
  static isInstance(error) {
    return AISDKError5.hasMarker(error, marker4);
  }
};
_a4 = symbol4;

// util/download-error.ts
import { AISDKError as AISDKError6 } from "@ai-sdk/provider";
var name5 = "AI_DownloadError";
var marker5 = `vercel.ai.error.${name5}`;
var symbol5 = Symbol.for(marker5);
var _a5;
var DownloadError = class extends AISDKError6 {
  constructor({
    url,
    statusCode,
    statusText,
    cause,
    message = cause == null ? `Failed to download ${url}: ${statusCode} ${statusText}` : `Failed to download ${url}: ${cause}`
  }) {
    super({ name: name5, message, cause });
    this[_a5] = true;
    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
  static isInstance(error) {
    return AISDKError6.hasMarker(error, marker5);
  }
};
_a5 = symbol5;

// util/download.ts
async function download({ url }) {
  var _a17;
  const urlText = url.toString();
  try {
    const response = await fetch(urlText);
    if (!response.ok) {
      throw new DownloadError({
        url: urlText,
        statusCode: response.status,
        statusText: response.statusText
      });
    }
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mimeType: (_a17 = response.headers.get("content-type")) != null ? _a17 : void 0
    };
  } catch (error) {
    if (DownloadError.isInstance(error)) {
      throw error;
    }
    throw new DownloadError({ url: urlText, cause: error });
  }
}

// core/prompt/data-content.ts
import {
  convertBase64ToUint8Array as convertBase64ToUint8Array3,
  convertUint8ArrayToBase64 as convertUint8ArrayToBase642
} from "@ai-sdk/provider-utils";

// core/prompt/invalid-data-content-error.ts
import { AISDKError as AISDKError7 } from "@ai-sdk/provider";
var name6 = "AI_InvalidDataContentError";
var marker6 = `vercel.ai.error.${name6}`;
var symbol6 = Symbol.for(marker6);
var _a6;
var InvalidDataContentError = class extends AISDKError7 {
  constructor({
    content,
    cause,
    message = `Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got ${typeof content}.`
  }) {
    super({ name: name6, message, cause });
    this[_a6] = true;
    this.content = content;
  }
  static isInstance(error) {
    return AISDKError7.hasMarker(error, marker6);
  }
};
_a6 = symbol6;

// core/prompt/data-content.ts
import { z } from "zod";
var dataContentSchema = z.union([
  z.string(),
  z.instanceof(Uint8Array),
  z.instanceof(ArrayBuffer),
  z.custom(
    // Buffer might not be available in some environments such as CloudFlare:
    (value) => {
      var _a17, _b;
      return (_b = (_a17 = globalThis.Buffer) == null ? void 0 : _a17.isBuffer(value)) != null ? _b : false;
    },
    { message: "Must be a Buffer" }
  )
]);
function convertDataContentToBase64String(content) {
  if (typeof content === "string") {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return convertUint8ArrayToBase642(new Uint8Array(content));
  }
  return convertUint8ArrayToBase642(content);
}
function convertDataContentToUint8Array(content) {
  if (content instanceof Uint8Array) {
    return content;
  }
  if (typeof content === "string") {
    try {
      return convertBase64ToUint8Array3(content);
    } catch (error) {
      throw new InvalidDataContentError({
        message: "Invalid data content. Content string is not a base64-encoded media.",
        content,
        cause: error
      });
    }
  }
  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }
  throw new InvalidDataContentError({ content });
}
function convertUint8ArrayToText(uint8Array) {
  try {
    return new TextDecoder().decode(uint8Array);
  } catch (error) {
    throw new Error("Error decoding Uint8Array to text");
  }
}

// core/prompt/invalid-message-role-error.ts
import { AISDKError as AISDKError8 } from "@ai-sdk/provider";
var name7 = "AI_InvalidMessageRoleError";
var marker7 = `vercel.ai.error.${name7}`;
var symbol7 = Symbol.for(marker7);
var _a7;
var InvalidMessageRoleError = class extends AISDKError8 {
  constructor({
    role,
    message = `Invalid message role: '${role}'. Must be one of: "system", "user", "assistant", "tool".`
  }) {
    super({ name: name7, message });
    this[_a7] = true;
    this.role = role;
  }
  static isInstance(error) {
    return AISDKError8.hasMarker(error, marker7);
  }
};
_a7 = symbol7;

// core/prompt/split-data-url.ts
function splitDataUrl(dataUrl) {
  try {
    const [header, base64Content] = dataUrl.split(",");
    return {
      mimeType: header.split(";")[0].split(":")[1],
      base64Content
    };
  } catch (error) {
    return {
      mimeType: void 0,
      base64Content: void 0
    };
  }
}

// core/prompt/convert-to-language-model-prompt.ts
async function convertToLanguageModelPrompt({
  prompt,
  modelSupportsImageUrls = true,
  modelSupportsUrl = () => false,
  downloadImplementation = download
}) {
  const downloadedAssets = await downloadAssets(
    prompt.messages,
    downloadImplementation,
    modelSupportsImageUrls,
    modelSupportsUrl
  );
  return [
    ...prompt.system != null ? [{ role: "system", content: prompt.system }] : [],
    ...prompt.messages.map(
      (message) => convertToLanguageModelMessage(message, downloadedAssets)
    )
  ];
}
function convertToLanguageModelMessage(message, downloadedAssets) {
  var _a17, _b, _c, _d, _e, _f;
  const role = message.role;
  switch (role) {
    case "system": {
      return {
        role: "system",
        content: message.content,
        providerMetadata: (_a17 = message.providerOptions) != null ? _a17 : message.experimental_providerMetadata
      };
    }
    case "user": {
      if (typeof message.content === "string") {
        return {
          role: "user",
          content: [{ type: "text", text: message.content }],
          providerMetadata: (_b = message.providerOptions) != null ? _b : message.experimental_providerMetadata
        };
      }
      return {
        role: "user",
        content: message.content.map((part) => convertPartToLanguageModelPart(part, downloadedAssets)).filter((part) => part.type !== "text" || part.text !== ""),
        providerMetadata: (_c = message.providerOptions) != null ? _c : message.experimental_providerMetadata
      };
    }
    case "assistant": {
      if (typeof message.content === "string") {
        return {
          role: "assistant",
          content: [{ type: "text", text: message.content }],
          providerMetadata: (_d = message.providerOptions) != null ? _d : message.experimental_providerMetadata
        };
      }
      return {
        role: "assistant",
        content: message.content.filter(
          // remove empty text parts:
          (part) => part.type !== "text" || part.text !== ""
        ).map((part) => {
          var _a18;
          const providerOptions = (_a18 = part.providerOptions) != null ? _a18 : part.experimental_providerMetadata;
          switch (part.type) {
            case "file": {
              return {
                type: "file",
                data: part.data instanceof URL ? part.data : convertDataContentToBase64String(part.data),
                filename: part.filename,
                mimeType: part.mimeType,
                providerMetadata: providerOptions
              };
            }
            case "reasoning": {
              return {
                type: "reasoning",
                text: part.text,
                signature: part.signature,
                providerMetadata: providerOptions
              };
            }
            case "redacted-reasoning": {
              return {
                type: "redacted-reasoning",
                data: part.data,
                providerMetadata: providerOptions
              };
            }
            case "text": {
              return {
                type: "text",
                text: part.text,
                providerMetadata: providerOptions
              };
            }
            case "tool-call": {
              return {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args,
                providerMetadata: providerOptions
              };
            }
          }
        }),
        providerMetadata: (_e = message.providerOptions) != null ? _e : message.experimental_providerMetadata
      };
    }
    case "tool": {
      return {
        role: "tool",
        content: message.content.map((part) => {
          var _a18;
          return {
            type: "tool-result",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            result: part.result,
            content: part.experimental_content,
            isError: part.isError,
            providerMetadata: (_a18 = part.providerOptions) != null ? _a18 : part.experimental_providerMetadata
          };
        }),
        providerMetadata: (_f = message.providerOptions) != null ? _f : message.experimental_providerMetadata
      };
    }
    default: {
      const _exhaustiveCheck = role;
      throw new InvalidMessageRoleError({ role: _exhaustiveCheck });
    }
  }
}
async function downloadAssets(messages, downloadImplementation, modelSupportsImageUrls, modelSupportsUrl) {
  const urls = messages.filter((message) => message.role === "user").map((message) => message.content).filter(
    (content) => Array.isArray(content)
  ).flat().filter(
    (part) => part.type === "image" || part.type === "file"
  ).filter(
    (part) => !(part.type === "image" && modelSupportsImageUrls === true)
  ).map((part) => part.type === "image" ? part.image : part.data).map(
    (part) => (
      // support string urls:
      typeof part === "string" && (part.startsWith("http:") || part.startsWith("https:")) ? new URL(part) : part
    )
  ).filter((image) => image instanceof URL).filter((url) => !modelSupportsUrl(url));
  const downloadedImages = await Promise.all(
    urls.map(async (url) => ({
      url,
      data: await downloadImplementation({ url })
    }))
  );
  return Object.fromEntries(
    downloadedImages.map(({ url, data }) => [url.toString(), data])
  );
}
function convertPartToLanguageModelPart(part, downloadedAssets) {
  var _a17, _b, _c, _d;
  if (part.type === "text") {
    return {
      type: "text",
      text: part.text,
      providerMetadata: (_a17 = part.providerOptions) != null ? _a17 : part.experimental_providerMetadata
    };
  }
  let mimeType = part.mimeType;
  let data;
  let content;
  let normalizedData;
  const type = part.type;
  switch (type) {
    case "image":
      data = part.image;
      break;
    case "file":
      data = part.data;
      break;
    default:
      throw new Error(`Unsupported part type: ${type}`);
  }
  try {
    content = typeof data === "string" ? new URL(data) : data;
  } catch (error) {
    content = data;
  }
  if (content instanceof URL) {
    if (content.protocol === "data:") {
      const { mimeType: dataUrlMimeType, base64Content } = splitDataUrl(
        content.toString()
      );
      if (dataUrlMimeType == null || base64Content == null) {
        throw new Error(`Invalid data URL format in part ${type}`);
      }
      mimeType = dataUrlMimeType;
      normalizedData = convertDataContentToUint8Array(base64Content);
    } else {
      const downloadedFile = downloadedAssets[content.toString()];
      if (downloadedFile) {
        normalizedData = downloadedFile.data;
        mimeType != null ? mimeType : mimeType = downloadedFile.mimeType;
      } else {
        normalizedData = content;
      }
    }
  } else {
    normalizedData = convertDataContentToUint8Array(content);
  }
  switch (type) {
    case "image": {
      if (normalizedData instanceof Uint8Array) {
        mimeType = (_b = detectMimeType({
          data: normalizedData,
          signatures: imageMimeTypeSignatures
        })) != null ? _b : mimeType;
      }
      return {
        type: "image",
        image: normalizedData,
        mimeType,
        providerMetadata: (_c = part.providerOptions) != null ? _c : part.experimental_providerMetadata
      };
    }
    case "file": {
      if (mimeType == null) {
        throw new Error(`Mime type is missing for file part`);
      }
      return {
        type: "file",
        data: normalizedData instanceof Uint8Array ? convertDataContentToBase64String(normalizedData) : normalizedData,
        filename: part.filename,
        mimeType,
        providerMetadata: (_d = part.providerOptions) != null ? _d : part.experimental_providerMetadata
      };
    }
  }
}

// core/prompt/prepare-call-settings.ts
function prepareCallSettings({
  maxTokens,
  temperature,
  topP,
  topK,
  presencePenalty,
  frequencyPenalty,
  stopSequences,
  seed
}) {
  if (maxTokens != null) {
    if (!Number.isInteger(maxTokens)) {
      throw new InvalidArgumentError({
        parameter: "maxTokens",
        value: maxTokens,
        message: "maxTokens must be an integer"
      });
    }
    if (maxTokens < 1) {
      throw new InvalidArgumentError({
        parameter: "maxTokens",
        value: maxTokens,
        message: "maxTokens must be >= 1"
      });
    }
  }
  if (temperature != null) {
    if (typeof temperature !== "number") {
      throw new InvalidArgumentError({
        parameter: "temperature",
        value: temperature,
        message: "temperature must be a number"
      });
    }
  }
  if (topP != null) {
    if (typeof topP !== "number") {
      throw new InvalidArgumentError({
        parameter: "topP",
        value: topP,
        message: "topP must be a number"
      });
    }
  }
  if (topK != null) {
    if (typeof topK !== "number") {
      throw new InvalidArgumentError({
        parameter: "topK",
        value: topK,
        message: "topK must be a number"
      });
    }
  }
  if (presencePenalty != null) {
    if (typeof presencePenalty !== "number") {
      throw new InvalidArgumentError({
        parameter: "presencePenalty",
        value: presencePenalty,
        message: "presencePenalty must be a number"
      });
    }
  }
  if (frequencyPenalty != null) {
    if (typeof frequencyPenalty !== "number") {
      throw new InvalidArgumentError({
        parameter: "frequencyPenalty",
        value: frequencyPenalty,
        message: "frequencyPenalty must be a number"
      });
    }
  }
  if (seed != null) {
    if (!Number.isInteger(seed)) {
      throw new InvalidArgumentError({
        parameter: "seed",
        value: seed,
        message: "seed must be an integer"
      });
    }
  }
  return {
    maxTokens,
    // TODO v5 remove default 0 for temperature
    temperature: temperature != null ? temperature : 0,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences: stopSequences != null && stopSequences.length > 0 ? stopSequences : void 0,
    seed
  };
}

// core/prompt/standardize-prompt.ts
import { InvalidPromptError } from "@ai-sdk/provider";
import { safeValidateTypes } from "@ai-sdk/provider-utils";
import { z as z7 } from "zod";

// core/prompt/attachments-to-parts.ts
function attachmentsToParts(attachments) {
  var _a17, _b, _c;
  const parts = [];
  for (const attachment of attachments) {
    let url;
    try {
      url = new URL(attachment.url);
    } catch (error) {
      throw new Error(`Invalid URL: ${attachment.url}`);
    }
    switch (url.protocol) {
      case "http:":
      case "https:": {
        if ((_a17 = attachment.contentType) == null ? void 0 : _a17.startsWith("image/")) {
          parts.push({ type: "image", image: url });
        } else {
          if (!attachment.contentType) {
            throw new Error(
              "If the attachment is not an image, it must specify a content type"
            );
          }
          parts.push({
            type: "file",
            data: url,
            mimeType: attachment.contentType
          });
        }
        break;
      }
      case "data:": {
        let header;
        let base64Content;
        let mimeType;
        try {
          [header, base64Content] = attachment.url.split(",");
          mimeType = header.split(";")[0].split(":")[1];
        } catch (error) {
          throw new Error(`Error processing data URL: ${attachment.url}`);
        }
        if (mimeType == null || base64Content == null) {
          throw new Error(`Invalid data URL format: ${attachment.url}`);
        }
        if ((_b = attachment.contentType) == null ? void 0 : _b.startsWith("image/")) {
          parts.push({
            type: "image",
            image: convertDataContentToUint8Array(base64Content)
          });
        } else if ((_c = attachment.contentType) == null ? void 0 : _c.startsWith("text/")) {
          parts.push({
            type: "text",
            text: convertUint8ArrayToText(
              convertDataContentToUint8Array(base64Content)
            )
          });
        } else {
          if (!attachment.contentType) {
            throw new Error(
              "If the attachment is not an image or text, it must specify a content type"
            );
          }
          parts.push({
            type: "file",
            data: base64Content,
            mimeType: attachment.contentType
          });
        }
        break;
      }
      default: {
        throw new Error(`Unsupported URL protocol: ${url.protocol}`);
      }
    }
  }
  return parts;
}

// core/prompt/message-conversion-error.ts
import { AISDKError as AISDKError9 } from "@ai-sdk/provider";
var name8 = "AI_MessageConversionError";
var marker8 = `vercel.ai.error.${name8}`;
var symbol8 = Symbol.for(marker8);
var _a8;
var MessageConversionError = class extends AISDKError9 {
  constructor({
    originalMessage,
    message
  }) {
    super({ name: name8, message });
    this[_a8] = true;
    this.originalMessage = originalMessage;
  }
  static isInstance(error) {
    return AISDKError9.hasMarker(error, marker8);
  }
};
_a8 = symbol8;

// core/prompt/convert-to-core-messages.ts
function convertToCoreMessages(messages, options) {
  var _a17, _b;
  const tools = (_a17 = options == null ? void 0 : options.tools) != null ? _a17 : {};
  const coreMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const isLastMessage = i === messages.length - 1;
    const { role, content, experimental_attachments } = message;
    switch (role) {
      case "system": {
        coreMessages.push({
          role: "system",
          content
        });
        break;
      }
      case "user": {
        if (message.parts == null) {
          coreMessages.push({
            role: "user",
            content: experimental_attachments ? [
              { type: "text", text: content },
              ...attachmentsToParts(experimental_attachments)
            ] : content
          });
        } else {
          const textParts = message.parts.filter((part) => part.type === "text").map((part) => ({
            type: "text",
            text: part.text
          }));
          coreMessages.push({
            role: "user",
            content: experimental_attachments ? [...textParts, ...attachmentsToParts(experimental_attachments)] : textParts
          });
        }
        break;
      }
      case "assistant": {
        if (message.parts != null) {
          let processBlock2 = function() {
            const content2 = [];
            for (const part of block) {
              switch (part.type) {
                case "file":
                case "text": {
                  content2.push(part);
                  break;
                }
                case "reasoning": {
                  for (const detail of part.details) {
                    switch (detail.type) {
                      case "text":
                        content2.push({
                          type: "reasoning",
                          text: detail.text,
                          signature: detail.signature
                        });
                        break;
                      case "redacted":
                        content2.push({
                          type: "redacted-reasoning",
                          data: detail.data
                        });
                        break;
                    }
                  }
                  break;
                }
                case "tool-invocation":
                  content2.push({
                    type: "tool-call",
                    toolCallId: part.toolInvocation.toolCallId,
                    toolName: part.toolInvocation.toolName,
                    args: part.toolInvocation.args
                  });
                  break;
                default: {
                  const _exhaustiveCheck = part;
                  throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
                }
              }
            }
            coreMessages.push({
              role: "assistant",
              content: content2
            });
            const stepInvocations = block.filter(
              (part) => part.type === "tool-invocation"
            ).map((part) => part.toolInvocation);
            if (stepInvocations.length > 0) {
              coreMessages.push({
                role: "tool",
                content: stepInvocations.map(
                  (toolInvocation) => {
                    if (!("result" in toolInvocation)) {
                      throw new MessageConversionError({
                        originalMessage: message,
                        message: "ToolInvocation must have a result: " + JSON.stringify(toolInvocation)
                      });
                    }
                    const { toolCallId, toolName, result } = toolInvocation;
                    const tool2 = tools[toolName];
                    return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                      type: "tool-result",
                      toolCallId,
                      toolName,
                      result: tool2.experimental_toToolResultContent(result),
                      experimental_content: tool2.experimental_toToolResultContent(result)
                    } : {
                      type: "tool-result",
                      toolCallId,
                      toolName,
                      result
                    };
                  }
                )
              });
            }
            block = [];
            blockHasToolInvocations = false;
            currentStep++;
          };
          var processBlock = processBlock2;
          let currentStep = 0;
          let blockHasToolInvocations = false;
          let block = [];
          for (const part of message.parts) {
            switch (part.type) {
              case "text": {
                if (blockHasToolInvocations) {
                  processBlock2();
                }
                block.push(part);
                break;
              }
              case "file":
              case "reasoning": {
                block.push(part);
                break;
              }
              case "tool-invocation": {
                if (((_b = part.toolInvocation.step) != null ? _b : 0) !== currentStep) {
                  processBlock2();
                }
                block.push(part);
                blockHasToolInvocations = true;
                break;
              }
            }
          }
          processBlock2();
          break;
        }
        const toolInvocations = message.toolInvocations;
        if (toolInvocations == null || toolInvocations.length === 0) {
          coreMessages.push({ role: "assistant", content });
          break;
        }
        const maxStep = toolInvocations.reduce((max, toolInvocation) => {
          var _a18;
          return Math.max(max, (_a18 = toolInvocation.step) != null ? _a18 : 0);
        }, 0);
        for (let i2 = 0; i2 <= maxStep; i2++) {
          const stepInvocations = toolInvocations.filter(
            (toolInvocation) => {
              var _a18;
              return ((_a18 = toolInvocation.step) != null ? _a18 : 0) === i2;
            }
          );
          if (stepInvocations.length === 0) {
            continue;
          }
          coreMessages.push({
            role: "assistant",
            content: [
              ...isLastMessage && content && i2 === 0 ? [{ type: "text", text: content }] : [],
              ...stepInvocations.map(
                ({ toolCallId, toolName, args }) => ({
                  type: "tool-call",
                  toolCallId,
                  toolName,
                  args
                })
              )
            ]
          });
          coreMessages.push({
            role: "tool",
            content: stepInvocations.map((toolInvocation) => {
              if (!("result" in toolInvocation)) {
                throw new MessageConversionError({
                  originalMessage: message,
                  message: "ToolInvocation must have a result: " + JSON.stringify(toolInvocation)
                });
              }
              const { toolCallId, toolName, result } = toolInvocation;
              const tool2 = tools[toolName];
              return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                type: "tool-result",
                toolCallId,
                toolName,
                result: tool2.experimental_toToolResultContent(result),
                experimental_content: tool2.experimental_toToolResultContent(result)
              } : {
                type: "tool-result",
                toolCallId,
                toolName,
                result
              };
            })
          });
        }
        if (content && !isLastMessage) {
          coreMessages.push({ role: "assistant", content });
        }
        break;
      }
      case "data": {
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new MessageConversionError({
          originalMessage: message,
          message: `Unsupported role: ${_exhaustiveCheck}`
        });
      }
    }
  }
  return coreMessages;
}

// core/prompt/message.ts
import { z as z6 } from "zod";

// core/types/provider-metadata.ts
import { z as z3 } from "zod";

// core/types/json-value.ts
import { z as z2 } from "zod";
var jsonValueSchema = z2.lazy(
  () => z2.union([
    z2.null(),
    z2.string(),
    z2.number(),
    z2.boolean(),
    z2.record(z2.string(), jsonValueSchema),
    z2.array(jsonValueSchema)
  ])
);

// core/types/provider-metadata.ts
var providerMetadataSchema = z3.record(
  z3.string(),
  z3.record(z3.string(), jsonValueSchema)
);

// core/prompt/content-part.ts
import { z as z5 } from "zod";

// core/prompt/tool-result-content.ts
import { z as z4 } from "zod";
var toolResultContentSchema = z4.array(
  z4.union([
    z4.object({ type: z4.literal("text"), text: z4.string() }),
    z4.object({
      type: z4.literal("image"),
      data: z4.string(),
      mimeType: z4.string().optional()
    })
  ])
);

// core/prompt/content-part.ts
var textPartSchema = z5.object({
  type: z5.literal("text"),
  text: z5.string(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var imagePartSchema = z5.object({
  type: z5.literal("image"),
  image: z5.union([dataContentSchema, z5.instanceof(URL)]),
  mimeType: z5.string().optional(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var filePartSchema = z5.object({
  type: z5.literal("file"),
  data: z5.union([dataContentSchema, z5.instanceof(URL)]),
  filename: z5.string().optional(),
  mimeType: z5.string(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var reasoningPartSchema = z5.object({
  type: z5.literal("reasoning"),
  text: z5.string(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var redactedReasoningPartSchema = z5.object({
  type: z5.literal("redacted-reasoning"),
  data: z5.string(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var toolCallPartSchema = z5.object({
  type: z5.literal("tool-call"),
  toolCallId: z5.string(),
  toolName: z5.string(),
  args: z5.unknown(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var toolResultPartSchema = z5.object({
  type: z5.literal("tool-result"),
  toolCallId: z5.string(),
  toolName: z5.string(),
  result: z5.unknown(),
  content: toolResultContentSchema.optional(),
  isError: z5.boolean().optional(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});

// core/prompt/message.ts
var coreSystemMessageSchema = z6.object({
  role: z6.literal("system"),
  content: z6.string(),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreUserMessageSchema = z6.object({
  role: z6.literal("user"),
  content: z6.union([
    z6.string(),
    z6.array(z6.union([textPartSchema, imagePartSchema, filePartSchema]))
  ]),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreAssistantMessageSchema = z6.object({
  role: z6.literal("assistant"),
  content: z6.union([
    z6.string(),
    z6.array(
      z6.union([
        textPartSchema,
        filePartSchema,
        reasoningPartSchema,
        redactedReasoningPartSchema,
        toolCallPartSchema
      ])
    )
  ]),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreToolMessageSchema = z6.object({
  role: z6.literal("tool"),
  content: z6.array(toolResultPartSchema),
  providerOptions: providerMetadataSchema.optional(),
  experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreMessageSchema = z6.union([
  coreSystemMessageSchema,
  coreUserMessageSchema,
  coreAssistantMessageSchema,
  coreToolMessageSchema
]);

// core/prompt/standardize-prompt.ts
function standardizePrompt({
  prompt,
  tools
}) {
  if (prompt.prompt == null && prompt.messages == null) {
    throw new InvalidPromptError({
      prompt,
      message: "prompt or messages must be defined"
    });
  }
  if (prompt.prompt != null && prompt.messages != null) {
    throw new InvalidPromptError({
      prompt,
      message: "prompt and messages cannot be defined at the same time"
    });
  }
  if (prompt.system != null && typeof prompt.system !== "string") {
    throw new InvalidPromptError({
      prompt,
      message: "system must be a string"
    });
  }
  if (prompt.prompt != null) {
    if (typeof prompt.prompt !== "string") {
      throw new InvalidPromptError({
        prompt,
        message: "prompt must be a string"
      });
    }
    return {
      type: "prompt",
      system: prompt.system,
      messages: [
        {
          role: "user",
          content: prompt.prompt
        }
      ]
    };
  }
  if (prompt.messages != null) {
    const promptType = detectPromptType(prompt.messages);
    const messages = promptType === "ui-messages" ? convertToCoreMessages(prompt.messages, {
      tools
    }) : prompt.messages;
    if (messages.length === 0) {
      throw new InvalidPromptError({
        prompt,
        message: "messages must not be empty"
      });
    }
    const validationResult = safeValidateTypes({
      value: messages,
      schema: z7.array(coreMessageSchema)
    });
    if (!validationResult.success) {
      throw new InvalidPromptError({
        prompt,
        message: [
          "message must be a CoreMessage or a UI message",
          `Validation error: ${validationResult.error.message}`
        ].join("\n"),
        cause: validationResult.error
      });
    }
    return {
      type: "messages",
      messages,
      system: prompt.system
    };
  }
  throw new Error("unreachable");
}
function detectPromptType(prompt) {
  if (!Array.isArray(prompt)) {
    throw new InvalidPromptError({
      prompt,
      message: [
        "messages must be an array of CoreMessage or UIMessage",
        `Received non-array value: ${JSON.stringify(prompt)}`
      ].join("\n"),
      cause: prompt
    });
  }
  if (prompt.length === 0) {
    return "messages";
  }
  const characteristics = prompt.map(detectSingleMessageCharacteristics);
  if (characteristics.some((c) => c === "has-ui-specific-parts")) {
    return "ui-messages";
  }
  const nonMessageIndex = characteristics.findIndex(
    (c) => c !== "has-core-specific-parts" && c !== "message"
  );
  if (nonMessageIndex === -1) {
    return "messages";
  }
  throw new InvalidPromptError({
    prompt,
    message: [
      "messages must be an array of CoreMessage or UIMessage",
      `Received message of type: "${characteristics[nonMessageIndex]}" at index ${nonMessageIndex}`,
      `messages[${nonMessageIndex}]: ${JSON.stringify(prompt[nonMessageIndex])}`
    ].join("\n"),
    cause: prompt
  });
}
function detectSingleMessageCharacteristics(message) {
  if (typeof message === "object" && message !== null && (message.role === "function" || // UI-only role
  message.role === "data" || // UI-only role
  "toolInvocations" in message || // UI-specific field
  "parts" in message || // UI-specific field
  "experimental_attachments" in message)) {
    return "has-ui-specific-parts";
  } else if (typeof message === "object" && message !== null && "content" in message && (Array.isArray(message.content) || // Core messages can have array content
  "experimental_providerMetadata" in message || "providerOptions" in message)) {
    return "has-core-specific-parts";
  } else if (typeof message === "object" && message !== null && "role" in message && "content" in message && typeof message.content === "string" && ["system", "user", "assistant", "tool"].includes(message.role)) {
    return "message";
  } else {
    return "other";
  }
}

// core/types/usage.ts
function calculateLanguageModelUsage({
  promptTokens,
  completionTokens
}) {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };
}
function addLanguageModelUsage(usage1, usage2) {
  return {
    promptTokens: usage1.promptTokens + usage2.promptTokens,
    completionTokens: usage1.completionTokens + usage2.completionTokens,
    totalTokens: usage1.totalTokens + usage2.totalTokens
  };
}

// core/generate-object/inject-json-instruction.ts
var DEFAULT_SCHEMA_PREFIX = "JSON schema:";
var DEFAULT_SCHEMA_SUFFIX = "You MUST answer with a JSON object that matches the JSON schema above.";
var DEFAULT_GENERIC_SUFFIX = "You MUST answer with JSON.";
function injectJsonInstruction({
  prompt,
  schema,
  schemaPrefix = schema != null ? DEFAULT_SCHEMA_PREFIX : void 0,
  schemaSuffix = schema != null ? DEFAULT_SCHEMA_SUFFIX : DEFAULT_GENERIC_SUFFIX
}) {
  return [
    prompt != null && prompt.length > 0 ? prompt : void 0,
    prompt != null && prompt.length > 0 ? "" : void 0,
    // add a newline if prompt is not null
    schemaPrefix,
    schema != null ? JSON.stringify(schema) : void 0,
    schemaSuffix
  ].filter((line) => line != null).join("\n");
}

// core/generate-object/output-strategy.ts
import {
  isJSONArray,
  isJSONObject,
  TypeValidationError,
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { safeValidateTypes as safeValidateTypes2 } from "@ai-sdk/provider-utils";
import { asSchema } from "@ai-sdk/ui-utils";

// core/util/async-iterable-stream.ts
function createAsyncIterableStream(source) {
  const stream = source.pipeThrough(new TransformStream());
  stream[Symbol.asyncIterator] = () => {
    const reader = stream.getReader();
    return {
      async next() {
        const { done, value } = await reader.read();
        return done ? { done: true, value: void 0 } : { done: false, value };
      }
    };
  };
  return stream;
}

// core/generate-object/output-strategy.ts
var noSchemaOutputStrategy = {
  type: "no-schema",
  jsonSchema: void 0,
  validatePartialResult({ value, textDelta }) {
    return { success: true, value: { partial: value, textDelta } };
  },
  validateFinalResult(value, context) {
    return value === void 0 ? {
      success: false,
      error: new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        text: context.text,
        response: context.response,
        usage: context.usage,
        finishReason: context.finishReason
      })
    } : { success: true, value };
  },
  createElementStream() {
    throw new UnsupportedFunctionalityError({
      functionality: "element streams in no-schema mode"
    });
  }
};
var objectOutputStrategy = (schema) => ({
  type: "object",
  jsonSchema: schema.jsonSchema,
  validatePartialResult({ value, textDelta }) {
    return {
      success: true,
      value: {
        // Note: currently no validation of partial results:
        partial: value,
        textDelta
      }
    };
  },
  validateFinalResult(value) {
    return safeValidateTypes2({ value, schema });
  },
  createElementStream() {
    throw new UnsupportedFunctionalityError({
      functionality: "element streams in object mode"
    });
  }
});
var arrayOutputStrategy = (schema) => {
  const { $schema, ...itemSchema } = schema.jsonSchema;
  return {
    type: "enum",
    // wrap in object that contains array of elements, since most LLMs will not
    // be able to generate an array directly:
    // possible future optimization: use arrays directly when model supports grammar-guided generation
    jsonSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        elements: { type: "array", items: itemSchema }
      },
      required: ["elements"],
      additionalProperties: false
    },
    validatePartialResult({ value, latestObject, isFirstDelta, isFinalDelta }) {
      var _a17;
      if (!isJSONObject(value) || !isJSONArray(value.elements)) {
        return {
          success: false,
          error: new TypeValidationError({
            value,
            cause: "value must be an object that contains an array of elements"
          })
        };
      }
      const inputArray = value.elements;
      const resultArray = [];
      for (let i = 0; i < inputArray.length; i++) {
        const element = inputArray[i];
        const result = safeValidateTypes2({ value: element, schema });
        if (i === inputArray.length - 1 && !isFinalDelta) {
          continue;
        }
        if (!result.success) {
          return result;
        }
        resultArray.push(result.value);
      }
      const publishedElementCount = (_a17 = latestObject == null ? void 0 : latestObject.length) != null ? _a17 : 0;
      let textDelta = "";
      if (isFirstDelta) {
        textDelta += "[";
      }
      if (publishedElementCount > 0) {
        textDelta += ",";
      }
      textDelta += resultArray.slice(publishedElementCount).map((element) => JSON.stringify(element)).join(",");
      if (isFinalDelta) {
        textDelta += "]";
      }
      return {
        success: true,
        value: {
          partial: resultArray,
          textDelta
        }
      };
    },
    validateFinalResult(value) {
      if (!isJSONObject(value) || !isJSONArray(value.elements)) {
        return {
          success: false,
          error: new TypeValidationError({
            value,
            cause: "value must be an object that contains an array of elements"
          })
        };
      }
      const inputArray = value.elements;
      for (const element of inputArray) {
        const result = safeValidateTypes2({ value: element, schema });
        if (!result.success) {
          return result;
        }
      }
      return { success: true, value: inputArray };
    },
    createElementStream(originalStream) {
      let publishedElements = 0;
      return createAsyncIterableStream(
        originalStream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              switch (chunk.type) {
                case "object": {
                  const array = chunk.object;
                  for (; publishedElements < array.length; publishedElements++) {
                    controller.enqueue(array[publishedElements]);
                  }
                  break;
                }
                case "text-delta":
                case "finish":
                case "error":
                  break;
                default: {
                  const _exhaustiveCheck = chunk;
                  throw new Error(
                    `Unsupported chunk type: ${_exhaustiveCheck}`
                  );
                }
              }
            }
          })
        )
      );
    }
  };
};
var enumOutputStrategy = (enumValues) => {
  return {
    type: "enum",
    // wrap in object that contains result, since most LLMs will not
    // be able to generate an enum value directly:
    // possible future optimization: use enums directly when model supports top-level enums
    jsonSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        result: { type: "string", enum: enumValues }
      },
      required: ["result"],
      additionalProperties: false
    },
    validateFinalResult(value) {
      if (!isJSONObject(value) || typeof value.result !== "string") {
        return {
          success: false,
          error: new TypeValidationError({
            value,
            cause: 'value must be an object that contains a string in the "result" property.'
          })
        };
      }
      const result = value.result;
      return enumValues.includes(result) ? { success: true, value: result } : {
        success: false,
        error: new TypeValidationError({
          value,
          cause: "value must be a string in the enum"
        })
      };
    },
    validatePartialResult() {
      throw new UnsupportedFunctionalityError({
        functionality: "partial results in enum mode"
      });
    },
    createElementStream() {
      throw new UnsupportedFunctionalityError({
        functionality: "element streams in enum mode"
      });
    }
  };
};
function getOutputStrategy({
  output,
  schema,
  enumValues
}) {
  switch (output) {
    case "object":
      return objectOutputStrategy(asSchema(schema));
    case "array":
      return arrayOutputStrategy(asSchema(schema));
    case "enum":
      return enumOutputStrategy(enumValues);
    case "no-schema":
      return noSchemaOutputStrategy;
    default: {
      const _exhaustiveCheck = output;
      throw new Error(`Unsupported output: ${_exhaustiveCheck}`);
    }
  }
}

// core/generate-object/validate-object-generation-input.ts
function validateObjectGenerationInput({
  output,
  mode,
  schema,
  schemaName,
  schemaDescription,
  enumValues
}) {
  if (output != null && output !== "object" && output !== "array" && output !== "enum" && output !== "no-schema") {
    throw new InvalidArgumentError({
      parameter: "output",
      value: output,
      message: "Invalid output type."
    });
  }
  if (output === "no-schema") {
    if (mode === "auto" || mode === "tool") {
      throw new InvalidArgumentError({
        parameter: "mode",
        value: mode,
        message: 'Mode must be "json" for no-schema output.'
      });
    }
    if (schema != null) {
      throw new InvalidArgumentError({
        parameter: "schema",
        value: schema,
        message: "Schema is not supported for no-schema output."
      });
    }
    if (schemaDescription != null) {
      throw new InvalidArgumentError({
        parameter: "schemaDescription",
        value: schemaDescription,
        message: "Schema description is not supported for no-schema output."
      });
    }
    if (schemaName != null) {
      throw new InvalidArgumentError({
        parameter: "schemaName",
        value: schemaName,
        message: "Schema name is not supported for no-schema output."
      });
    }
    if (enumValues != null) {
      throw new InvalidArgumentError({
        parameter: "enumValues",
        value: enumValues,
        message: "Enum values are not supported for no-schema output."
      });
    }
  }
  if (output === "object") {
    if (schema == null) {
      throw new InvalidArgumentError({
        parameter: "schema",
        value: schema,
        message: "Schema is required for object output."
      });
    }
    if (enumValues != null) {
      throw new InvalidArgumentError({
        parameter: "enumValues",
        value: enumValues,
        message: "Enum values are not supported for object output."
      });
    }
  }
  if (output === "array") {
    if (schema == null) {
      throw new InvalidArgumentError({
        parameter: "schema",
        value: schema,
        message: "Element schema is required for array output."
      });
    }
    if (enumValues != null) {
      throw new InvalidArgumentError({
        parameter: "enumValues",
        value: enumValues,
        message: "Enum values are not supported for array output."
      });
    }
  }
  if (output === "enum") {
    if (schema != null) {
      throw new InvalidArgumentError({
        parameter: "schema",
        value: schema,
        message: "Schema is not supported for enum output."
      });
    }
    if (schemaDescription != null) {
      throw new InvalidArgumentError({
        parameter: "schemaDescription",
        value: schemaDescription,
        message: "Schema description is not supported for enum output."
      });
    }
    if (schemaName != null) {
      throw new InvalidArgumentError({
        parameter: "schemaName",
        value: schemaName,
        message: "Schema name is not supported for enum output."
      });
    }
    if (enumValues == null) {
      throw new InvalidArgumentError({
        parameter: "enumValues",
        value: enumValues,
        message: "Enum values are required for enum output."
      });
    }
    for (const value of enumValues) {
      if (typeof value !== "string") {
        throw new InvalidArgumentError({
          parameter: "enumValues",
          value,
          message: "Enum values must be strings."
        });
      }
    }
  }
}

// core/prompt/stringify-for-telemetry.ts
function stringifyForTelemetry(prompt) {
  const processedPrompt = prompt.map((message) => {
    return {
      ...message,
      content: typeof message.content === "string" ? message.content : message.content.map(processPart)
    };
  });
  return JSON.stringify(processedPrompt);
}
function processPart(part) {
  if (part.type === "image") {
    return {
      ...part,
      image: part.image instanceof Uint8Array ? convertDataContentToBase64String(part.image) : part.image
    };
  }
  return part;
}

// core/generate-object/generate-object.ts
var originalGenerateId = createIdGenerator({ prefix: "aiobj", size: 24 });
async function generateObject({
  model,
  enum: enumValues,
  // rename bc enum is reserved by typescript
  schema: inputSchema,
  schemaName,
  schemaDescription,
  mode,
  output = "object",
  system,
  prompt,
  messages,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  experimental_repairText: repairText,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions = experimental_providerMetadata,
  _internal: {
    generateId: generateId3 = originalGenerateId,
    currentDate = () => /* @__PURE__ */ new Date()
  } = {},
  ...settings
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  validateObjectGenerationInput({
    output,
    mode,
    schema: inputSchema,
    schemaName,
    schemaDescription,
    enumValues
  });
  const { maxRetries, retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const outputStrategy = getOutputStrategy({
    output,
    schema: inputSchema,
    enumValues
  });
  if (outputStrategy.type === "no-schema" && mode === void 0) {
    mode = "json";
  }
  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model,
    telemetry,
    headers,
    settings: { ...settings, maxRetries }
  });
  const tracer = getTracer(telemetry);
  return recordSpan({
    name: "ai.generateObject",
    attributes: selectTelemetryAttributes({
      telemetry,
      attributes: {
        ...assembleOperationName({
          operationId: "ai.generateObject",
          telemetry
        }),
        ...baseTelemetryAttributes,
        // specific settings that only make sense on the outer level:
        "ai.prompt": {
          input: () => JSON.stringify({ system, prompt, messages })
        },
        "ai.schema": outputStrategy.jsonSchema != null ? { input: () => JSON.stringify(outputStrategy.jsonSchema) } : void 0,
        "ai.schema.name": schemaName,
        "ai.schema.description": schemaDescription,
        "ai.settings.output": outputStrategy.type,
        "ai.settings.mode": mode
      }
    }),
    tracer,
    fn: async (span) => {
      var _a17, _b, _c, _d;
      if (mode === "auto" || mode == null) {
        mode = model.defaultObjectGenerationMode;
      }
      let result;
      let finishReason;
      let usage;
      let warnings;
      let rawResponse;
      let response;
      let request;
      let logprobs;
      let resultProviderMetadata;
      switch (mode) {
        case "json": {
          const standardizedPrompt = standardizePrompt({
            prompt: {
              system: outputStrategy.jsonSchema == null ? injectJsonInstruction({ prompt: system }) : model.supportsStructuredOutputs ? system : injectJsonInstruction({
                prompt: system,
                schema: outputStrategy.jsonSchema
              }),
              prompt,
              messages
            },
            tools: void 0
          });
          const promptMessages = await convertToLanguageModelPrompt({
            prompt: standardizedPrompt,
            modelSupportsImageUrls: model.supportsImageUrls,
            modelSupportsUrl: (_a17 = model.supportsUrl) == null ? void 0 : _a17.bind(model)
            // support 'this' context
          });
          const generateResult = await retry(
            () => recordSpan({
              name: "ai.generateObject.doGenerate",
              attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                  ...assembleOperationName({
                    operationId: "ai.generateObject.doGenerate",
                    telemetry
                  }),
                  ...baseTelemetryAttributes,
                  "ai.prompt.format": {
                    input: () => standardizedPrompt.type
                  },
                  "ai.prompt.messages": {
                    input: () => JSON.stringify(promptMessages)
                  },
                  "ai.settings.mode": mode,
                  // standardized gen-ai llm span attributes:
                  "gen_ai.system": model.provider,
                  "gen_ai.request.model": model.modelId,
                  "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                  "gen_ai.request.max_tokens": settings.maxTokens,
                  "gen_ai.request.presence_penalty": settings.presencePenalty,
                  "gen_ai.request.temperature": settings.temperature,
                  "gen_ai.request.top_k": settings.topK,
                  "gen_ai.request.top_p": settings.topP
                }
              }),
              tracer,
              fn: async (span2) => {
                var _a18, _b2, _c2, _d2, _e, _f;
                const result2 = await model.doGenerate({
                  mode: {
                    type: "object-json",
                    schema: outputStrategy.jsonSchema,
                    name: schemaName,
                    description: schemaDescription
                  },
                  ...prepareCallSettings(settings),
                  inputFormat: standardizedPrompt.type,
                  prompt: promptMessages,
                  providerMetadata: providerOptions,
                  abortSignal,
                  headers
                });
                const responseData = {
                  id: (_b2 = (_a18 = result2.response) == null ? void 0 : _a18.id) != null ? _b2 : generateId3(),
                  timestamp: (_d2 = (_c2 = result2.response) == null ? void 0 : _c2.timestamp) != null ? _d2 : currentDate(),
                  modelId: (_f = (_e = result2.response) == null ? void 0 : _e.modelId) != null ? _f : model.modelId
                };
                if (result2.text === void 0) {
                  throw new NoObjectGeneratedError({
                    message: "No object generated: the model did not return a response.",
                    response: responseData,
                    usage: calculateLanguageModelUsage(result2.usage),
                    finishReason: result2.finishReason
                  });
                }
                span2.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      "ai.response.finishReason": result2.finishReason,
                      "ai.response.object": { output: () => result2.text },
                      "ai.response.id": responseData.id,
                      "ai.response.model": responseData.modelId,
                      "ai.response.timestamp": responseData.timestamp.toISOString(),
                      "ai.response.providerMetadata": JSON.stringify(
                        result2.providerMetadata
                      ),
                      "ai.usage.promptTokens": result2.usage.promptTokens,
                      "ai.usage.completionTokens": result2.usage.completionTokens,
                      // standardized gen-ai llm span attributes:
                      "gen_ai.response.finish_reasons": [result2.finishReason],
                      "gen_ai.response.id": responseData.id,
                      "gen_ai.response.model": responseData.modelId,
                      "gen_ai.usage.prompt_tokens": result2.usage.promptTokens,
                      "gen_ai.usage.completion_tokens": result2.usage.completionTokens
                    }
                  })
                );
                return { ...result2, objectText: result2.text, responseData };
              }
            })
          );
          result = generateResult.objectText;
          finishReason = generateResult.finishReason;
          usage = generateResult.usage;
          warnings = generateResult.warnings;
          rawResponse = generateResult.rawResponse;
          logprobs = generateResult.logprobs;
          resultProviderMetadata = generateResult.providerMetadata;
          request = (_b = generateResult.request) != null ? _b : {};
          response = generateResult.responseData;
          break;
        }
        case "tool": {
          const standardizedPrompt = standardizePrompt({
            prompt: { system, prompt, messages },
            tools: void 0
          });
          const promptMessages = await convertToLanguageModelPrompt({
            prompt: standardizedPrompt,
            modelSupportsImageUrls: model.supportsImageUrls,
            modelSupportsUrl: (_c = model.supportsUrl) == null ? void 0 : _c.bind(model)
            // support 'this' context,
          });
          const inputFormat = standardizedPrompt.type;
          const generateResult = await retry(
            () => recordSpan({
              name: "ai.generateObject.doGenerate",
              attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                  ...assembleOperationName({
                    operationId: "ai.generateObject.doGenerate",
                    telemetry
                  }),
                  ...baseTelemetryAttributes,
                  "ai.prompt.format": {
                    input: () => inputFormat
                  },
                  "ai.prompt.messages": {
                    input: () => stringifyForTelemetry(promptMessages)
                  },
                  "ai.settings.mode": mode,
                  // standardized gen-ai llm span attributes:
                  "gen_ai.system": model.provider,
                  "gen_ai.request.model": model.modelId,
                  "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                  "gen_ai.request.max_tokens": settings.maxTokens,
                  "gen_ai.request.presence_penalty": settings.presencePenalty,
                  "gen_ai.request.temperature": settings.temperature,
                  "gen_ai.request.top_k": settings.topK,
                  "gen_ai.request.top_p": settings.topP
                }
              }),
              tracer,
              fn: async (span2) => {
                var _a18, _b2, _c2, _d2, _e, _f, _g, _h;
                const result2 = await model.doGenerate({
                  mode: {
                    type: "object-tool",
                    tool: {
                      type: "function",
                      name: schemaName != null ? schemaName : "json",
                      description: schemaDescription != null ? schemaDescription : "Respond with a JSON object.",
                      parameters: outputStrategy.jsonSchema
                    }
                  },
                  ...prepareCallSettings(settings),
                  inputFormat,
                  prompt: promptMessages,
                  providerMetadata: providerOptions,
                  abortSignal,
                  headers
                });
                const objectText = (_b2 = (_a18 = result2.toolCalls) == null ? void 0 : _a18[0]) == null ? void 0 : _b2.args;
                const responseData = {
                  id: (_d2 = (_c2 = result2.response) == null ? void 0 : _c2.id) != null ? _d2 : generateId3(),
                  timestamp: (_f = (_e = result2.response) == null ? void 0 : _e.timestamp) != null ? _f : currentDate(),
                  modelId: (_h = (_g = result2.response) == null ? void 0 : _g.modelId) != null ? _h : model.modelId
                };
                if (objectText === void 0) {
                  throw new NoObjectGeneratedError({
                    message: "No object generated: the tool was not called.",
                    response: responseData,
                    usage: calculateLanguageModelUsage(result2.usage),
                    finishReason: result2.finishReason
                  });
                }
                span2.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      "ai.response.finishReason": result2.finishReason,
                      "ai.response.object": { output: () => objectText },
                      "ai.response.id": responseData.id,
                      "ai.response.model": responseData.modelId,
                      "ai.response.timestamp": responseData.timestamp.toISOString(),
                      "ai.response.providerMetadata": JSON.stringify(
                        result2.providerMetadata
                      ),
                      "ai.usage.promptTokens": result2.usage.promptTokens,
                      "ai.usage.completionTokens": result2.usage.completionTokens,
                      // standardized gen-ai llm span attributes:
                      "gen_ai.response.finish_reasons": [result2.finishReason],
                      "gen_ai.response.id": responseData.id,
                      "gen_ai.response.model": responseData.modelId,
                      "gen_ai.usage.input_tokens": result2.usage.promptTokens,
                      "gen_ai.usage.output_tokens": result2.usage.completionTokens
                    }
                  })
                );
                return { ...result2, objectText, responseData };
              }
            })
          );
          result = generateResult.objectText;
          finishReason = generateResult.finishReason;
          usage = generateResult.usage;
          warnings = generateResult.warnings;
          rawResponse = generateResult.rawResponse;
          logprobs = generateResult.logprobs;
          resultProviderMetadata = generateResult.providerMetadata;
          request = (_d = generateResult.request) != null ? _d : {};
          response = generateResult.responseData;
          break;
        }
        case void 0: {
          throw new Error(
            "Model does not have a default object generation mode."
          );
        }
        default: {
          const _exhaustiveCheck = mode;
          throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
        }
      }
      function processResult(result2) {
        const parseResult = safeParseJSON({ text: result2 });
        if (!parseResult.success) {
          throw new NoObjectGeneratedError({
            message: "No object generated: could not parse the response.",
            cause: parseResult.error,
            text: result2,
            response,
            usage: calculateLanguageModelUsage(usage),
            finishReason
          });
        }
        const validationResult = outputStrategy.validateFinalResult(
          parseResult.value,
          {
            text: result2,
            response,
            usage: calculateLanguageModelUsage(usage)
          }
        );
        if (!validationResult.success) {
          throw new NoObjectGeneratedError({
            message: "No object generated: response did not match schema.",
            cause: validationResult.error,
            text: result2,
            response,
            usage: calculateLanguageModelUsage(usage),
            finishReason
          });
        }
        return validationResult.value;
      }
      let object2;
      try {
        object2 = processResult(result);
      } catch (error) {
        if (repairText != null && NoObjectGeneratedError.isInstance(error) && (JSONParseError.isInstance(error.cause) || TypeValidationError2.isInstance(error.cause))) {
          const repairedText = await repairText({
            text: result,
            error: error.cause
          });
          if (repairedText === null) {
            throw error;
          }
          object2 = processResult(repairedText);
        } else {
          throw error;
        }
      }
      span.setAttributes(
        selectTelemetryAttributes({
          telemetry,
          attributes: {
            "ai.response.finishReason": finishReason,
            "ai.response.object": {
              output: () => JSON.stringify(object2)
            },
            "ai.usage.promptTokens": usage.promptTokens,
            "ai.usage.completionTokens": usage.completionTokens
          }
        })
      );
      return new DefaultGenerateObjectResult({
        object: object2,
        finishReason,
        usage: calculateLanguageModelUsage(usage),
        warnings,
        request,
        response: {
          ...response,
          headers: rawResponse == null ? void 0 : rawResponse.headers,
          body: rawResponse == null ? void 0 : rawResponse.body
        },
        logprobs,
        providerMetadata: resultProviderMetadata
      });
    }
  });
}
var DefaultGenerateObjectResult = class {
  constructor(options) {
    this.object = options.object;
    this.finishReason = options.finishReason;
    this.usage = options.usage;
    this.warnings = options.warnings;
    this.providerMetadata = options.providerMetadata;
    this.experimental_providerMetadata = options.providerMetadata;
    this.response = options.response;
    this.request = options.request;
    this.logprobs = options.logprobs;
  }
  toJsonResponse(init) {
    var _a17;
    return new Response(JSON.stringify(this.object), {
      status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
      headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
        contentType: "application/json; charset=utf-8"
      })
    });
  }
};

// core/generate-object/stream-object.ts
import { createIdGenerator as createIdGenerator2 } from "@ai-sdk/provider-utils";
import {
  isDeepEqualData,
  parsePartialJson
} from "@ai-sdk/ui-utils";

// util/delayed-promise.ts
var DelayedPromise = class {
  constructor() {
    this.status = { type: "pending" };
    this._resolve = void 0;
    this._reject = void 0;
  }
  get value() {
    if (this.promise) {
      return this.promise;
    }
    this.promise = new Promise((resolve, reject) => {
      if (this.status.type === "resolved") {
        resolve(this.status.value);
      } else if (this.status.type === "rejected") {
        reject(this.status.error);
      }
      this._resolve = resolve;
      this._reject = reject;
    });
    return this.promise;
  }
  resolve(value) {
    var _a17;
    this.status = { type: "resolved", value };
    if (this.promise) {
      (_a17 = this._resolve) == null ? void 0 : _a17.call(this, value);
    }
  }
  reject(error) {
    var _a17;
    this.status = { type: "rejected", error };
    if (this.promise) {
      (_a17 = this._reject) == null ? void 0 : _a17.call(this, error);
    }
  }
};

// util/create-resolvable-promise.ts
function createResolvablePromise() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject
  };
}

// core/util/create-stitchable-stream.ts
function createStitchableStream() {
  let innerStreamReaders = [];
  let controller = null;
  let isClosed = false;
  let waitForNewStream = createResolvablePromise();
  const processPull = async () => {
    if (isClosed && innerStreamReaders.length === 0) {
      controller == null ? void 0 : controller.close();
      return;
    }
    if (innerStreamReaders.length === 0) {
      waitForNewStream = createResolvablePromise();
      await waitForNewStream.promise;
      return processPull();
    }
    try {
      const { value, done } = await innerStreamReaders[0].read();
      if (done) {
        innerStreamReaders.shift();
        if (innerStreamReaders.length > 0) {
          await processPull();
        } else if (isClosed) {
          controller == null ? void 0 : controller.close();
        }
      } else {
        controller == null ? void 0 : controller.enqueue(value);
      }
    } catch (error) {
      controller == null ? void 0 : controller.error(error);
      innerStreamReaders.shift();
      if (isClosed && innerStreamReaders.length === 0) {
        controller == null ? void 0 : controller.close();
      }
    }
  };
  return {
    stream: new ReadableStream({
      start(controllerParam) {
        controller = controllerParam;
      },
      pull: processPull,
      async cancel() {
        for (const reader of innerStreamReaders) {
          await reader.cancel();
        }
        innerStreamReaders = [];
        isClosed = true;
      }
    }),
    addStream: (innerStream) => {
      if (isClosed) {
        throw new Error("Cannot add inner stream: outer stream is closed");
      }
      innerStreamReaders.push(innerStream.getReader());
      waitForNewStream.resolve();
    },
    /**
     * Gracefully close the outer stream. This will let the inner streams
     * finish processing and then close the outer stream.
     */
    close: () => {
      isClosed = true;
      waitForNewStream.resolve();
      if (innerStreamReaders.length === 0) {
        controller == null ? void 0 : controller.close();
      }
    },
    /**
     * Immediately close the outer stream. This will cancel all inner streams
     * and close the outer stream.
     */
    terminate: () => {
      isClosed = true;
      waitForNewStream.resolve();
      innerStreamReaders.forEach((reader) => reader.cancel());
      innerStreamReaders = [];
      controller == null ? void 0 : controller.close();
    }
  };
}

// core/util/now.ts
function now() {
  var _a17, _b;
  return (_b = (_a17 = globalThis == null ? void 0 : globalThis.performance) == null ? void 0 : _a17.now()) != null ? _b : Date.now();
}

// core/generate-object/stream-object.ts
var originalGenerateId2 = createIdGenerator2({ prefix: "aiobj", size: 24 });
function streamObject({
  model,
  schema: inputSchema,
  schemaName,
  schemaDescription,
  mode,
  output = "object",
  system,
  prompt,
  messages,
  maxRetries,
  abortSignal,
  headers,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions = experimental_providerMetadata,
  onError,
  onFinish,
  _internal: {
    generateId: generateId3 = originalGenerateId2,
    currentDate = () => /* @__PURE__ */ new Date(),
    now: now2 = now
  } = {},
  ...settings
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  validateObjectGenerationInput({
    output,
    mode,
    schema: inputSchema,
    schemaName,
    schemaDescription
  });
  const outputStrategy = getOutputStrategy({ output, schema: inputSchema });
  if (outputStrategy.type === "no-schema" && mode === void 0) {
    mode = "json";
  }
  return new DefaultStreamObjectResult({
    model,
    telemetry,
    headers,
    settings,
    maxRetries,
    abortSignal,
    outputStrategy,
    system,
    prompt,
    messages,
    schemaName,
    schemaDescription,
    providerOptions,
    mode,
    onError,
    onFinish,
    generateId: generateId3,
    currentDate,
    now: now2
  });
}
var DefaultStreamObjectResult = class {
  constructor({
    model,
    headers,
    telemetry,
    settings,
    maxRetries: maxRetriesArg,
    abortSignal,
    outputStrategy,
    system,
    prompt,
    messages,
    schemaName,
    schemaDescription,
    providerOptions,
    mode,
    onError,
    onFinish,
    generateId: generateId3,
    currentDate,
    now: now2
  }) {
    this.objectPromise = new DelayedPromise();
    this.usagePromise = new DelayedPromise();
    this.providerMetadataPromise = new DelayedPromise();
    this.warningsPromise = new DelayedPromise();
    this.requestPromise = new DelayedPromise();
    this.responsePromise = new DelayedPromise();
    const { maxRetries, retry } = prepareRetries({
      maxRetries: maxRetriesArg
    });
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model,
      telemetry,
      headers,
      settings: { ...settings, maxRetries }
    });
    const tracer = getTracer(telemetry);
    const self = this;
    const stitchableStream = createStitchableStream();
    const eventProcessor = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        if (chunk.type === "error") {
          onError == null ? void 0 : onError({ error: chunk.error });
        }
      }
    });
    this.baseStream = stitchableStream.stream.pipeThrough(eventProcessor);
    recordSpan({
      name: "ai.streamObject",
      attributes: selectTelemetryAttributes({
        telemetry,
        attributes: {
          ...assembleOperationName({
            operationId: "ai.streamObject",
            telemetry
          }),
          ...baseTelemetryAttributes,
          // specific settings that only make sense on the outer level:
          "ai.prompt": {
            input: () => JSON.stringify({ system, prompt, messages })
          },
          "ai.schema": outputStrategy.jsonSchema != null ? { input: () => JSON.stringify(outputStrategy.jsonSchema) } : void 0,
          "ai.schema.name": schemaName,
          "ai.schema.description": schemaDescription,
          "ai.settings.output": outputStrategy.type,
          "ai.settings.mode": mode
        }
      }),
      tracer,
      endWhenDone: false,
      fn: async (rootSpan) => {
        var _a17, _b;
        if (mode === "auto" || mode == null) {
          mode = model.defaultObjectGenerationMode;
        }
        let callOptions;
        let transformer;
        switch (mode) {
          case "json": {
            const standardizedPrompt = standardizePrompt({
              prompt: {
                system: outputStrategy.jsonSchema == null ? injectJsonInstruction({ prompt: system }) : model.supportsStructuredOutputs ? system : injectJsonInstruction({
                  prompt: system,
                  schema: outputStrategy.jsonSchema
                }),
                prompt,
                messages
              },
              tools: void 0
            });
            callOptions = {
              mode: {
                type: "object-json",
                schema: outputStrategy.jsonSchema,
                name: schemaName,
                description: schemaDescription
              },
              ...prepareCallSettings(settings),
              inputFormat: standardizedPrompt.type,
              prompt: await convertToLanguageModelPrompt({
                prompt: standardizedPrompt,
                modelSupportsImageUrls: model.supportsImageUrls,
                modelSupportsUrl: (_a17 = model.supportsUrl) == null ? void 0 : _a17.bind(model)
                // support 'this' context
              }),
              providerMetadata: providerOptions,
              abortSignal,
              headers
            };
            transformer = {
              transform: (chunk, controller) => {
                switch (chunk.type) {
                  case "text-delta":
                    controller.enqueue(chunk.textDelta);
                    break;
                  case "response-metadata":
                  case "finish":
                  case "error":
                    controller.enqueue(chunk);
                    break;
                }
              }
            };
            break;
          }
          case "tool": {
            const standardizedPrompt = standardizePrompt({
              prompt: { system, prompt, messages },
              tools: void 0
            });
            callOptions = {
              mode: {
                type: "object-tool",
                tool: {
                  type: "function",
                  name: schemaName != null ? schemaName : "json",
                  description: schemaDescription != null ? schemaDescription : "Respond with a JSON object.",
                  parameters: outputStrategy.jsonSchema
                }
              },
              ...prepareCallSettings(settings),
              inputFormat: standardizedPrompt.type,
              prompt: await convertToLanguageModelPrompt({
                prompt: standardizedPrompt,
                modelSupportsImageUrls: model.supportsImageUrls,
                modelSupportsUrl: (_b = model.supportsUrl) == null ? void 0 : _b.bind(model)
                // support 'this' context,
              }),
              providerMetadata: providerOptions,
              abortSignal,
              headers
            };
            transformer = {
              transform(chunk, controller) {
                switch (chunk.type) {
                  case "tool-call-delta":
                    controller.enqueue(chunk.argsTextDelta);
                    break;
                  case "response-metadata":
                  case "finish":
                  case "error":
                    controller.enqueue(chunk);
                    break;
                }
              }
            };
            break;
          }
          case void 0: {
            throw new Error(
              "Model does not have a default object generation mode."
            );
          }
          default: {
            const _exhaustiveCheck = mode;
            throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
          }
        }
        const {
          result: { stream, warnings, rawResponse, request },
          doStreamSpan,
          startTimestampMs
        } = await retry(
          () => recordSpan({
            name: "ai.streamObject.doStream",
            attributes: selectTelemetryAttributes({
              telemetry,
              attributes: {
                ...assembleOperationName({
                  operationId: "ai.streamObject.doStream",
                  telemetry
                }),
                ...baseTelemetryAttributes,
                "ai.prompt.format": {
                  input: () => callOptions.inputFormat
                },
                "ai.prompt.messages": {
                  input: () => stringifyForTelemetry(callOptions.prompt)
                },
                "ai.settings.mode": mode,
                // standardized gen-ai llm span attributes:
                "gen_ai.system": model.provider,
                "gen_ai.request.model": model.modelId,
                "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                "gen_ai.request.max_tokens": settings.maxTokens,
                "gen_ai.request.presence_penalty": settings.presencePenalty,
                "gen_ai.request.temperature": settings.temperature,
                "gen_ai.request.top_k": settings.topK,
                "gen_ai.request.top_p": settings.topP
              }
            }),
            tracer,
            endWhenDone: false,
            fn: async (doStreamSpan2) => ({
              startTimestampMs: now2(),
              doStreamSpan: doStreamSpan2,
              result: await model.doStream(callOptions)
            })
          })
        );
        self.requestPromise.resolve(request != null ? request : {});
        let usage;
        let finishReason;
        let providerMetadata;
        let object2;
        let error;
        let accumulatedText = "";
        let textDelta = "";
        let response = {
          id: generateId3(),
          timestamp: currentDate(),
          modelId: model.modelId
        };
        let latestObjectJson = void 0;
        let latestObject = void 0;
        let isFirstChunk = true;
        let isFirstDelta = true;
        const transformedStream = stream.pipeThrough(new TransformStream(transformer)).pipeThrough(
          new TransformStream({
            async transform(chunk, controller) {
              var _a18, _b2, _c;
              if (isFirstChunk) {
                const msToFirstChunk = now2() - startTimestampMs;
                isFirstChunk = false;
                doStreamSpan.addEvent("ai.stream.firstChunk", {
                  "ai.stream.msToFirstChunk": msToFirstChunk
                });
                doStreamSpan.setAttributes({
                  "ai.stream.msToFirstChunk": msToFirstChunk
                });
              }
              if (typeof chunk === "string") {
                accumulatedText += chunk;
                textDelta += chunk;
                const { value: currentObjectJson, state: parseState } = parsePartialJson(accumulatedText);
                if (currentObjectJson !== void 0 && !isDeepEqualData(latestObjectJson, currentObjectJson)) {
                  const validationResult = outputStrategy.validatePartialResult({
                    value: currentObjectJson,
                    textDelta,
                    latestObject,
                    isFirstDelta,
                    isFinalDelta: parseState === "successful-parse"
                  });
                  if (validationResult.success && !isDeepEqualData(
                    latestObject,
                    validationResult.value.partial
                  )) {
                    latestObjectJson = currentObjectJson;
                    latestObject = validationResult.value.partial;
                    controller.enqueue({
                      type: "object",
                      object: latestObject
                    });
                    controller.enqueue({
                      type: "text-delta",
                      textDelta: validationResult.value.textDelta
                    });
                    textDelta = "";
                    isFirstDelta = false;
                  }
                }
                return;
              }
              switch (chunk.type) {
                case "response-metadata": {
                  response = {
                    id: (_a18 = chunk.id) != null ? _a18 : response.id,
                    timestamp: (_b2 = chunk.timestamp) != null ? _b2 : response.timestamp,
                    modelId: (_c = chunk.modelId) != null ? _c : response.modelId
                  };
                  break;
                }
                case "finish": {
                  if (textDelta !== "") {
                    controller.enqueue({ type: "text-delta", textDelta });
                  }
                  finishReason = chunk.finishReason;
                  usage = calculateLanguageModelUsage(chunk.usage);
                  providerMetadata = chunk.providerMetadata;
                  controller.enqueue({ ...chunk, usage, response });
                  self.usagePromise.resolve(usage);
                  self.providerMetadataPromise.resolve(providerMetadata);
                  self.responsePromise.resolve({
                    ...response,
                    headers: rawResponse == null ? void 0 : rawResponse.headers
                  });
                  const validationResult = outputStrategy.validateFinalResult(
                    latestObjectJson,
                    {
                      text: accumulatedText,
                      response,
                      usage
                    }
                  );
                  if (validationResult.success) {
                    object2 = validationResult.value;
                    self.objectPromise.resolve(object2);
                  } else {
                    error = new NoObjectGeneratedError({
                      message: "No object generated: response did not match schema.",
                      cause: validationResult.error,
                      text: accumulatedText,
                      response,
                      usage,
                      finishReason
                    });
                    self.objectPromise.reject(error);
                  }
                  break;
                }
                default: {
                  controller.enqueue(chunk);
                  break;
                }
              }
            },
            // invoke onFinish callback and resolve toolResults promise when the stream is about to close:
            async flush(controller) {
              try {
                const finalUsage = usage != null ? usage : {
                  promptTokens: NaN,
                  completionTokens: NaN,
                  totalTokens: NaN
                };
                doStreamSpan.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      "ai.response.finishReason": finishReason,
                      "ai.response.object": {
                        output: () => JSON.stringify(object2)
                      },
                      "ai.response.id": response.id,
                      "ai.response.model": response.modelId,
                      "ai.response.timestamp": response.timestamp.toISOString(),
                      "ai.response.providerMetadata": JSON.stringify(providerMetadata),
                      "ai.usage.promptTokens": finalUsage.promptTokens,
                      "ai.usage.completionTokens": finalUsage.completionTokens,
                      // standardized gen-ai llm span attributes:
                      "gen_ai.response.finish_reasons": [finishReason],
                      "gen_ai.response.id": response.id,
                      "gen_ai.response.model": response.modelId,
                      "gen_ai.usage.input_tokens": finalUsage.promptTokens,
                      "gen_ai.usage.output_tokens": finalUsage.completionTokens
                    }
                  })
                );
                doStreamSpan.end();
                rootSpan.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      "ai.usage.promptTokens": finalUsage.promptTokens,
                      "ai.usage.completionTokens": finalUsage.completionTokens,
                      "ai.response.object": {
                        output: () => JSON.stringify(object2)
                      },
                      "ai.response.providerMetadata": JSON.stringify(providerMetadata)
                    }
                  })
                );
                await (onFinish == null ? void 0 : onFinish({
                  usage: finalUsage,
                  object: object2,
                  error,
                  response: {
                    ...response,
                    headers: rawResponse == null ? void 0 : rawResponse.headers
                  },
                  warnings,
                  providerMetadata,
                  experimental_providerMetadata: providerMetadata
                }));
              } catch (error2) {
                controller.enqueue({ type: "error", error: error2 });
              } finally {
                rootSpan.end();
              }
            }
          })
        );
        stitchableStream.addStream(transformedStream);
      }
    }).catch((error) => {
      stitchableStream.addStream(
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "error", error });
            controller.close();
          }
        })
      );
    }).finally(() => {
      stitchableStream.close();
    });
    this.outputStrategy = outputStrategy;
  }
  get object() {
    return this.objectPromise.value;
  }
  get usage() {
    return this.usagePromise.value;
  }
  get experimental_providerMetadata() {
    return this.providerMetadataPromise.value;
  }
  get providerMetadata() {
    return this.providerMetadataPromise.value;
  }
  get warnings() {
    return this.warningsPromise.value;
  }
  get request() {
    return this.requestPromise.value;
  }
  get response() {
    return this.responsePromise.value;
  }
  get partialObjectStream() {
    return createAsyncIterableStream(
      this.baseStream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            switch (chunk.type) {
              case "object":
                controller.enqueue(chunk.object);
                break;
              case "text-delta":
              case "finish":
              case "error":
                break;
              default: {
                const _exhaustiveCheck = chunk;
                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
              }
            }
          }
        })
      )
    );
  }
  get elementStream() {
    return this.outputStrategy.createElementStream(this.baseStream);
  }
  get textStream() {
    return createAsyncIterableStream(
      this.baseStream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            switch (chunk.type) {
              case "text-delta":
                controller.enqueue(chunk.textDelta);
                break;
              case "object":
              case "finish":
              case "error":
                break;
              default: {
                const _exhaustiveCheck = chunk;
                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
              }
            }
          }
        })
      )
    );
  }
  get fullStream() {
    return createAsyncIterableStream(this.baseStream);
  }
  pipeTextStreamToResponse(response, init) {
    writeToServerResponse({
      response,
      status: init == null ? void 0 : init.status,
      statusText: init == null ? void 0 : init.statusText,
      headers: prepareOutgoingHttpHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8"
      }),
      stream: this.textStream.pipeThrough(new TextEncoderStream())
    });
  }
  toTextStreamResponse(init) {
    var _a17;
    return new Response(this.textStream.pipeThrough(new TextEncoderStream()), {
      status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
      headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8"
      })
    });
  }
};

// core/generate-text/generate-text.ts
import { createIdGenerator as createIdGenerator3 } from "@ai-sdk/provider-utils";

// errors/no-output-specified-error.ts
import { AISDKError as AISDKError10 } from "@ai-sdk/provider";
var name9 = "AI_NoOutputSpecifiedError";
var marker9 = `vercel.ai.error.${name9}`;
var symbol9 = Symbol.for(marker9);
var _a9;
var NoOutputSpecifiedError = class extends AISDKError10 {
  // used in isInstance
  constructor({ message = "No output specified." } = {}) {
    super({ name: name9, message });
    this[_a9] = true;
  }
  static isInstance(error) {
    return AISDKError10.hasMarker(error, marker9);
  }
};
_a9 = symbol9;

// errors/tool-execution-error.ts
import { AISDKError as AISDKError11, getErrorMessage as getErrorMessage2 } from "@ai-sdk/provider";
var name10 = "AI_ToolExecutionError";
var marker10 = `vercel.ai.error.${name10}`;
var symbol10 = Symbol.for(marker10);
var _a10;
var ToolExecutionError = class extends AISDKError11 {
  constructor({
    toolArgs,
    toolName,
    toolCallId,
    cause,
    message = `Error executing tool ${toolName}: ${getErrorMessage2(cause)}`
  }) {
    super({ name: name10, message, cause });
    this[_a10] = true;
    this.toolArgs = toolArgs;
    this.toolName = toolName;
    this.toolCallId = toolCallId;
  }
  static isInstance(error) {
    return AISDKError11.hasMarker(error, marker10);
  }
};
_a10 = symbol10;

// core/prompt/prepare-tools-and-tool-choice.ts
import { asSchema as asSchema2 } from "@ai-sdk/ui-utils";

// core/util/is-non-empty-object.ts
function isNonEmptyObject(object2) {
  return object2 != null && Object.keys(object2).length > 0;
}

// core/prompt/prepare-tools-and-tool-choice.ts
function prepareToolsAndToolChoice({
  tools,
  toolChoice,
  activeTools
}) {
  if (!isNonEmptyObject(tools)) {
    return {
      tools: void 0,
      toolChoice: void 0
    };
  }
  const filteredTools = activeTools != null ? Object.entries(tools).filter(
    ([name17]) => activeTools.includes(name17)
  ) : Object.entries(tools);
  return {
    tools: filteredTools.map(([name17, tool2]) => {
      const toolType = tool2.type;
      switch (toolType) {
        case void 0:
        case "function":
          return {
            type: "function",
            name: name17,
            description: tool2.description,
            parameters: asSchema2(tool2.parameters).jsonSchema
          };
        case "provider-defined":
          return {
            type: "provider-defined",
            name: name17,
            id: tool2.id,
            args: tool2.args
          };
        default: {
          const exhaustiveCheck = toolType;
          throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
        }
      }
    }),
    toolChoice: toolChoice == null ? { type: "auto" } : typeof toolChoice === "string" ? { type: toolChoice } : { type: "tool", toolName: toolChoice.toolName }
  };
}

// core/util/split-on-last-whitespace.ts
var lastWhitespaceRegexp = /^([\s\S]*?)(\s+)(\S*)$/;
function splitOnLastWhitespace(text2) {
  const match = text2.match(lastWhitespaceRegexp);
  return match ? { prefix: match[1], whitespace: match[2], suffix: match[3] } : void 0;
}

// core/util/remove-text-after-last-whitespace.ts
function removeTextAfterLastWhitespace(text2) {
  const match = splitOnLastWhitespace(text2);
  return match ? match.prefix + match.whitespace : text2;
}

// core/generate-text/parse-tool-call.ts
import { safeParseJSON as safeParseJSON2, safeValidateTypes as safeValidateTypes3 } from "@ai-sdk/provider-utils";
import { asSchema as asSchema3 } from "@ai-sdk/ui-utils";

// errors/invalid-tool-arguments-error.ts
import { AISDKError as AISDKError12, getErrorMessage as getErrorMessage3 } from "@ai-sdk/provider";
var name11 = "AI_InvalidToolArgumentsError";
var marker11 = `vercel.ai.error.${name11}`;
var symbol11 = Symbol.for(marker11);
var _a11;
var InvalidToolArgumentsError = class extends AISDKError12 {
  constructor({
    toolArgs,
    toolName,
    cause,
    message = `Invalid arguments for tool ${toolName}: ${getErrorMessage3(
      cause
    )}`
  }) {
    super({ name: name11, message, cause });
    this[_a11] = true;
    this.toolArgs = toolArgs;
    this.toolName = toolName;
  }
  static isInstance(error) {
    return AISDKError12.hasMarker(error, marker11);
  }
};
_a11 = symbol11;

// errors/no-such-tool-error.ts
import { AISDKError as AISDKError13 } from "@ai-sdk/provider";
var name12 = "AI_NoSuchToolError";
var marker12 = `vercel.ai.error.${name12}`;
var symbol12 = Symbol.for(marker12);
var _a12;
var NoSuchToolError = class extends AISDKError13 {
  constructor({
    toolName,
    availableTools = void 0,
    message = `Model tried to call unavailable tool '${toolName}'. ${availableTools === void 0 ? "No tools are available." : `Available tools: ${availableTools.join(", ")}.`}`
  }) {
    super({ name: name12, message });
    this[_a12] = true;
    this.toolName = toolName;
    this.availableTools = availableTools;
  }
  static isInstance(error) {
    return AISDKError13.hasMarker(error, marker12);
  }
};
_a12 = symbol12;

// errors/tool-call-repair-error.ts
import { AISDKError as AISDKError14, getErrorMessage as getErrorMessage4 } from "@ai-sdk/provider";
var name13 = "AI_ToolCallRepairError";
var marker13 = `vercel.ai.error.${name13}`;
var symbol13 = Symbol.for(marker13);
var _a13;
var ToolCallRepairError = class extends AISDKError14 {
  constructor({
    cause,
    originalError,
    message = `Error repairing tool call: ${getErrorMessage4(cause)}`
  }) {
    super({ name: name13, message, cause });
    this[_a13] = true;
    this.originalError = originalError;
  }
  static isInstance(error) {
    return AISDKError14.hasMarker(error, marker13);
  }
};
_a13 = symbol13;

// core/generate-text/parse-tool-call.ts
async function parseToolCall({
  toolCall,
  tools,
  repairToolCall,
  system,
  messages
}) {
  if (tools == null) {
    throw new NoSuchToolError({ toolName: toolCall.toolName });
  }
  try {
    return await doParseToolCall({ toolCall, tools });
  } catch (error) {
    if (repairToolCall == null || !(NoSuchToolError.isInstance(error) || InvalidToolArgumentsError.isInstance(error))) {
      throw error;
    }
    let repairedToolCall = null;
    try {
      repairedToolCall = await repairToolCall({
        toolCall,
        tools,
        parameterSchema: ({ toolName }) => asSchema3(tools[toolName].parameters).jsonSchema,
        system,
        messages,
        error
      });
    } catch (repairError) {
      throw new ToolCallRepairError({
        cause: repairError,
        originalError: error
      });
    }
    if (repairedToolCall == null) {
      throw error;
    }
    return await doParseToolCall({ toolCall: repairedToolCall, tools });
  }
}
async function doParseToolCall({
  toolCall,
  tools
}) {
  const toolName = toolCall.toolName;
  const tool2 = tools[toolName];
  if (tool2 == null) {
    throw new NoSuchToolError({
      toolName: toolCall.toolName,
      availableTools: Object.keys(tools)
    });
  }
  const schema = asSchema3(tool2.parameters);
  const parseResult = toolCall.args.trim() === "" ? safeValidateTypes3({ value: {}, schema }) : safeParseJSON2({ text: toolCall.args, schema });
  if (parseResult.success === false) {
    throw new InvalidToolArgumentsError({
      toolName,
      toolArgs: toolCall.args,
      cause: parseResult.error
    });
  }
  return {
    type: "tool-call",
    toolCallId: toolCall.toolCallId,
    toolName,
    args: parseResult.value
  };
}

// core/generate-text/reasoning-detail.ts
function asReasoningText(reasoning) {
  const reasoningText = reasoning.filter((part) => part.type === "text").map((part) => part.text).join("");
  return reasoningText.length > 0 ? reasoningText : void 0;
}

// core/generate-text/to-response-messages.ts
function toResponseMessages({
  text: text2 = "",
  files,
  reasoning,
  tools,
  toolCalls,
  toolResults,
  messageId,
  generateMessageId
}) {
  const responseMessages = [];
  const content = [];
  if (reasoning.length > 0) {
    content.push(
      ...reasoning.map(
        (part) => part.type === "text" ? { ...part, type: "reasoning" } : { ...part, type: "redacted-reasoning" }
      )
    );
  }
  if (files.length > 0) {
    content.push(
      ...files.map((file) => ({
        type: "file",
        data: file.base64,
        mimeType: file.mimeType
      }))
    );
  }
  if (text2.length > 0) {
    content.push({ type: "text", text: text2 });
  }
  if (toolCalls.length > 0) {
    content.push(...toolCalls);
  }
  if (content.length > 0) {
    responseMessages.push({
      role: "assistant",
      content,
      id: messageId
    });
  }
  if (toolResults.length > 0) {
    responseMessages.push({
      role: "tool",
      id: generateMessageId(),
      content: toolResults.map((toolResult) => {
        const tool2 = tools[toolResult.toolName];
        return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
          type: "tool-result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          result: tool2.experimental_toToolResultContent(toolResult.result),
          experimental_content: tool2.experimental_toToolResultContent(
            toolResult.result
          )
        } : {
          type: "tool-result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          result: toolResult.result
        };
      })
    });
  }
  return responseMessages;
}

// core/generate-text/generate-text.ts
var originalGenerateId3 = createIdGenerator3({
  prefix: "aitxt",
  size: 24
});
var originalGenerateMessageId = createIdGenerator3({
  prefix: "msg",
  size: 24
});
async function generateText({
  model,
  tools,
  toolChoice,
  system,
  prompt,
  messages,
  maxRetries: maxRetriesArg,
  abortSignal,
  headers,
  maxSteps = 1,
  experimental_generateMessageId: generateMessageId = originalGenerateMessageId,
  experimental_output: output,
  experimental_continueSteps: continueSteps = false,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions = experimental_providerMetadata,
  experimental_activeTools: activeTools,
  experimental_prepareStep: prepareStep,
  experimental_repairToolCall: repairToolCall,
  _internal: {
    generateId: generateId3 = originalGenerateId3,
    currentDate = () => /* @__PURE__ */ new Date()
  } = {},
  onStepFinish,
  ...settings
}) {
  var _a17;
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  if (maxSteps < 1) {
    throw new InvalidArgumentError({
      parameter: "maxSteps",
      value: maxSteps,
      message: "maxSteps must be at least 1"
    });
  }
  const { maxRetries, retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model,
    telemetry,
    headers,
    settings: { ...settings, maxRetries }
  });
  const initialPrompt = standardizePrompt({
    prompt: {
      system: (_a17 = output == null ? void 0 : output.injectIntoSystemPrompt({ system, model })) != null ? _a17 : system,
      prompt,
      messages
    },
    tools
  });
  const tracer = getTracer(telemetry);
  return recordSpan({
    name: "ai.generateText",
    attributes: selectTelemetryAttributes({
      telemetry,
      attributes: {
        ...assembleOperationName({
          operationId: "ai.generateText",
          telemetry
        }),
        ...baseTelemetryAttributes,
        // model:
        "ai.model.provider": model.provider,
        "ai.model.id": model.modelId,
        // specific settings that only make sense on the outer level:
        "ai.prompt": {
          input: () => JSON.stringify({ system, prompt, messages })
        },
        "ai.settings.maxSteps": maxSteps
      }
    }),
    tracer,
    fn: async (span) => {
      var _a18, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      const callSettings = prepareCallSettings(settings);
      let currentModelResponse;
      let currentToolCalls = [];
      let currentToolResults = [];
      let currentReasoningDetails = [];
      let stepCount = 0;
      const responseMessages = [];
      let text2 = "";
      const sources = [];
      const steps = [];
      let usage = {
        completionTokens: 0,
        promptTokens: 0,
        totalTokens: 0
      };
      let stepType = "initial";
      do {
        const promptFormat = stepCount === 0 ? initialPrompt.type : "messages";
        const stepInputMessages = [
          ...initialPrompt.messages,
          ...responseMessages
        ];
        const prepareStepResult = await (prepareStep == null ? void 0 : prepareStep({
          model,
          steps,
          maxSteps,
          stepNumber: stepCount
        }));
        const stepToolChoice = (_a18 = prepareStepResult == null ? void 0 : prepareStepResult.toolChoice) != null ? _a18 : toolChoice;
        const stepActiveTools = (_b = prepareStepResult == null ? void 0 : prepareStepResult.experimental_activeTools) != null ? _b : activeTools;
        const stepModel = (_c = prepareStepResult == null ? void 0 : prepareStepResult.model) != null ? _c : model;
        const promptMessages = await convertToLanguageModelPrompt({
          prompt: {
            type: promptFormat,
            system: initialPrompt.system,
            messages: stepInputMessages
          },
          modelSupportsImageUrls: stepModel.supportsImageUrls,
          modelSupportsUrl: (_d = stepModel.supportsUrl) == null ? void 0 : _d.bind(stepModel)
          // support 'this' context
        });
        const mode = {
          type: "regular",
          ...prepareToolsAndToolChoice({
            tools,
            toolChoice: stepToolChoice,
            activeTools: stepActiveTools
          })
        };
        currentModelResponse = await retry(
          () => recordSpan({
            name: "ai.generateText.doGenerate",
            attributes: selectTelemetryAttributes({
              telemetry,
              attributes: {
                ...assembleOperationName({
                  operationId: "ai.generateText.doGenerate",
                  telemetry
                }),
                ...baseTelemetryAttributes,
                // model:
                "ai.model.provider": stepModel.provider,
                "ai.model.id": stepModel.modelId,
                // prompt:
                "ai.prompt.format": { input: () => promptFormat },
                "ai.prompt.messages": {
                  input: () => stringifyForTelemetry(promptMessages)
                },
                "ai.prompt.tools": {
                  // convert the language model level tools:
                  input: () => {
                    var _a19;
                    return (_a19 = mode.tools) == null ? void 0 : _a19.map((tool2) => JSON.stringify(tool2));
                  }
                },
                "ai.prompt.toolChoice": {
                  input: () => mode.toolChoice != null ? JSON.stringify(mode.toolChoice) : void 0
                },
                // standardized gen-ai llm span attributes:
                "gen_ai.system": stepModel.provider,
                "gen_ai.request.model": stepModel.modelId,
                "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                "gen_ai.request.max_tokens": settings.maxTokens,
                "gen_ai.request.presence_penalty": settings.presencePenalty,
                "gen_ai.request.stop_sequences": settings.stopSequences,
                "gen_ai.request.temperature": settings.temperature,
                "gen_ai.request.top_k": settings.topK,
                "gen_ai.request.top_p": settings.topP
              }
            }),
            tracer,
            fn: async (span2) => {
              var _a19, _b2, _c2, _d2, _e2, _f2;
              const result = await stepModel.doGenerate({
                mode,
                ...callSettings,
                inputFormat: promptFormat,
                responseFormat: output == null ? void 0 : output.responseFormat({ model }),
                prompt: promptMessages,
                providerMetadata: providerOptions,
                abortSignal,
                headers
              });
              const responseData = {
                id: (_b2 = (_a19 = result.response) == null ? void 0 : _a19.id) != null ? _b2 : generateId3(),
                timestamp: (_d2 = (_c2 = result.response) == null ? void 0 : _c2.timestamp) != null ? _d2 : currentDate(),
                modelId: (_f2 = (_e2 = result.response) == null ? void 0 : _e2.modelId) != null ? _f2 : stepModel.modelId
              };
              span2.setAttributes(
                selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    "ai.response.finishReason": result.finishReason,
                    "ai.response.text": {
                      output: () => result.text
                    },
                    "ai.response.toolCalls": {
                      output: () => JSON.stringify(result.toolCalls)
                    },
                    "ai.response.id": responseData.id,
                    "ai.response.model": responseData.modelId,
                    "ai.response.timestamp": responseData.timestamp.toISOString(),
                    "ai.response.providerMetadata": JSON.stringify(
                      result.providerMetadata
                    ),
                    "ai.usage.promptTokens": result.usage.promptTokens,
                    "ai.usage.completionTokens": result.usage.completionTokens,
                    // standardized gen-ai llm span attributes:
                    "gen_ai.response.finish_reasons": [result.finishReason],
                    "gen_ai.response.id": responseData.id,
                    "gen_ai.response.model": responseData.modelId,
                    "gen_ai.usage.input_tokens": result.usage.promptTokens,
                    "gen_ai.usage.output_tokens": result.usage.completionTokens
                  }
                })
              );
              return { ...result, response: responseData };
            }
          })
        );
        currentToolCalls = await Promise.all(
          ((_e = currentModelResponse.toolCalls) != null ? _e : []).map(
            (toolCall) => parseToolCall({
              toolCall,
              tools,
              repairToolCall,
              system,
              messages: stepInputMessages
            })
          )
        );
        currentToolResults = tools == null ? [] : await executeTools({
          toolCalls: currentToolCalls,
          tools,
          tracer,
          telemetry,
          messages: stepInputMessages,
          abortSignal
        });
        const currentUsage = calculateLanguageModelUsage(
          currentModelResponse.usage
        );
        usage = addLanguageModelUsage(usage, currentUsage);
        let nextStepType = "done";
        if (++stepCount < maxSteps) {
          if (continueSteps && currentModelResponse.finishReason === "length" && // only use continue when there are no tool calls:
          currentToolCalls.length === 0) {
            nextStepType = "continue";
          } else if (
            // there are tool calls:
            currentToolCalls.length > 0 && // all current tool calls have results:
            currentToolResults.length === currentToolCalls.length
          ) {
            nextStepType = "tool-result";
          }
        }
        const originalText = (_f = currentModelResponse.text) != null ? _f : "";
        const stepTextLeadingWhitespaceTrimmed = stepType === "continue" && // only for continue steps
        text2.trimEnd() !== text2 ? originalText.trimStart() : originalText;
        const stepText = nextStepType === "continue" ? removeTextAfterLastWhitespace(stepTextLeadingWhitespaceTrimmed) : stepTextLeadingWhitespaceTrimmed;
        text2 = nextStepType === "continue" || stepType === "continue" ? text2 + stepText : stepText;
        currentReasoningDetails = asReasoningDetails(
          currentModelResponse.reasoning
        );
        sources.push(...(_g = currentModelResponse.sources) != null ? _g : []);
        if (stepType === "continue") {
          const lastMessage = responseMessages[responseMessages.length - 1];
          if (typeof lastMessage.content === "string") {
            lastMessage.content += stepText;
          } else {
            lastMessage.content.push({
              text: stepText,
              type: "text"
            });
          }
        } else {
          responseMessages.push(
            ...toResponseMessages({
              text: text2,
              files: asFiles(currentModelResponse.files),
              reasoning: asReasoningDetails(currentModelResponse.reasoning),
              tools: tools != null ? tools : {},
              toolCalls: currentToolCalls,
              toolResults: currentToolResults,
              messageId: generateMessageId(),
              generateMessageId
            })
          );
        }
        const currentStepResult = {
          stepType,
          text: stepText,
          // TODO v5: rename reasoning to reasoningText (and use reasoning for composite array)
          reasoning: asReasoningText(currentReasoningDetails),
          reasoningDetails: currentReasoningDetails,
          files: asFiles(currentModelResponse.files),
          sources: (_h = currentModelResponse.sources) != null ? _h : [],
          toolCalls: currentToolCalls,
          toolResults: currentToolResults,
          finishReason: currentModelResponse.finishReason,
          usage: currentUsage,
          warnings: currentModelResponse.warnings,
          logprobs: currentModelResponse.logprobs,
          request: (_i = currentModelResponse.request) != null ? _i : {},
          response: {
            ...currentModelResponse.response,
            headers: (_j = currentModelResponse.rawResponse) == null ? void 0 : _j.headers,
            body: (_k = currentModelResponse.rawResponse) == null ? void 0 : _k.body,
            // deep clone msgs to avoid mutating past messages in multi-step:
            messages: structuredClone(responseMessages)
          },
          providerMetadata: currentModelResponse.providerMetadata,
          experimental_providerMetadata: currentModelResponse.providerMetadata,
          isContinued: nextStepType === "continue"
        };
        steps.push(currentStepResult);
        await (onStepFinish == null ? void 0 : onStepFinish(currentStepResult));
        stepType = nextStepType;
      } while (stepType !== "done");
      span.setAttributes(
        selectTelemetryAttributes({
          telemetry,
          attributes: {
            "ai.response.finishReason": currentModelResponse.finishReason,
            "ai.response.text": {
              output: () => currentModelResponse.text
            },
            "ai.response.toolCalls": {
              output: () => JSON.stringify(currentModelResponse.toolCalls)
            },
            "ai.usage.promptTokens": currentModelResponse.usage.promptTokens,
            "ai.usage.completionTokens": currentModelResponse.usage.completionTokens,
            "ai.response.providerMetadata": JSON.stringify(
              currentModelResponse.providerMetadata
            )
          }
        })
      );
      return new DefaultGenerateTextResult({
        text: text2,
        files: asFiles(currentModelResponse.files),
        reasoning: asReasoningText(currentReasoningDetails),
        reasoningDetails: currentReasoningDetails,
        sources,
        outputResolver: () => {
          if (output == null) {
            throw new NoOutputSpecifiedError();
          }
          return output.parseOutput(
            { text: text2 },
            {
              response: currentModelResponse.response,
              usage,
              finishReason: currentModelResponse.finishReason
            }
          );
        },
        toolCalls: currentToolCalls,
        toolResults: currentToolResults,
        finishReason: currentModelResponse.finishReason,
        usage,
        warnings: currentModelResponse.warnings,
        request: (_l = currentModelResponse.request) != null ? _l : {},
        response: {
          ...currentModelResponse.response,
          headers: (_m = currentModelResponse.rawResponse) == null ? void 0 : _m.headers,
          body: (_n = currentModelResponse.rawResponse) == null ? void 0 : _n.body,
          messages: responseMessages
        },
        logprobs: currentModelResponse.logprobs,
        steps,
        providerMetadata: currentModelResponse.providerMetadata
      });
    }
  });
}
async function executeTools({
  toolCalls,
  tools,
  tracer,
  telemetry,
  messages,
  abortSignal
}) {
  const toolResults = await Promise.all(
    toolCalls.map(async ({ toolCallId, toolName, args }) => {
      const tool2 = tools[toolName];
      if ((tool2 == null ? void 0 : tool2.execute) == null) {
        return void 0;
      }
      const result = await recordSpan({
        name: "ai.toolCall",
        attributes: selectTelemetryAttributes({
          telemetry,
          attributes: {
            ...assembleOperationName({
              operationId: "ai.toolCall",
              telemetry
            }),
            "ai.toolCall.name": toolName,
            "ai.toolCall.id": toolCallId,
            "ai.toolCall.args": {
              output: () => JSON.stringify(args)
            }
          }
        }),
        tracer,
        fn: async (span) => {
          try {
            const result2 = await tool2.execute(args, {
              toolCallId,
              messages,
              abortSignal
            });
            try {
              span.setAttributes(
                selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    "ai.toolCall.result": {
                      output: () => JSON.stringify(result2)
                    }
                  }
                })
              );
            } catch (ignored) {
            }
            return result2;
          } catch (error) {
            recordErrorOnSpan(span, error);
            throw new ToolExecutionError({
              toolCallId,
              toolName,
              toolArgs: args,
              cause: error
            });
          }
        }
      });
      return {
        type: "tool-result",
        toolCallId,
        toolName,
        args,
        result
      };
    })
  );
  return toolResults.filter(
    (result) => result != null
  );
}
var DefaultGenerateTextResult = class {
  constructor(options) {
    this.text = options.text;
    this.files = options.files;
    this.reasoning = options.reasoning;
    this.reasoningDetails = options.reasoningDetails;
    this.toolCalls = options.toolCalls;
    this.toolResults = options.toolResults;
    this.finishReason = options.finishReason;
    this.usage = options.usage;
    this.warnings = options.warnings;
    this.request = options.request;
    this.response = options.response;
    this.steps = options.steps;
    this.experimental_providerMetadata = options.providerMetadata;
    this.providerMetadata = options.providerMetadata;
    this.logprobs = options.logprobs;
    this.outputResolver = options.outputResolver;
    this.sources = options.sources;
  }
  get experimental_output() {
    return this.outputResolver();
  }
};
function asReasoningDetails(reasoning) {
  if (reasoning == null) {
    return [];
  }
  if (typeof reasoning === "string") {
    return [{ type: "text", text: reasoning }];
  }
  return reasoning;
}
function asFiles(files) {
  var _a17;
  return (_a17 = files == null ? void 0 : files.map((file) => new DefaultGeneratedFile(file))) != null ? _a17 : [];
}

// core/generate-text/output.ts
var output_exports = {};
__export(output_exports, {
  object: () => object,
  text: () => text
});
import { safeParseJSON as safeParseJSON3, safeValidateTypes as safeValidateTypes4 } from "@ai-sdk/provider-utils";
import {
  asSchema as asSchema4,
  parsePartialJson as parsePartialJson2
} from "@ai-sdk/ui-utils";

// errors/index.ts
import {
  AISDKError as AISDKError17,
  APICallError as APICallError2,
  EmptyResponseBodyError,
  InvalidPromptError as InvalidPromptError2,
  InvalidResponseDataError,
  JSONParseError as JSONParseError2,
  LoadAPIKeyError,
  NoContentGeneratedError,
  NoSuchModelError,
  TypeValidationError as TypeValidationError3,
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";

// errors/invalid-stream-part-error.ts
import { AISDKError as AISDKError15 } from "@ai-sdk/provider";
var name14 = "AI_InvalidStreamPartError";
var marker14 = `vercel.ai.error.${name14}`;
var symbol14 = Symbol.for(marker14);
var _a14;
var InvalidStreamPartError = class extends AISDKError15 {
  constructor({
    chunk,
    message
  }) {
    super({ name: name14, message });
    this[_a14] = true;
    this.chunk = chunk;
  }
  static isInstance(error) {
    return AISDKError15.hasMarker(error, marker14);
  }
};
_a14 = symbol14;

// errors/mcp-client-error.ts
import { AISDKError as AISDKError16 } from "@ai-sdk/provider";
var name15 = "AI_MCPClientError";
var marker15 = `vercel.ai.error.${name15}`;
var symbol15 = Symbol.for(marker15);
var _a15;
var MCPClientError = class extends AISDKError16 {
  constructor({
    name: name17 = "MCPClientError",
    message,
    cause
  }) {
    super({ name: name17, message, cause });
    this[_a15] = true;
  }
  static isInstance(error) {
    return AISDKError16.hasMarker(error, marker15);
  }
};
_a15 = symbol15;

// core/generate-text/output.ts
var text = () => ({
  type: "text",
  responseFormat: () => ({ type: "text" }),
  injectIntoSystemPrompt({ system }) {
    return system;
  },
  parsePartial({ text: text2 }) {
    return { partial: text2 };
  },
  parseOutput({ text: text2 }) {
    return text2;
  }
});
var object = ({
  schema: inputSchema
}) => {
  const schema = asSchema4(inputSchema);
  return {
    type: "object",
    responseFormat: ({ model }) => ({
      type: "json",
      schema: model.supportsStructuredOutputs ? schema.jsonSchema : void 0
    }),
    injectIntoSystemPrompt({ system, model }) {
      return model.supportsStructuredOutputs ? system : injectJsonInstruction({
        prompt: system,
        schema: schema.jsonSchema
      });
    },
    parsePartial({ text: text2 }) {
      const result = parsePartialJson2(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input":
          return void 0;
        case "repaired-parse":
        case "successful-parse":
          return {
            // Note: currently no validation of partial results:
            partial: result.value
          };
        default: {
          const _exhaustiveCheck = result.state;
          throw new Error(`Unsupported parse state: ${_exhaustiveCheck}`);
        }
      }
    },
    parseOutput({ text: text2 }, context) {
      const parseResult = safeParseJSON3({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const validationResult = safeValidateTypes4({
        value: parseResult.value,
        schema
      });
      if (!validationResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: validationResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      return validationResult.value;
    }
  };
};

// core/generate-text/smooth-stream.ts
import { delay as originalDelay } from "@ai-sdk/provider-utils";
import { InvalidArgumentError as InvalidArgumentError2 } from "@ai-sdk/provider";
var CHUNKING_REGEXPS = {
  word: /\S+\s+/m,
  line: /\n+/m
};
function smoothStream({
  delayInMs = 10,
  chunking = "word",
  _internal: { delay: delay2 = originalDelay } = {}
} = {}) {
  let detectChunk;
  if (typeof chunking === "function") {
    detectChunk = (buffer) => {
      const match = chunking(buffer);
      if (match == null) {
        return null;
      }
      if (!match.length) {
        throw new Error(`Chunking function must return a non-empty string.`);
      }
      if (!buffer.startsWith(match)) {
        throw new Error(
          `Chunking function must return a match that is a prefix of the buffer. Received: "${match}" expected to start with "${buffer}"`
        );
      }
      return match;
    };
  } else {
    const chunkingRegex = typeof chunking === "string" ? CHUNKING_REGEXPS[chunking] : chunking;
    if (chunkingRegex == null) {
      throw new InvalidArgumentError2({
        argument: "chunking",
        message: `Chunking must be "word" or "line" or a RegExp. Received: ${chunking}`
      });
    }
    detectChunk = (buffer) => {
      const match = chunkingRegex.exec(buffer);
      if (!match) {
        return null;
      }
      return buffer.slice(0, match.index) + (match == null ? void 0 : match[0]);
    };
  }
  return () => {
    let buffer = "";
    return new TransformStream({
      async transform(chunk, controller) {
        if (chunk.type !== "text-delta") {
          if (buffer.length > 0) {
            controller.enqueue({ type: "text-delta", textDelta: buffer });
            buffer = "";
          }
          controller.enqueue(chunk);
          return;
        }
        buffer += chunk.textDelta;
        let match;
        while ((match = detectChunk(buffer)) != null) {
          controller.enqueue({ type: "text-delta", textDelta: match });
          buffer = buffer.slice(match.length);
          await delay2(delayInMs);
        }
      }
    });
  };
}

// core/generate-text/stream-text.ts
import { AISDKError as AISDKError18 } from "@ai-sdk/provider";
import { createIdGenerator as createIdGenerator4 } from "@ai-sdk/provider-utils";
import { formatDataStreamPart as formatDataStreamPart2 } from "@ai-sdk/ui-utils";

// util/as-array.ts
function asArray(value) {
  return value === void 0 ? [] : Array.isArray(value) ? value : [value];
}

// util/consume-stream.ts
async function consumeStream({
  stream,
  onError
}) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done)
        break;
    }
  } catch (error) {
    onError == null ? void 0 : onError(error);
  } finally {
    reader.releaseLock();
  }
}

// core/util/merge-streams.ts
function mergeStreams(stream1, stream2) {
  const reader1 = stream1.getReader();
  const reader2 = stream2.getReader();
  let lastRead1 = void 0;
  let lastRead2 = void 0;
  let stream1Done = false;
  let stream2Done = false;
  async function readStream1(controller) {
    try {
      if (lastRead1 == null) {
        lastRead1 = reader1.read();
      }
      const result = await lastRead1;
      lastRead1 = void 0;
      if (!result.done) {
        controller.enqueue(result.value);
      } else {
        controller.close();
      }
    } catch (error) {
      controller.error(error);
    }
  }
  async function readStream2(controller) {
    try {
      if (lastRead2 == null) {
        lastRead2 = reader2.read();
      }
      const result = await lastRead2;
      lastRead2 = void 0;
      if (!result.done) {
        controller.enqueue(result.value);
      } else {
        controller.close();
      }
    } catch (error) {
      controller.error(error);
    }
  }
  return new ReadableStream({
    async pull(controller) {
      try {
        if (stream1Done) {
          await readStream2(controller);
          return;
        }
        if (stream2Done) {
          await readStream1(controller);
          return;
        }
        if (lastRead1 == null) {
          lastRead1 = reader1.read();
        }
        if (lastRead2 == null) {
          lastRead2 = reader2.read();
        }
        const { result, reader } = await Promise.race([
          lastRead1.then((result2) => ({ result: result2, reader: reader1 })),
          lastRead2.then((result2) => ({ result: result2, reader: reader2 }))
        ]);
        if (!result.done) {
          controller.enqueue(result.value);
        }
        if (reader === reader1) {
          lastRead1 = void 0;
          if (result.done) {
            await readStream2(controller);
            stream1Done = true;
          }
        } else {
          lastRead2 = void 0;
          if (result.done) {
            stream2Done = true;
            await readStream1(controller);
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader1.cancel();
      reader2.cancel();
    }
  });
}

// core/generate-text/run-tools-transformation.ts
import { generateId } from "@ai-sdk/ui-utils";
function runToolsTransformation({
  tools,
  generatorStream,
  toolCallStreaming,
  tracer,
  telemetry,
  system,
  messages,
  abortSignal,
  repairToolCall
}) {
  let toolResultsStreamController = null;
  const toolResultsStream = new ReadableStream({
    start(controller) {
      toolResultsStreamController = controller;
    }
  });
  const activeToolCalls = {};
  const outstandingToolResults = /* @__PURE__ */ new Set();
  let canClose = false;
  let finishChunk = void 0;
  function attemptClose() {
    if (canClose && outstandingToolResults.size === 0) {
      if (finishChunk != null) {
        toolResultsStreamController.enqueue(finishChunk);
      }
      toolResultsStreamController.close();
    }
  }
  const forwardStream = new TransformStream({
    async transform(chunk, controller) {
      const chunkType = chunk.type;
      switch (chunkType) {
        case "text-delta":
        case "reasoning":
        case "reasoning-signature":
        case "redacted-reasoning":
        case "source":
        case "response-metadata":
        case "error": {
          controller.enqueue(chunk);
          break;
        }
        case "file": {
          controller.enqueue(
            new DefaultGeneratedFileWithType({
              data: chunk.data,
              mimeType: chunk.mimeType
            })
          );
          break;
        }
        case "tool-call-delta": {
          if (toolCallStreaming) {
            if (!activeToolCalls[chunk.toolCallId]) {
              controller.enqueue({
                type: "tool-call-streaming-start",
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName
              });
              activeToolCalls[chunk.toolCallId] = true;
            }
            controller.enqueue({
              type: "tool-call-delta",
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              argsTextDelta: chunk.argsTextDelta
            });
          }
          break;
        }
        case "tool-call": {
          try {
            const toolCall = await parseToolCall({
              toolCall: chunk,
              tools,
              repairToolCall,
              system,
              messages
            });
            controller.enqueue(toolCall);
            const tool2 = tools[toolCall.toolName];
            if (tool2.execute != null) {
              const toolExecutionId = generateId();
              outstandingToolResults.add(toolExecutionId);
              recordSpan({
                name: "ai.toolCall",
                attributes: selectTelemetryAttributes({
                  telemetry,
                  attributes: {
                    ...assembleOperationName({
                      operationId: "ai.toolCall",
                      telemetry
                    }),
                    "ai.toolCall.name": toolCall.toolName,
                    "ai.toolCall.id": toolCall.toolCallId,
                    "ai.toolCall.args": {
                      output: () => JSON.stringify(toolCall.args)
                    }
                  }
                }),
                tracer,
                fn: async (span) => tool2.execute(toolCall.args, {
                  toolCallId: toolCall.toolCallId,
                  messages,
                  abortSignal
                }).then(
                  (result) => {
                    toolResultsStreamController.enqueue({
                      ...toolCall,
                      type: "tool-result",
                      result
                    });
                    outstandingToolResults.delete(toolExecutionId);
                    attemptClose();
                    try {
                      span.setAttributes(
                        selectTelemetryAttributes({
                          telemetry,
                          attributes: {
                            "ai.toolCall.result": {
                              output: () => JSON.stringify(result)
                            }
                          }
                        })
                      );
                    } catch (ignored) {
                    }
                  },
                  (error) => {
                    recordErrorOnSpan(span, error);
                    toolResultsStreamController.enqueue({
                      type: "error",
                      error: new ToolExecutionError({
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        toolArgs: toolCall.args,
                        cause: error
                      })
                    });
                    outstandingToolResults.delete(toolExecutionId);
                    attemptClose();
                  }
                )
              });
            }
          } catch (error) {
            toolResultsStreamController.enqueue({
              type: "error",
              error
            });
          }
          break;
        }
        case "finish": {
          finishChunk = {
            type: "finish",
            finishReason: chunk.finishReason,
            logprobs: chunk.logprobs,
            usage: calculateLanguageModelUsage(chunk.usage),
            experimental_providerMetadata: chunk.providerMetadata
          };
          break;
        }
        default: {
          const _exhaustiveCheck = chunkType;
          throw new Error(`Unhandled chunk type: ${_exhaustiveCheck}`);
        }
      }
    },
    flush() {
      canClose = true;
      attemptClose();
    }
  });
  return new ReadableStream({
    async start(controller) {
      return Promise.all([
        generatorStream.pipeThrough(forwardStream).pipeTo(
          new WritableStream({
            write(chunk) {
              controller.enqueue(chunk);
            },
            close() {
            }
          })
        ),
        toolResultsStream.pipeTo(
          new WritableStream({
            write(chunk) {
              controller.enqueue(chunk);
            },
            close() {
              controller.close();
            }
          })
        )
      ]);
    }
  });
}

// core/generate-text/stream-text.ts
var originalGenerateId4 = createIdGenerator4({
  prefix: "aitxt",
  size: 24
});
var originalGenerateMessageId2 = createIdGenerator4({
  prefix: "msg",
  size: 24
});
function streamText({
  model,
  tools,
  toolChoice,
  system,
  prompt,
  messages,
  maxRetries,
  abortSignal,
  headers,
  maxSteps = 1,
  experimental_generateMessageId: generateMessageId = originalGenerateMessageId2,
  experimental_output: output,
  experimental_continueSteps: continueSteps = false,
  experimental_telemetry: telemetry,
  experimental_providerMetadata,
  providerOptions = experimental_providerMetadata,
  experimental_toolCallStreaming = false,
  toolCallStreaming = experimental_toolCallStreaming,
  experimental_activeTools: activeTools,
  experimental_repairToolCall: repairToolCall,
  experimental_transform: transform,
  onChunk,
  onError,
  onFinish,
  onStepFinish,
  _internal: {
    now: now2 = now,
    generateId: generateId3 = originalGenerateId4,
    currentDate = () => /* @__PURE__ */ new Date()
  } = {},
  ...settings
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  return new DefaultStreamTextResult({
    model,
    telemetry,
    headers,
    settings,
    maxRetries,
    abortSignal,
    system,
    prompt,
    messages,
    tools,
    toolChoice,
    toolCallStreaming,
    transforms: asArray(transform),
    activeTools,
    repairToolCall,
    maxSteps,
    output,
    continueSteps,
    providerOptions,
    onChunk,
    onError,
    onFinish,
    onStepFinish,
    now: now2,
    currentDate,
    generateId: generateId3,
    generateMessageId
  });
}
function createOutputTransformStream(output) {
  if (!output) {
    return new TransformStream({
      transform(chunk, controller) {
        controller.enqueue({ part: chunk, partialOutput: void 0 });
      }
    });
  }
  let text2 = "";
  let textChunk = "";
  let lastPublishedJson = "";
  function publishTextChunk({
    controller,
    partialOutput = void 0
  }) {
    controller.enqueue({
      part: { type: "text-delta", textDelta: textChunk },
      partialOutput
    });
    textChunk = "";
  }
  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === "step-finish") {
        publishTextChunk({ controller });
      }
      if (chunk.type !== "text-delta") {
        controller.enqueue({ part: chunk, partialOutput: void 0 });
        return;
      }
      text2 += chunk.textDelta;
      textChunk += chunk.textDelta;
      const result = output.parsePartial({ text: text2 });
      if (result != null) {
        const currentJson = JSON.stringify(result.partial);
        if (currentJson !== lastPublishedJson) {
          publishTextChunk({ controller, partialOutput: result.partial });
          lastPublishedJson = currentJson;
        }
      }
    },
    flush(controller) {
      if (textChunk.length > 0) {
        publishTextChunk({ controller });
      }
    }
  });
}
var DefaultStreamTextResult = class {
  constructor({
    model,
    telemetry,
    headers,
    settings,
    maxRetries: maxRetriesArg,
    abortSignal,
    system,
    prompt,
    messages,
    tools,
    toolChoice,
    toolCallStreaming,
    transforms,
    activeTools,
    repairToolCall,
    maxSteps,
    output,
    continueSteps,
    providerOptions,
    now: now2,
    currentDate,
    generateId: generateId3,
    generateMessageId,
    onChunk,
    onError,
    onFinish,
    onStepFinish
  }) {
    this.warningsPromise = new DelayedPromise();
    this.usagePromise = new DelayedPromise();
    this.finishReasonPromise = new DelayedPromise();
    this.providerMetadataPromise = new DelayedPromise();
    this.textPromise = new DelayedPromise();
    this.reasoningPromise = new DelayedPromise();
    this.reasoningDetailsPromise = new DelayedPromise();
    this.sourcesPromise = new DelayedPromise();
    this.filesPromise = new DelayedPromise();
    this.toolCallsPromise = new DelayedPromise();
    this.toolResultsPromise = new DelayedPromise();
    this.requestPromise = new DelayedPromise();
    this.responsePromise = new DelayedPromise();
    this.stepsPromise = new DelayedPromise();
    var _a17;
    if (maxSteps < 1) {
      throw new InvalidArgumentError({
        parameter: "maxSteps",
        value: maxSteps,
        message: "maxSteps must be at least 1"
      });
    }
    this.output = output;
    let recordedStepText = "";
    let recordedContinuationText = "";
    let recordedFullText = "";
    let stepReasoning = [];
    let stepFiles = [];
    let activeReasoningText = void 0;
    let recordedStepSources = [];
    const recordedSources = [];
    const recordedResponse = {
      id: generateId3(),
      timestamp: currentDate(),
      modelId: model.modelId,
      messages: []
    };
    let recordedToolCalls = [];
    let recordedToolResults = [];
    let recordedFinishReason = void 0;
    let recordedUsage = void 0;
    let stepType = "initial";
    const recordedSteps = [];
    let rootSpan;
    const eventProcessor = new TransformStream({
      async transform(chunk, controller) {
        controller.enqueue(chunk);
        const { part } = chunk;
        if (part.type === "text-delta" || part.type === "reasoning" || part.type === "source" || part.type === "tool-call" || part.type === "tool-result" || part.type === "tool-call-streaming-start" || part.type === "tool-call-delta") {
          await (onChunk == null ? void 0 : onChunk({ chunk: part }));
        }
        if (part.type === "error") {
          await (onError == null ? void 0 : onError({ error: part.error }));
        }
        if (part.type === "text-delta") {
          recordedStepText += part.textDelta;
          recordedContinuationText += part.textDelta;
          recordedFullText += part.textDelta;
        }
        if (part.type === "reasoning") {
          if (activeReasoningText == null) {
            activeReasoningText = { type: "text", text: part.textDelta };
            stepReasoning.push(activeReasoningText);
          } else {
            activeReasoningText.text += part.textDelta;
          }
        }
        if (part.type === "reasoning-signature") {
          if (activeReasoningText == null) {
            throw new AISDKError18({
              name: "InvalidStreamPart",
              message: "reasoning-signature without reasoning"
            });
          }
          activeReasoningText.signature = part.signature;
          activeReasoningText = void 0;
        }
        if (part.type === "redacted-reasoning") {
          stepReasoning.push({ type: "redacted", data: part.data });
        }
        if (part.type === "file") {
          stepFiles.push(part);
        }
        if (part.type === "source") {
          recordedSources.push(part.source);
          recordedStepSources.push(part.source);
        }
        if (part.type === "tool-call") {
          recordedToolCalls.push(part);
        }
        if (part.type === "tool-result") {
          recordedToolResults.push(part);
        }
        if (part.type === "step-finish") {
          const stepMessages = toResponseMessages({
            text: recordedContinuationText,
            files: stepFiles,
            reasoning: stepReasoning,
            tools: tools != null ? tools : {},
            toolCalls: recordedToolCalls,
            toolResults: recordedToolResults,
            messageId: part.messageId,
            generateMessageId
          });
          const currentStep = recordedSteps.length;
          let nextStepType = "done";
          if (currentStep + 1 < maxSteps) {
            if (continueSteps && part.finishReason === "length" && // only use continue when there are no tool calls:
            recordedToolCalls.length === 0) {
              nextStepType = "continue";
            } else if (
              // there are tool calls:
              recordedToolCalls.length > 0 && // all current tool calls have results:
              recordedToolResults.length === recordedToolCalls.length
            ) {
              nextStepType = "tool-result";
            }
          }
          const currentStepResult = {
            stepType,
            text: recordedStepText,
            reasoning: asReasoningText(stepReasoning),
            reasoningDetails: stepReasoning,
            files: stepFiles,
            sources: recordedStepSources,
            toolCalls: recordedToolCalls,
            toolResults: recordedToolResults,
            finishReason: part.finishReason,
            usage: part.usage,
            warnings: part.warnings,
            logprobs: part.logprobs,
            request: part.request,
            response: {
              ...part.response,
              messages: [...recordedResponse.messages, ...stepMessages]
            },
            providerMetadata: part.experimental_providerMetadata,
            experimental_providerMetadata: part.experimental_providerMetadata,
            isContinued: part.isContinued
          };
          await (onStepFinish == null ? void 0 : onStepFinish(currentStepResult));
          recordedSteps.push(currentStepResult);
          recordedToolCalls = [];
          recordedToolResults = [];
          recordedStepText = "";
          recordedStepSources = [];
          stepReasoning = [];
          stepFiles = [];
          activeReasoningText = void 0;
          if (nextStepType !== "done") {
            stepType = nextStepType;
          }
          if (nextStepType !== "continue") {
            recordedResponse.messages.push(...stepMessages);
            recordedContinuationText = "";
          }
        }
        if (part.type === "finish") {
          recordedResponse.id = part.response.id;
          recordedResponse.timestamp = part.response.timestamp;
          recordedResponse.modelId = part.response.modelId;
          recordedResponse.headers = part.response.headers;
          recordedUsage = part.usage;
          recordedFinishReason = part.finishReason;
        }
      },
      async flush(controller) {
        var _a18;
        try {
          if (recordedSteps.length === 0) {
            return;
          }
          const lastStep = recordedSteps[recordedSteps.length - 1];
          self.warningsPromise.resolve(lastStep.warnings);
          self.requestPromise.resolve(lastStep.request);
          self.responsePromise.resolve(lastStep.response);
          self.toolCallsPromise.resolve(lastStep.toolCalls);
          self.toolResultsPromise.resolve(lastStep.toolResults);
          self.providerMetadataPromise.resolve(
            lastStep.experimental_providerMetadata
          );
          self.reasoningPromise.resolve(lastStep.reasoning);
          self.reasoningDetailsPromise.resolve(lastStep.reasoningDetails);
          const finishReason = recordedFinishReason != null ? recordedFinishReason : "unknown";
          const usage = recordedUsage != null ? recordedUsage : {
            completionTokens: NaN,
            promptTokens: NaN,
            totalTokens: NaN
          };
          self.finishReasonPromise.resolve(finishReason);
          self.usagePromise.resolve(usage);
          self.textPromise.resolve(recordedFullText);
          self.sourcesPromise.resolve(recordedSources);
          self.filesPromise.resolve(lastStep.files);
          self.stepsPromise.resolve(recordedSteps);
          await (onFinish == null ? void 0 : onFinish({
            finishReason,
            logprobs: void 0,
            usage,
            text: recordedFullText,
            reasoning: lastStep.reasoning,
            reasoningDetails: lastStep.reasoningDetails,
            files: lastStep.files,
            sources: lastStep.sources,
            toolCalls: lastStep.toolCalls,
            toolResults: lastStep.toolResults,
            request: (_a18 = lastStep.request) != null ? _a18 : {},
            response: lastStep.response,
            warnings: lastStep.warnings,
            providerMetadata: lastStep.providerMetadata,
            experimental_providerMetadata: lastStep.experimental_providerMetadata,
            steps: recordedSteps
          }));
          rootSpan.setAttributes(
            selectTelemetryAttributes({
              telemetry,
              attributes: {
                "ai.response.finishReason": finishReason,
                "ai.response.text": { output: () => recordedFullText },
                "ai.response.toolCalls": {
                  output: () => {
                    var _a19;
                    return ((_a19 = lastStep.toolCalls) == null ? void 0 : _a19.length) ? JSON.stringify(lastStep.toolCalls) : void 0;
                  }
                },
                "ai.usage.promptTokens": usage.promptTokens,
                "ai.usage.completionTokens": usage.completionTokens,
                "ai.response.providerMetadata": JSON.stringify(
                  lastStep.providerMetadata
                )
              }
            })
          );
        } catch (error) {
          controller.error(error);
        } finally {
          rootSpan.end();
        }
      }
    });
    const stitchableStream = createStitchableStream();
    this.addStream = stitchableStream.addStream;
    this.closeStream = stitchableStream.close;
    let stream = stitchableStream.stream;
    for (const transform of transforms) {
      stream = stream.pipeThrough(
        transform({
          tools,
          stopStream() {
            stitchableStream.terminate();
          }
        })
      );
    }
    this.baseStream = stream.pipeThrough(createOutputTransformStream(output)).pipeThrough(eventProcessor);
    const { maxRetries, retry } = prepareRetries({
      maxRetries: maxRetriesArg
    });
    const tracer = getTracer(telemetry);
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
      model,
      telemetry,
      headers,
      settings: { ...settings, maxRetries }
    });
    const initialPrompt = standardizePrompt({
      prompt: {
        system: (_a17 = output == null ? void 0 : output.injectIntoSystemPrompt({ system, model })) != null ? _a17 : system,
        prompt,
        messages
      },
      tools
    });
    const self = this;
    recordSpan({
      name: "ai.streamText",
      attributes: selectTelemetryAttributes({
        telemetry,
        attributes: {
          ...assembleOperationName({ operationId: "ai.streamText", telemetry }),
          ...baseTelemetryAttributes,
          // specific settings that only make sense on the outer level:
          "ai.prompt": {
            input: () => JSON.stringify({ system, prompt, messages })
          },
          "ai.settings.maxSteps": maxSteps
        }
      }),
      tracer,
      endWhenDone: false,
      fn: async (rootSpanArg) => {
        rootSpan = rootSpanArg;
        async function streamStep({
          currentStep,
          responseMessages,
          usage,
          stepType: stepType2,
          previousStepText,
          hasLeadingWhitespace,
          messageId
        }) {
          var _a18;
          const promptFormat = responseMessages.length === 0 ? initialPrompt.type : "messages";
          const stepInputMessages = [
            ...initialPrompt.messages,
            ...responseMessages
          ];
          const promptMessages = await convertToLanguageModelPrompt({
            prompt: {
              type: promptFormat,
              system: initialPrompt.system,
              messages: stepInputMessages
            },
            modelSupportsImageUrls: model.supportsImageUrls,
            modelSupportsUrl: (_a18 = model.supportsUrl) == null ? void 0 : _a18.bind(model)
            // support 'this' context
          });
          const mode = {
            type: "regular",
            ...prepareToolsAndToolChoice({ tools, toolChoice, activeTools })
          };
          const {
            result: { stream: stream2, warnings, rawResponse, request },
            doStreamSpan,
            startTimestampMs
          } = await retry(
            () => recordSpan({
              name: "ai.streamText.doStream",
              attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                  ...assembleOperationName({
                    operationId: "ai.streamText.doStream",
                    telemetry
                  }),
                  ...baseTelemetryAttributes,
                  "ai.prompt.format": {
                    input: () => promptFormat
                  },
                  "ai.prompt.messages": {
                    input: () => stringifyForTelemetry(promptMessages)
                  },
                  "ai.prompt.tools": {
                    // convert the language model level tools:
                    input: () => {
                      var _a19;
                      return (_a19 = mode.tools) == null ? void 0 : _a19.map((tool2) => JSON.stringify(tool2));
                    }
                  },
                  "ai.prompt.toolChoice": {
                    input: () => mode.toolChoice != null ? JSON.stringify(mode.toolChoice) : void 0
                  },
                  // standardized gen-ai llm span attributes:
                  "gen_ai.system": model.provider,
                  "gen_ai.request.model": model.modelId,
                  "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                  "gen_ai.request.max_tokens": settings.maxTokens,
                  "gen_ai.request.presence_penalty": settings.presencePenalty,
                  "gen_ai.request.stop_sequences": settings.stopSequences,
                  "gen_ai.request.temperature": settings.temperature,
                  "gen_ai.request.top_k": settings.topK,
                  "gen_ai.request.top_p": settings.topP
                }
              }),
              tracer,
              endWhenDone: false,
              fn: async (doStreamSpan2) => ({
                startTimestampMs: now2(),
                // get before the call
                doStreamSpan: doStreamSpan2,
                result: await model.doStream({
                  mode,
                  ...prepareCallSettings(settings),
                  inputFormat: promptFormat,
                  responseFormat: output == null ? void 0 : output.responseFormat({ model }),
                  prompt: promptMessages,
                  providerMetadata: providerOptions,
                  abortSignal,
                  headers
                })
              })
            })
          );
          const transformedStream = runToolsTransformation({
            tools,
            generatorStream: stream2,
            toolCallStreaming,
            tracer,
            telemetry,
            system,
            messages: stepInputMessages,
            repairToolCall,
            abortSignal
          });
          const stepRequest = request != null ? request : {};
          const stepToolCalls = [];
          const stepToolResults = [];
          const stepReasoning2 = [];
          const stepFiles2 = [];
          let activeReasoningText2 = void 0;
          let stepFinishReason = "unknown";
          let stepUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          };
          let stepProviderMetadata;
          let stepFirstChunk = true;
          let stepText = "";
          let fullStepText = stepType2 === "continue" ? previousStepText : "";
          let stepLogProbs;
          let stepResponse = {
            id: generateId3(),
            timestamp: currentDate(),
            modelId: model.modelId
          };
          let chunkBuffer = "";
          let chunkTextPublished = false;
          let inWhitespacePrefix = true;
          let hasWhitespaceSuffix = false;
          async function publishTextChunk({
            controller,
            chunk
          }) {
            controller.enqueue(chunk);
            stepText += chunk.textDelta;
            fullStepText += chunk.textDelta;
            chunkTextPublished = true;
            hasWhitespaceSuffix = chunk.textDelta.trimEnd() !== chunk.textDelta;
          }
          self.addStream(
            transformedStream.pipeThrough(
              new TransformStream({
                async transform(chunk, controller) {
                  var _a19, _b, _c;
                  if (stepFirstChunk) {
                    const msToFirstChunk = now2() - startTimestampMs;
                    stepFirstChunk = false;
                    doStreamSpan.addEvent("ai.stream.firstChunk", {
                      "ai.response.msToFirstChunk": msToFirstChunk
                    });
                    doStreamSpan.setAttributes({
                      "ai.response.msToFirstChunk": msToFirstChunk
                    });
                    controller.enqueue({
                      type: "step-start",
                      messageId,
                      request: stepRequest,
                      warnings: warnings != null ? warnings : []
                    });
                  }
                  if (chunk.type === "text-delta" && chunk.textDelta.length === 0) {
                    return;
                  }
                  const chunkType = chunk.type;
                  switch (chunkType) {
                    case "text-delta": {
                      if (continueSteps) {
                        const trimmedChunkText = inWhitespacePrefix && hasLeadingWhitespace ? chunk.textDelta.trimStart() : chunk.textDelta;
                        if (trimmedChunkText.length === 0) {
                          break;
                        }
                        inWhitespacePrefix = false;
                        chunkBuffer += trimmedChunkText;
                        const split = splitOnLastWhitespace(chunkBuffer);
                        if (split != null) {
                          chunkBuffer = split.suffix;
                          await publishTextChunk({
                            controller,
                            chunk: {
                              type: "text-delta",
                              textDelta: split.prefix + split.whitespace
                            }
                          });
                        }
                      } else {
                        await publishTextChunk({ controller, chunk });
                      }
                      break;
                    }
                    case "reasoning": {
                      controller.enqueue(chunk);
                      if (activeReasoningText2 == null) {
                        activeReasoningText2 = {
                          type: "text",
                          text: chunk.textDelta
                        };
                        stepReasoning2.push(activeReasoningText2);
                      } else {
                        activeReasoningText2.text += chunk.textDelta;
                      }
                      break;
                    }
                    case "reasoning-signature": {
                      controller.enqueue(chunk);
                      if (activeReasoningText2 == null) {
                        throw new InvalidStreamPartError({
                          chunk,
                          message: "reasoning-signature without reasoning"
                        });
                      }
                      activeReasoningText2.signature = chunk.signature;
                      activeReasoningText2 = void 0;
                      break;
                    }
                    case "redacted-reasoning": {
                      controller.enqueue(chunk);
                      stepReasoning2.push({
                        type: "redacted",
                        data: chunk.data
                      });
                      break;
                    }
                    case "tool-call": {
                      controller.enqueue(chunk);
                      stepToolCalls.push(chunk);
                      break;
                    }
                    case "tool-result": {
                      controller.enqueue(chunk);
                      stepToolResults.push(chunk);
                      break;
                    }
                    case "response-metadata": {
                      stepResponse = {
                        id: (_a19 = chunk.id) != null ? _a19 : stepResponse.id,
                        timestamp: (_b = chunk.timestamp) != null ? _b : stepResponse.timestamp,
                        modelId: (_c = chunk.modelId) != null ? _c : stepResponse.modelId
                      };
                      break;
                    }
                    case "finish": {
                      stepUsage = chunk.usage;
                      stepFinishReason = chunk.finishReason;
                      stepProviderMetadata = chunk.experimental_providerMetadata;
                      stepLogProbs = chunk.logprobs;
                      const msToFinish = now2() - startTimestampMs;
                      doStreamSpan.addEvent("ai.stream.finish");
                      doStreamSpan.setAttributes({
                        "ai.response.msToFinish": msToFinish,
                        "ai.response.avgCompletionTokensPerSecond": 1e3 * stepUsage.completionTokens / msToFinish
                      });
                      break;
                    }
                    case "file": {
                      stepFiles2.push(chunk);
                      controller.enqueue(chunk);
                      break;
                    }
                    case "source":
                    case "tool-call-streaming-start":
                    case "tool-call-delta": {
                      controller.enqueue(chunk);
                      break;
                    }
                    case "error": {
                      controller.enqueue(chunk);
                      stepFinishReason = "error";
                      break;
                    }
                    default: {
                      const exhaustiveCheck = chunkType;
                      throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
                    }
                  }
                },
                // invoke onFinish callback and resolve toolResults promise when the stream is about to close:
                async flush(controller) {
                  const stepToolCallsJson = stepToolCalls.length > 0 ? JSON.stringify(stepToolCalls) : void 0;
                  let nextStepType = "done";
                  if (currentStep + 1 < maxSteps) {
                    if (continueSteps && stepFinishReason === "length" && // only use continue when there are no tool calls:
                    stepToolCalls.length === 0) {
                      nextStepType = "continue";
                    } else if (
                      // there are tool calls:
                      stepToolCalls.length > 0 && // all current tool calls have results:
                      stepToolResults.length === stepToolCalls.length
                    ) {
                      nextStepType = "tool-result";
                    }
                  }
                  if (continueSteps && chunkBuffer.length > 0 && (nextStepType !== "continue" || // when the next step is a regular step, publish the buffer
                  stepType2 === "continue" && !chunkTextPublished)) {
                    await publishTextChunk({
                      controller,
                      chunk: {
                        type: "text-delta",
                        textDelta: chunkBuffer
                      }
                    });
                    chunkBuffer = "";
                  }
                  try {
                    doStreamSpan.setAttributes(
                      selectTelemetryAttributes({
                        telemetry,
                        attributes: {
                          "ai.response.finishReason": stepFinishReason,
                          "ai.response.text": { output: () => stepText },
                          "ai.response.toolCalls": {
                            output: () => stepToolCallsJson
                          },
                          "ai.response.id": stepResponse.id,
                          "ai.response.model": stepResponse.modelId,
                          "ai.response.timestamp": stepResponse.timestamp.toISOString(),
                          "ai.response.providerMetadata": JSON.stringify(stepProviderMetadata),
                          "ai.usage.promptTokens": stepUsage.promptTokens,
                          "ai.usage.completionTokens": stepUsage.completionTokens,
                          // standardized gen-ai llm span attributes:
                          "gen_ai.response.finish_reasons": [stepFinishReason],
                          "gen_ai.response.id": stepResponse.id,
                          "gen_ai.response.model": stepResponse.modelId,
                          "gen_ai.usage.input_tokens": stepUsage.promptTokens,
                          "gen_ai.usage.output_tokens": stepUsage.completionTokens
                        }
                      })
                    );
                  } catch (error) {
                  } finally {
                    doStreamSpan.end();
                  }
                  controller.enqueue({
                    type: "step-finish",
                    finishReason: stepFinishReason,
                    usage: stepUsage,
                    providerMetadata: stepProviderMetadata,
                    experimental_providerMetadata: stepProviderMetadata,
                    logprobs: stepLogProbs,
                    request: stepRequest,
                    response: {
                      ...stepResponse,
                      headers: rawResponse == null ? void 0 : rawResponse.headers
                    },
                    warnings,
                    isContinued: nextStepType === "continue",
                    messageId
                  });
                  const combinedUsage = addLanguageModelUsage(usage, stepUsage);
                  if (nextStepType === "done") {
                    controller.enqueue({
                      type: "finish",
                      finishReason: stepFinishReason,
                      usage: combinedUsage,
                      providerMetadata: stepProviderMetadata,
                      experimental_providerMetadata: stepProviderMetadata,
                      logprobs: stepLogProbs,
                      response: {
                        ...stepResponse,
                        headers: rawResponse == null ? void 0 : rawResponse.headers
                      }
                    });
                    self.closeStream();
                  } else {
                    if (stepType2 === "continue") {
                      const lastMessage = responseMessages[responseMessages.length - 1];
                      if (typeof lastMessage.content === "string") {
                        lastMessage.content += stepText;
                      } else {
                        lastMessage.content.push({
                          text: stepText,
                          type: "text"
                        });
                      }
                    } else {
                      responseMessages.push(
                        ...toResponseMessages({
                          text: stepText,
                          files: stepFiles2,
                          reasoning: stepReasoning2,
                          tools: tools != null ? tools : {},
                          toolCalls: stepToolCalls,
                          toolResults: stepToolResults,
                          messageId,
                          generateMessageId
                        })
                      );
                    }
                    await streamStep({
                      currentStep: currentStep + 1,
                      responseMessages,
                      usage: combinedUsage,
                      stepType: nextStepType,
                      previousStepText: fullStepText,
                      hasLeadingWhitespace: hasWhitespaceSuffix,
                      messageId: (
                        // keep the same id when continuing a step:
                        nextStepType === "continue" ? messageId : generateMessageId()
                      )
                    });
                  }
                }
              })
            )
          );
        }
        await streamStep({
          currentStep: 0,
          responseMessages: [],
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
          },
          previousStepText: "",
          stepType: "initial",
          hasLeadingWhitespace: false,
          messageId: generateMessageId()
        });
      }
    }).catch((error) => {
      self.addStream(
        new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "error", error });
            controller.close();
          }
        })
      );
      self.closeStream();
    });
  }
  get warnings() {
    return this.warningsPromise.value;
  }
  get usage() {
    return this.usagePromise.value;
  }
  get finishReason() {
    return this.finishReasonPromise.value;
  }
  get experimental_providerMetadata() {
    return this.providerMetadataPromise.value;
  }
  get providerMetadata() {
    return this.providerMetadataPromise.value;
  }
  get text() {
    return this.textPromise.value;
  }
  get reasoning() {
    return this.reasoningPromise.value;
  }
  get reasoningDetails() {
    return this.reasoningDetailsPromise.value;
  }
  get sources() {
    return this.sourcesPromise.value;
  }
  get files() {
    return this.filesPromise.value;
  }
  get toolCalls() {
    return this.toolCallsPromise.value;
  }
  get toolResults() {
    return this.toolResultsPromise.value;
  }
  get request() {
    return this.requestPromise.value;
  }
  get response() {
    return this.responsePromise.value;
  }
  get steps() {
    return this.stepsPromise.value;
  }
  /**
  Split out a new stream from the original stream.
  The original stream is replaced to allow for further splitting,
  since we do not know how many times the stream will be split.
  
  Note: this leads to buffering the stream content on the server.
  However, the LLM results are expected to be small enough to not cause issues.
     */
  teeStream() {
    const [stream1, stream2] = this.baseStream.tee();
    this.baseStream = stream2;
    return stream1;
  }
  get textStream() {
    return createAsyncIterableStream(
      this.teeStream().pipeThrough(
        new TransformStream({
          transform({ part }, controller) {
            if (part.type === "text-delta") {
              controller.enqueue(part.textDelta);
            }
          }
        })
      )
    );
  }
  get fullStream() {
    return createAsyncIterableStream(
      this.teeStream().pipeThrough(
        new TransformStream({
          transform({ part }, controller) {
            controller.enqueue(part);
          }
        })
      )
    );
  }
  async consumeStream(options) {
    var _a17;
    try {
      await consumeStream({
        stream: this.fullStream,
        onError: options == null ? void 0 : options.onError
      });
    } catch (error) {
      (_a17 = options == null ? void 0 : options.onError) == null ? void 0 : _a17.call(options, error);
    }
  }
  get experimental_partialOutputStream() {
    if (this.output == null) {
      throw new NoOutputSpecifiedError();
    }
    return createAsyncIterableStream(
      this.teeStream().pipeThrough(
        new TransformStream({
          transform({ partialOutput }, controller) {
            if (partialOutput != null) {
              controller.enqueue(partialOutput);
            }
          }
        })
      )
    );
  }
  toDataStreamInternal({
    getErrorMessage: getErrorMessage5 = () => "An error occurred.",
    // mask error messages for safety by default
    sendUsage = true,
    sendReasoning = false,
    sendSources = false,
    experimental_sendFinish = true
  }) {
    return this.fullStream.pipeThrough(
      new TransformStream({
        transform: async (chunk, controller) => {
          const chunkType = chunk.type;
          switch (chunkType) {
            case "text-delta": {
              controller.enqueue(formatDataStreamPart2("text", chunk.textDelta));
              break;
            }
            case "reasoning": {
              if (sendReasoning) {
                controller.enqueue(
                  formatDataStreamPart2("reasoning", chunk.textDelta)
                );
              }
              break;
            }
            case "redacted-reasoning": {
              if (sendReasoning) {
                controller.enqueue(
                  formatDataStreamPart2("redacted_reasoning", {
                    data: chunk.data
                  })
                );
              }
              break;
            }
            case "reasoning-signature": {
              if (sendReasoning) {
                controller.enqueue(
                  formatDataStreamPart2("reasoning_signature", {
                    signature: chunk.signature
                  })
                );
              }
              break;
            }
            case "file": {
              controller.enqueue(
                formatDataStreamPart2("file", {
                  mimeType: chunk.mimeType,
                  data: chunk.base64
                })
              );
              break;
            }
            case "source": {
              if (sendSources) {
                controller.enqueue(
                  formatDataStreamPart2("source", chunk.source)
                );
              }
              break;
            }
            case "tool-call-streaming-start": {
              controller.enqueue(
                formatDataStreamPart2("tool_call_streaming_start", {
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName
                })
              );
              break;
            }
            case "tool-call-delta": {
              controller.enqueue(
                formatDataStreamPart2("tool_call_delta", {
                  toolCallId: chunk.toolCallId,
                  argsTextDelta: chunk.argsTextDelta
                })
              );
              break;
            }
            case "tool-call": {
              controller.enqueue(
                formatDataStreamPart2("tool_call", {
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  args: chunk.args
                })
              );
              break;
            }
            case "tool-result": {
              controller.enqueue(
                formatDataStreamPart2("tool_result", {
                  toolCallId: chunk.toolCallId,
                  result: chunk.result
                })
              );
              break;
            }
            case "error": {
              controller.enqueue(
                formatDataStreamPart2("error", getErrorMessage5(chunk.error))
              );
              break;
            }
            case "step-start": {
              controller.enqueue(
                formatDataStreamPart2("start_step", {
                  messageId: chunk.messageId
                })
              );
              break;
            }
            case "step-finish": {
              controller.enqueue(
                formatDataStreamPart2("finish_step", {
                  finishReason: chunk.finishReason,
                  usage: sendUsage ? {
                    promptTokens: chunk.usage.promptTokens,
                    completionTokens: chunk.usage.completionTokens
                  } : void 0,
                  isContinued: chunk.isContinued
                })
              );
              break;
            }
            case "finish": {
              if (experimental_sendFinish) {
                controller.enqueue(
                  formatDataStreamPart2("finish_message", {
                    finishReason: chunk.finishReason,
                    usage: sendUsage ? {
                      promptTokens: chunk.usage.promptTokens,
                      completionTokens: chunk.usage.completionTokens
                    } : void 0
                  })
                );
              }
              break;
            }
            default: {
              const exhaustiveCheck = chunkType;
              throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
            }
          }
        }
      })
    );
  }
  pipeDataStreamToResponse(response, {
    status,
    statusText,
    headers,
    data,
    getErrorMessage: getErrorMessage5,
    sendUsage,
    sendReasoning,
    sendSources,
    experimental_sendFinish
  } = {}) {
    writeToServerResponse({
      response,
      status,
      statusText,
      headers: prepareOutgoingHttpHeaders(headers, {
        contentType: "text/plain; charset=utf-8",
        dataStreamVersion: "v1"
      }),
      stream: this.toDataStream({
        data,
        getErrorMessage: getErrorMessage5,
        sendUsage,
        sendReasoning,
        sendSources,
        experimental_sendFinish
      })
    });
  }
  pipeTextStreamToResponse(response, init) {
    writeToServerResponse({
      response,
      status: init == null ? void 0 : init.status,
      statusText: init == null ? void 0 : init.statusText,
      headers: prepareOutgoingHttpHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8"
      }),
      stream: this.textStream.pipeThrough(new TextEncoderStream())
    });
  }
  // TODO breaking change 5.0: remove pipeThrough(new TextEncoderStream())
  toDataStream(options) {
    const stream = this.toDataStreamInternal({
      getErrorMessage: options == null ? void 0 : options.getErrorMessage,
      sendUsage: options == null ? void 0 : options.sendUsage,
      sendReasoning: options == null ? void 0 : options.sendReasoning,
      sendSources: options == null ? void 0 : options.sendSources,
      experimental_sendFinish: options == null ? void 0 : options.experimental_sendFinish
    }).pipeThrough(new TextEncoderStream());
    return (options == null ? void 0 : options.data) ? mergeStreams(options == null ? void 0 : options.data.stream, stream) : stream;
  }
  mergeIntoDataStream(writer, options) {
    writer.merge(
      this.toDataStreamInternal({
        getErrorMessage: writer.onError,
        sendUsage: options == null ? void 0 : options.sendUsage,
        sendReasoning: options == null ? void 0 : options.sendReasoning,
        sendSources: options == null ? void 0 : options.sendSources,
        experimental_sendFinish: options == null ? void 0 : options.experimental_sendFinish
      })
    );
  }
  toDataStreamResponse({
    headers,
    status,
    statusText,
    data,
    getErrorMessage: getErrorMessage5,
    sendUsage,
    sendReasoning,
    sendSources,
    experimental_sendFinish
  } = {}) {
    return new Response(
      this.toDataStream({
        data,
        getErrorMessage: getErrorMessage5,
        sendUsage,
        sendReasoning,
        sendSources,
        experimental_sendFinish
      }),
      {
        status,
        statusText,
        headers: prepareResponseHeaders(headers, {
          contentType: "text/plain; charset=utf-8",
          dataStreamVersion: "v1"
        })
      }
    );
  }
  toTextStreamResponse(init) {
    var _a17;
    return new Response(this.textStream.pipeThrough(new TextEncoderStream()), {
      status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
      headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
        contentType: "text/plain; charset=utf-8"
      })
    });
  }
};

// errors/no-speech-generated-error.ts
import { AISDKError as AISDKError19 } from "@ai-sdk/provider";
var NoSpeechGeneratedError = class extends AISDKError19 {
  constructor(options) {
    super({
      name: "AI_NoSpeechGeneratedError",
      message: "No speech audio generated."
    });
    this.responses = options.responses;
  }
};

// core/generate-speech/generated-audio-file.ts
var DefaultGeneratedAudioFile = class extends DefaultGeneratedFile {
  constructor({
    data,
    mimeType
  }) {
    super({ data, mimeType });
    let format = "mp3";
    if (mimeType) {
      const mimeTypeParts = mimeType.split("/");
      if (mimeTypeParts.length === 2) {
        if (mimeType !== "audio/mpeg") {
          format = mimeTypeParts[1];
        }
      }
    }
    if (!format) {
      throw new Error(
        "Audio format must be provided or determinable from mimeType"
      );
    }
    this.format = format;
  }
};

// core/generate-speech/generate-speech.ts
async function generateSpeech({
  model,
  text: text2,
  voice,
  outputFormat,
  instructions,
  speed,
  providerOptions = {},
  maxRetries: maxRetriesArg,
  abortSignal,
  headers
}) {
  var _a17;
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  const { retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const result = await retry(
    () => model.doGenerate({
      text: text2,
      voice,
      outputFormat,
      instructions,
      speed,
      abortSignal,
      headers,
      providerOptions
    })
  );
  if (!result.audio || result.audio.length === 0) {
    throw new NoSpeechGeneratedError({ responses: [result.response] });
  }
  return new DefaultSpeechResult({
    audio: new DefaultGeneratedAudioFile({
      data: result.audio,
      mimeType: (_a17 = detectMimeType({
        data: result.audio,
        signatures: audioMimeTypeSignatures
      })) != null ? _a17 : "audio/mp3"
    }),
    warnings: result.warnings,
    responses: [result.response],
    providerMetadata: result.providerMetadata
  });
}
var DefaultSpeechResult = class {
  constructor(options) {
    var _a17;
    this.audio = options.audio;
    this.warnings = options.warnings;
    this.responses = options.responses;
    this.providerMetadata = (_a17 = options.providerMetadata) != null ? _a17 : {};
  }
};

// errors/no-transcript-generated-error.ts
import { AISDKError as AISDKError20 } from "@ai-sdk/provider";
var NoTranscriptGeneratedError = class extends AISDKError20 {
  constructor(options) {
    super({
      name: "AI_NoTranscriptGeneratedError",
      message: "No transcript generated."
    });
    this.responses = options.responses;
  }
};

// core/transcribe/transcribe.ts
async function transcribe({
  model,
  audio,
  providerOptions = {},
  maxRetries: maxRetriesArg,
  abortSignal,
  headers
}) {
  if (typeof model === "string" || model.specificationVersion !== "v1") {
    throw new UnsupportedModelVersionError();
  }
  const { retry } = prepareRetries({ maxRetries: maxRetriesArg });
  const audioData = audio instanceof URL ? (await download({ url: audio })).data : convertDataContentToUint8Array(audio);
  const result = await retry(
    () => {
      var _a17;
      return model.doGenerate({
        audio: audioData,
        abortSignal,
        headers,
        providerOptions,
        mediaType: (_a17 = detectMimeType({
          data: audioData,
          signatures: audioMimeTypeSignatures
        })) != null ? _a17 : "audio/wav"
      });
    }
  );
  if (!result.text) {
    throw new NoTranscriptGeneratedError({ responses: [result.response] });
  }
  return new DefaultTranscriptionResult({
    text: result.text,
    segments: result.segments,
    language: result.language,
    durationInSeconds: result.durationInSeconds,
    warnings: result.warnings,
    responses: [result.response],
    providerMetadata: result.providerMetadata
  });
}
var DefaultTranscriptionResult = class {
  constructor(options) {
    var _a17;
    this.text = options.text;
    this.segments = options.segments;
    this.language = options.language;
    this.durationInSeconds = options.durationInSeconds;
    this.warnings = options.warnings;
    this.responses = options.responses;
    this.providerMetadata = (_a17 = options.providerMetadata) != null ? _a17 : {};
  }
};

// core/util/merge-objects.ts
function mergeObjects(target, source) {
  if (target === void 0 && source === void 0) {
    return void 0;
  }
  if (target === void 0) {
    return source;
  }
  if (source === void 0) {
    return target;
  }
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      if (sourceValue === void 0)
        continue;
      const targetValue = key in target ? target[key] : void 0;
      const isSourceObject = sourceValue !== null && typeof sourceValue === "object" && !Array.isArray(sourceValue) && !(sourceValue instanceof Date) && !(sourceValue instanceof RegExp);
      const isTargetObject = targetValue !== null && targetValue !== void 0 && typeof targetValue === "object" && !Array.isArray(targetValue) && !(targetValue instanceof Date) && !(targetValue instanceof RegExp);
      if (isSourceObject && isTargetObject) {
        result[key] = mergeObjects(
          targetValue,
          sourceValue
        );
      } else {
        result[key] = sourceValue;
      }
    }
  }
  return result;
}

// core/middleware/default-settings-middleware.ts
function defaultSettingsMiddleware({
  settings
}) {
  return {
    middlewareVersion: "v1",
    transformParams: async ({ params }) => {
      var _a17;
      return {
        ...settings,
        ...params,
        providerMetadata: mergeObjects(
          settings.providerMetadata,
          params.providerMetadata
        ),
        // special case for temperature 0
        // TODO remove when temperature defaults to undefined
        temperature: params.temperature === 0 || params.temperature == null ? (_a17 = settings.temperature) != null ? _a17 : 0 : params.temperature
      };
    }
  };
}

// core/util/get-potential-start-index.ts
function getPotentialStartIndex(text2, searchedText) {
  if (searchedText.length === 0) {
    return null;
  }
  const directIndex = text2.indexOf(searchedText);
  if (directIndex !== -1) {
    return directIndex;
  }
  for (let i = text2.length - 1; i >= 0; i--) {
    const suffix = text2.substring(i);
    if (searchedText.startsWith(suffix)) {
      return i;
    }
  }
  return null;
}

// core/middleware/extract-reasoning-middleware.ts
function extractReasoningMiddleware({
  tagName,
  separator = "\n",
  startWithReasoning = false
}) {
  const openingTag = `<${tagName}>`;
  const closingTag = `</${tagName}>`;
  return {
    middlewareVersion: "v1",
    wrapGenerate: async ({ doGenerate }) => {
      const { text: rawText, ...rest } = await doGenerate();
      if (rawText == null) {
        return { text: rawText, ...rest };
      }
      const text2 = startWithReasoning ? openingTag + rawText : rawText;
      const regexp = new RegExp(`${openingTag}(.*?)${closingTag}`, "gs");
      const matches = Array.from(text2.matchAll(regexp));
      if (!matches.length) {
        return { text: text2, ...rest };
      }
      const reasoning = matches.map((match) => match[1]).join(separator);
      let textWithoutReasoning = text2;
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const beforeMatch = textWithoutReasoning.slice(0, match.index);
        const afterMatch = textWithoutReasoning.slice(
          match.index + match[0].length
        );
        textWithoutReasoning = beforeMatch + (beforeMatch.length > 0 && afterMatch.length > 0 ? separator : "") + afterMatch;
      }
      return { ...rest, text: textWithoutReasoning, reasoning };
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      let isFirstReasoning = true;
      let isFirstText = true;
      let afterSwitch = false;
      let isReasoning = startWithReasoning;
      let buffer = "";
      return {
        stream: stream.pipeThrough(
          new TransformStream({
            transform: (chunk, controller) => {
              if (chunk.type !== "text-delta") {
                controller.enqueue(chunk);
                return;
              }
              buffer += chunk.textDelta;
              function publish(text2) {
                if (text2.length > 0) {
                  const prefix = afterSwitch && (isReasoning ? !isFirstReasoning : !isFirstText) ? separator : "";
                  controller.enqueue({
                    type: isReasoning ? "reasoning" : "text-delta",
                    textDelta: prefix + text2
                  });
                  afterSwitch = false;
                  if (isReasoning) {
                    isFirstReasoning = false;
                  } else {
                    isFirstText = false;
                  }
                }
              }
              do {
                const nextTag = isReasoning ? closingTag : openingTag;
                const startIndex = getPotentialStartIndex(buffer, nextTag);
                if (startIndex == null) {
                  publish(buffer);
                  buffer = "";
                  break;
                }
                publish(buffer.slice(0, startIndex));
                const foundFullMatch = startIndex + nextTag.length <= buffer.length;
                if (foundFullMatch) {
                  buffer = buffer.slice(startIndex + nextTag.length);
                  isReasoning = !isReasoning;
                  afterSwitch = true;
                } else {
                  buffer = buffer.slice(startIndex);
                  break;
                }
              } while (true);
            }
          })
        ),
        ...rest
      };
    }
  };
}

// core/middleware/simulate-streaming-middleware.ts
function simulateStreamingMiddleware() {
  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doGenerate }) => {
      const result = await doGenerate();
      const simulatedStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "response-metadata", ...result.response });
          if (result.reasoning) {
            if (typeof result.reasoning === "string") {
              controller.enqueue({
                type: "reasoning",
                textDelta: result.reasoning
              });
            } else {
              for (const reasoning of result.reasoning) {
                switch (reasoning.type) {
                  case "text": {
                    controller.enqueue({
                      type: "reasoning",
                      textDelta: reasoning.text
                    });
                    if (reasoning.signature != null) {
                      controller.enqueue({
                        type: "reasoning-signature",
                        signature: reasoning.signature
                      });
                    }
                    break;
                  }
                  case "redacted": {
                    controller.enqueue({
                      type: "redacted-reasoning",
                      data: reasoning.data
                    });
                    break;
                  }
                }
              }
            }
          }
          if (result.text) {
            controller.enqueue({
              type: "text-delta",
              textDelta: result.text
            });
          }
          if (result.toolCalls) {
            for (const toolCall of result.toolCalls) {
              controller.enqueue({
                type: "tool-call-delta",
                toolCallType: "function",
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                argsTextDelta: toolCall.args
              });
              controller.enqueue({
                type: "tool-call",
                ...toolCall
              });
            }
          }
          controller.enqueue({
            type: "finish",
            finishReason: result.finishReason,
            usage: result.usage,
            logprobs: result.logprobs,
            providerMetadata: result.providerMetadata
          });
          controller.close();
        }
      });
      return {
        stream: simulatedStream,
        rawCall: result.rawCall,
        rawResponse: result.rawResponse,
        warnings: result.warnings
      };
    }
  };
}

// core/middleware/wrap-language-model.ts
var wrapLanguageModel = ({
  model,
  middleware: middlewareArg,
  modelId,
  providerId
}) => {
  return asArray(middlewareArg).reverse().reduce((wrappedModel, middleware) => {
    return doWrap({ model: wrappedModel, middleware, modelId, providerId });
  }, model);
};
var doWrap = ({
  model,
  middleware: { transformParams, wrapGenerate, wrapStream },
  modelId,
  providerId
}) => {
  var _a17;
  async function doTransform({
    params,
    type
  }) {
    return transformParams ? await transformParams({ params, type }) : params;
  }
  return {
    specificationVersion: "v1",
    provider: providerId != null ? providerId : model.provider,
    modelId: modelId != null ? modelId : model.modelId,
    defaultObjectGenerationMode: model.defaultObjectGenerationMode,
    supportsImageUrls: model.supportsImageUrls,
    supportsUrl: (_a17 = model.supportsUrl) == null ? void 0 : _a17.bind(model),
    supportsStructuredOutputs: model.supportsStructuredOutputs,
    async doGenerate(params) {
      const transformedParams = await doTransform({ params, type: "generate" });
      const doGenerate = async () => model.doGenerate(transformedParams);
      const doStream = async () => model.doStream(transformedParams);
      return wrapGenerate ? wrapGenerate({
        doGenerate,
        doStream,
        params: transformedParams,
        model
      }) : doGenerate();
    },
    async doStream(params) {
      const transformedParams = await doTransform({ params, type: "stream" });
      const doGenerate = async () => model.doGenerate(transformedParams);
      const doStream = async () => model.doStream(transformedParams);
      return wrapStream ? wrapStream({ doGenerate, doStream, params: transformedParams, model }) : doStream();
    }
  };
};
var experimental_wrapLanguageModel = wrapLanguageModel;

// core/prompt/append-client-message.ts
function appendClientMessage({
  messages,
  message
}) {
  return [
    ...messages.length > 0 && messages[messages.length - 1].id === message.id ? messages.slice(0, -1) : messages,
    message
  ];
}

// core/prompt/append-response-messages.ts
import {
  extractMaxToolInvocationStep
} from "@ai-sdk/ui-utils";
import { AISDKError as AISDKError21 } from "@ai-sdk/provider";
function appendResponseMessages({
  messages,
  responseMessages,
  _internal: { currentDate = () => /* @__PURE__ */ new Date() } = {}
}) {
  var _a17, _b, _c, _d;
  const clonedMessages = structuredClone(messages);
  for (const message of responseMessages) {
    const role = message.role;
    const lastMessage = clonedMessages[clonedMessages.length - 1];
    const isLastMessageAssistant = lastMessage.role === "assistant";
    switch (role) {
      case "assistant": {
        let getToolInvocations2 = function(step) {
          return (typeof message.content === "string" ? [] : message.content.filter((part) => part.type === "tool-call")).map((call) => ({
            state: "call",
            step,
            args: call.args,
            toolCallId: call.toolCallId,
            toolName: call.toolName
          }));
        };
        var getToolInvocations = getToolInvocations2;
        const parts = [{ type: "step-start" }];
        let textContent = "";
        let reasoningTextContent = void 0;
        if (typeof message.content === "string") {
          textContent = message.content;
          parts.push({
            type: "text",
            text: message.content
          });
        } else {
          let reasoningPart = void 0;
          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                reasoningPart = void 0;
                textContent += part.text;
                parts.push({
                  type: "text",
                  text: part.text
                });
                break;
              }
              case "reasoning": {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: "reasoning",
                    reasoning: "",
                    details: []
                  };
                  parts.push(reasoningPart);
                }
                reasoningTextContent = (reasoningTextContent != null ? reasoningTextContent : "") + part.text;
                reasoningPart.reasoning += part.text;
                reasoningPart.details.push({
                  type: "text",
                  text: part.text,
                  signature: part.signature
                });
                break;
              }
              case "redacted-reasoning": {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: "reasoning",
                    reasoning: "",
                    details: []
                  };
                  parts.push(reasoningPart);
                }
                reasoningPart.details.push({
                  type: "redacted",
                  data: part.data
                });
                break;
              }
              case "tool-call":
                break;
              case "file":
                if (part.data instanceof URL) {
                  throw new AISDKError21({
                    name: "InvalidAssistantFileData",
                    message: "File data cannot be a URL"
                  });
                }
                parts.push({
                  type: "file",
                  mimeType: part.mimeType,
                  data: convertDataContentToBase64String(part.data)
                });
                break;
            }
          }
        }
        if (isLastMessageAssistant) {
          const maxStep = extractMaxToolInvocationStep(
            lastMessage.toolInvocations
          );
          (_a17 = lastMessage.parts) != null ? _a17 : lastMessage.parts = [];
          lastMessage.content = textContent;
          lastMessage.reasoning = reasoningTextContent;
          lastMessage.parts.push(...parts);
          lastMessage.toolInvocations = [
            ...(_b = lastMessage.toolInvocations) != null ? _b : [],
            ...getToolInvocations2(maxStep === void 0 ? 0 : maxStep + 1)
          ];
          getToolInvocations2(maxStep === void 0 ? 0 : maxStep + 1).map((call) => ({
            type: "tool-invocation",
            toolInvocation: call
          })).forEach((part) => {
            lastMessage.parts.push(part);
          });
        } else {
          clonedMessages.push({
            role: "assistant",
            id: message.id,
            createdAt: currentDate(),
            // generate a createdAt date for the message, will be overridden by the client
            content: textContent,
            reasoning: reasoningTextContent,
            toolInvocations: getToolInvocations2(0),
            parts: [
              ...parts,
              ...getToolInvocations2(0).map((call) => ({
                type: "tool-invocation",
                toolInvocation: call
              }))
            ]
          });
        }
        break;
      }
      case "tool": {
        (_c = lastMessage.toolInvocations) != null ? _c : lastMessage.toolInvocations = [];
        if (lastMessage.role !== "assistant") {
          throw new Error(
            `Tool result must follow an assistant message: ${lastMessage.role}`
          );
        }
        (_d = lastMessage.parts) != null ? _d : lastMessage.parts = [];
        for (const contentPart of message.content) {
          const toolCall = lastMessage.toolInvocations.find(
            (call) => call.toolCallId === contentPart.toolCallId
          );
          const toolCallPart = lastMessage.parts.find(
            (part) => part.type === "tool-invocation" && part.toolInvocation.toolCallId === contentPart.toolCallId
          );
          if (!toolCall) {
            throw new Error("Tool call not found in previous message");
          }
          toolCall.state = "result";
          const toolResult = toolCall;
          toolResult.result = contentPart.result;
          if (toolCallPart) {
            toolCallPart.toolInvocation = toolResult;
          } else {
            lastMessage.parts.push({
              type: "tool-invocation",
              toolInvocation: toolResult
            });
          }
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported message role: ${_exhaustiveCheck}`);
      }
    }
  }
  return clonedMessages;
}

// core/registry/custom-provider.ts
import { NoSuchModelError as NoSuchModelError2 } from "@ai-sdk/provider";
function customProvider({
  languageModels,
  textEmbeddingModels,
  imageModels,
  fallbackProvider
}) {
  return {
    languageModel(modelId) {
      if (languageModels != null && modelId in languageModels) {
        return languageModels[modelId];
      }
      if (fallbackProvider) {
        return fallbackProvider.languageModel(modelId);
      }
      throw new NoSuchModelError2({ modelId, modelType: "languageModel" });
    },
    textEmbeddingModel(modelId) {
      if (textEmbeddingModels != null && modelId in textEmbeddingModels) {
        return textEmbeddingModels[modelId];
      }
      if (fallbackProvider) {
        return fallbackProvider.textEmbeddingModel(modelId);
      }
      throw new NoSuchModelError2({ modelId, modelType: "textEmbeddingModel" });
    },
    imageModel(modelId) {
      if (imageModels != null && modelId in imageModels) {
        return imageModels[modelId];
      }
      if (fallbackProvider == null ? void 0 : fallbackProvider.imageModel) {
        return fallbackProvider.imageModel(modelId);
      }
      throw new NoSuchModelError2({ modelId, modelType: "imageModel" });
    }
  };
}
var experimental_customProvider = customProvider;

// core/registry/no-such-provider-error.ts
import { AISDKError as AISDKError22, NoSuchModelError as NoSuchModelError3 } from "@ai-sdk/provider";
var name16 = "AI_NoSuchProviderError";
var marker16 = `vercel.ai.error.${name16}`;
var symbol16 = Symbol.for(marker16);
var _a16;
var NoSuchProviderError = class extends NoSuchModelError3 {
  constructor({
    modelId,
    modelType,
    providerId,
    availableProviders,
    message = `No such provider: ${providerId} (available providers: ${availableProviders.join()})`
  }) {
    super({ errorName: name16, modelId, modelType, message });
    this[_a16] = true;
    this.providerId = providerId;
    this.availableProviders = availableProviders;
  }
  static isInstance(error) {
    return AISDKError22.hasMarker(error, marker16);
  }
};
_a16 = symbol16;

// core/registry/provider-registry.ts
import { NoSuchModelError as NoSuchModelError4 } from "@ai-sdk/provider";
function createProviderRegistry(providers, {
  separator = ":"
} = {}) {
  const registry = new DefaultProviderRegistry({
    separator
  });
  for (const [id, provider] of Object.entries(providers)) {
    registry.registerProvider({ id, provider });
  }
  return registry;
}
var experimental_createProviderRegistry = createProviderRegistry;
var DefaultProviderRegistry = class {
  constructor({ separator }) {
    this.providers = {};
    this.separator = separator;
  }
  registerProvider({
    id,
    provider
  }) {
    this.providers[id] = provider;
  }
  getProvider(id) {
    const provider = this.providers[id];
    if (provider == null) {
      throw new NoSuchProviderError({
        modelId: id,
        modelType: "languageModel",
        providerId: id,
        availableProviders: Object.keys(this.providers)
      });
    }
    return provider;
  }
  splitId(id, modelType) {
    const index = id.indexOf(this.separator);
    if (index === -1) {
      throw new NoSuchModelError4({
        modelId: id,
        modelType,
        message: `Invalid ${modelType} id for registry: ${id} (must be in the format "providerId${this.separator}modelId")`
      });
    }
    return [id.slice(0, index), id.slice(index + this.separator.length)];
  }
  languageModel(id) {
    var _a17, _b;
    const [providerId, modelId] = this.splitId(id, "languageModel");
    const model = (_b = (_a17 = this.getProvider(providerId)).languageModel) == null ? void 0 : _b.call(_a17, modelId);
    if (model == null) {
      throw new NoSuchModelError4({ modelId: id, modelType: "languageModel" });
    }
    return model;
  }
  textEmbeddingModel(id) {
    var _a17;
    const [providerId, modelId] = this.splitId(id, "textEmbeddingModel");
    const provider = this.getProvider(providerId);
    const model = (_a17 = provider.textEmbeddingModel) == null ? void 0 : _a17.call(provider, modelId);
    if (model == null) {
      throw new NoSuchModelError4({
        modelId: id,
        modelType: "textEmbeddingModel"
      });
    }
    return model;
  }
  imageModel(id) {
    var _a17;
    const [providerId, modelId] = this.splitId(id, "imageModel");
    const provider = this.getProvider(providerId);
    const model = (_a17 = provider.imageModel) == null ? void 0 : _a17.call(provider, modelId);
    if (model == null) {
      throw new NoSuchModelError4({ modelId: id, modelType: "imageModel" });
    }
    return model;
  }
};

// core/tool/mcp/mcp-client.ts
import { jsonSchema } from "@ai-sdk/ui-utils";

// core/tool/tool.ts
function tool(tool2) {
  return tool2;
}

// core/tool/mcp/mcp-sse-transport.ts
import { createEventSourceParserStream } from "@ai-sdk/provider-utils";

// core/tool/mcp/json-rpc-message.ts
import { z as z9 } from "zod";

// core/tool/mcp/types.ts
import { z as z8 } from "zod";
var LATEST_PROTOCOL_VERSION = "2024-11-05";
var SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  "2024-10-07"
];
var ClientOrServerImplementationSchema = z8.object({
  name: z8.string(),
  version: z8.string()
}).passthrough();
var BaseParamsSchema = z8.object({
  _meta: z8.optional(z8.object({}).passthrough())
}).passthrough();
var ResultSchema = BaseParamsSchema;
var RequestSchema = z8.object({
  method: z8.string(),
  params: z8.optional(BaseParamsSchema)
});
var ServerCapabilitiesSchema = z8.object({
  experimental: z8.optional(z8.object({}).passthrough()),
  logging: z8.optional(z8.object({}).passthrough()),
  prompts: z8.optional(
    z8.object({
      listChanged: z8.optional(z8.boolean())
    }).passthrough()
  ),
  resources: z8.optional(
    z8.object({
      subscribe: z8.optional(z8.boolean()),
      listChanged: z8.optional(z8.boolean())
    }).passthrough()
  ),
  tools: z8.optional(
    z8.object({
      listChanged: z8.optional(z8.boolean())
    }).passthrough()
  )
}).passthrough();
var InitializeResultSchema = ResultSchema.extend({
  protocolVersion: z8.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ClientOrServerImplementationSchema,
  instructions: z8.optional(z8.string())
});
var PaginatedResultSchema = ResultSchema.extend({
  nextCursor: z8.optional(z8.string())
});
var ToolSchema = z8.object({
  name: z8.string(),
  description: z8.optional(z8.string()),
  inputSchema: z8.object({
    type: z8.literal("object"),
    properties: z8.optional(z8.object({}).passthrough())
  }).passthrough()
}).passthrough();
var ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: z8.array(ToolSchema)
});
var TextContentSchema = z8.object({
  type: z8.literal("text"),
  text: z8.string()
}).passthrough();
var ImageContentSchema = z8.object({
  type: z8.literal("image"),
  data: z8.string().base64(),
  mimeType: z8.string()
}).passthrough();
var ResourceContentsSchema = z8.object({
  /**
   * The URI of this resource.
   */
  uri: z8.string(),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: z8.optional(z8.string())
}).passthrough();
var TextResourceContentsSchema = ResourceContentsSchema.extend({
  text: z8.string()
});
var BlobResourceContentsSchema = ResourceContentsSchema.extend({
  blob: z8.string().base64()
});
var EmbeddedResourceSchema = z8.object({
  type: z8.literal("resource"),
  resource: z8.union([TextResourceContentsSchema, BlobResourceContentsSchema])
}).passthrough();
var CallToolResultSchema = ResultSchema.extend({
  content: z8.array(
    z8.union([TextContentSchema, ImageContentSchema, EmbeddedResourceSchema])
  ),
  isError: z8.boolean().default(false).optional()
}).or(
  ResultSchema.extend({
    toolResult: z8.unknown()
  })
);

// core/tool/mcp/json-rpc-message.ts
var JSONRPC_VERSION = "2.0";
var JSONRPCRequestSchema = z9.object({
  jsonrpc: z9.literal(JSONRPC_VERSION),
  id: z9.union([z9.string(), z9.number().int()])
}).merge(RequestSchema).strict();
var JSONRPCResponseSchema = z9.object({
  jsonrpc: z9.literal(JSONRPC_VERSION),
  id: z9.union([z9.string(), z9.number().int()]),
  result: ResultSchema
}).strict();
var JSONRPCErrorSchema = z9.object({
  jsonrpc: z9.literal(JSONRPC_VERSION),
  id: z9.union([z9.string(), z9.number().int()]),
  error: z9.object({
    code: z9.number().int(),
    message: z9.string(),
    data: z9.optional(z9.unknown())
  })
}).strict();
var JSONRPCNotificationSchema = z9.object({
  jsonrpc: z9.literal(JSONRPC_VERSION)
}).merge(
  z9.object({
    method: z9.string(),
    params: z9.optional(BaseParamsSchema)
  })
).strict();
var JSONRPCMessageSchema = z9.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema
]);

// core/tool/mcp/mcp-sse-transport.ts
var SseMCPTransport = class {
  constructor({
    url,
    headers
  }) {
    this.connected = false;
    this.url = new URL(url);
    this.headers = headers;
  }
  async start() {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        return resolve();
      }
      this.abortController = new AbortController();
      const establishConnection = async () => {
        var _a17, _b, _c;
        try {
          const headers = new Headers(this.headers);
          headers.set("Accept", "text/event-stream");
          const response = await fetch(this.url.href, {
            headers,
            signal: (_a17 = this.abortController) == null ? void 0 : _a17.signal
          });
          if (!response.ok || !response.body) {
            const error = new MCPClientError({
              message: `MCP SSE Transport Error: ${response.status} ${response.statusText}`
            });
            (_b = this.onerror) == null ? void 0 : _b.call(this, error);
            return reject(error);
          }
          const stream = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(createEventSourceParserStream());
          const reader = stream.getReader();
          const processEvents = async () => {
            var _a18, _b2, _c2;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  if (this.connected) {
                    this.connected = false;
                    throw new MCPClientError({
                      message: "MCP SSE Transport Error: Connection closed unexpectedly"
                    });
                  }
                  return;
                }
                const { event, data } = value;
                if (event === "endpoint") {
                  this.endpoint = new URL(data, this.url);
                  if (this.endpoint.origin !== this.url.origin) {
                    throw new MCPClientError({
                      message: `MCP SSE Transport Error: Endpoint origin does not match connection origin: ${this.endpoint.origin}`
                    });
                  }
                  this.connected = true;
                  resolve();
                } else if (event === "message") {
                  try {
                    const message = JSONRPCMessageSchema.parse(
                      JSON.parse(data)
                    );
                    (_a18 = this.onmessage) == null ? void 0 : _a18.call(this, message);
                  } catch (error) {
                    const e = new MCPClientError({
                      message: "MCP SSE Transport Error: Failed to parse message",
                      cause: error
                    });
                    (_b2 = this.onerror) == null ? void 0 : _b2.call(this, e);
                  }
                }
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                return;
              }
              (_c2 = this.onerror) == null ? void 0 : _c2.call(this, error);
              reject(error);
            }
          };
          this.sseConnection = {
            close: () => reader.cancel()
          };
          processEvents();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          (_c = this.onerror) == null ? void 0 : _c.call(this, error);
          reject(error);
        }
      };
      establishConnection();
    });
  }
  async close() {
    var _a17, _b, _c;
    this.connected = false;
    (_a17 = this.sseConnection) == null ? void 0 : _a17.close();
    (_b = this.abortController) == null ? void 0 : _b.abort();
    (_c = this.onclose) == null ? void 0 : _c.call(this);
  }
  async send(message) {
    var _a17, _b, _c;
    if (!this.endpoint || !this.connected) {
      throw new MCPClientError({
        message: "MCP SSE Transport Error: Not connected"
      });
    }
    try {
      const headers = new Headers(this.headers);
      headers.set("Content-Type", "application/json");
      const init = {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: (_a17 = this.abortController) == null ? void 0 : _a17.signal
      };
      const response = await fetch(this.endpoint, init);
      if (!response.ok) {
        const text2 = await response.text().catch(() => null);
        const error = new MCPClientError({
          message: `MCP SSE Transport Error: POSTing to endpoint (HTTP ${response.status}): ${text2}`
        });
        (_b = this.onerror) == null ? void 0 : _b.call(this, error);
        return;
      }
    } catch (error) {
      (_c = this.onerror) == null ? void 0 : _c.call(this, error);
      return;
    }
  }
};

// core/tool/mcp/mcp-transport.ts
function createMcpTransport(config) {
  if (config.type !== "sse") {
    throw new MCPClientError({
      message: "Unsupported or invalid transport configuration. If you are using a custom transport, make sure it implements the MCPTransport interface."
    });
  }
  return new SseMCPTransport(config);
}
function isCustomMcpTransport(transport) {
  return "start" in transport && typeof transport.start === "function" && "send" in transport && typeof transport.send === "function" && "close" in transport && typeof transport.close === "function";
}

// core/tool/mcp/mcp-client.ts
var CLIENT_VERSION = "1.0.0";
async function createMCPClient(config) {
  const client = new MCPClient(config);
  await client.init();
  return client;
}
var MCPClient = class {
  constructor({
    transport: transportConfig,
    name: name17 = "ai-sdk-mcp-client",
    onUncaughtError
  }) {
    this.requestMessageId = 0;
    this.responseHandlers = /* @__PURE__ */ new Map();
    this.serverCapabilities = {};
    this.isClosed = true;
    this.onUncaughtError = onUncaughtError;
    if (isCustomMcpTransport(transportConfig)) {
      this.transport = transportConfig;
    } else {
      this.transport = createMcpTransport(transportConfig);
    }
    this.transport.onclose = () => this.onClose();
    this.transport.onerror = (error) => this.onError(error);
    this.transport.onmessage = (message) => {
      if ("method" in message) {
        this.onError(
          new MCPClientError({
            message: "Unsupported message type"
          })
        );
        return;
      }
      this.onResponse(message);
    };
    this.clientInfo = {
      name: name17,
      version: CLIENT_VERSION
    };
  }
  async init() {
    try {
      await this.transport.start();
      this.isClosed = false;
      const result = await this.request({
        request: {
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: this.clientInfo
          }
        },
        resultSchema: InitializeResultSchema
      });
      if (result === void 0) {
        throw new MCPClientError({
          message: "Server sent invalid initialize result"
        });
      }
      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
        throw new MCPClientError({
          message: `Server's protocol version is not supported: ${result.protocolVersion}`
        });
      }
      this.serverCapabilities = result.capabilities;
      await this.notification({
        method: "notifications/initialized"
      });
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  async close() {
    var _a17;
    if (this.isClosed)
      return;
    await ((_a17 = this.transport) == null ? void 0 : _a17.close());
    this.onClose();
  }
  assertCapability(method) {
    switch (method) {
      case "initialize":
        break;
      case "tools/list":
      case "tools/call":
        if (!this.serverCapabilities.tools) {
          throw new MCPClientError({
            message: `Server does not support tools`
          });
        }
        break;
      default:
        throw new MCPClientError({
          message: `Unsupported method: ${method}`
        });
    }
  }
  async request({
    request,
    resultSchema,
    options
  }) {
    return new Promise((resolve, reject) => {
      if (this.isClosed) {
        return reject(
          new MCPClientError({
            message: "Attempted to send a request from a closed client"
          })
        );
      }
      this.assertCapability(request.method);
      const signal = options == null ? void 0 : options.signal;
      signal == null ? void 0 : signal.throwIfAborted();
      const messageId = this.requestMessageId++;
      const jsonrpcRequest = {
        ...request,
        jsonrpc: "2.0",
        id: messageId
      };
      const cleanup = () => {
        this.responseHandlers.delete(messageId);
      };
      this.responseHandlers.set(messageId, (response) => {
        if (signal == null ? void 0 : signal.aborted) {
          return reject(
            new MCPClientError({
              message: "Request was aborted",
              cause: signal.reason
            })
          );
        }
        if (response instanceof Error) {
          return reject(response);
        }
        try {
          const result = resultSchema.parse(response.result);
          resolve(result);
        } catch (error) {
          const parseError = new MCPClientError({
            message: "Failed to parse server response",
            cause: error
          });
          reject(parseError);
        }
      });
      this.transport.send(jsonrpcRequest).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }
  async listTools({
    params,
    options
  } = {}) {
    try {
      return this.request({
        request: { method: "tools/list", params },
        resultSchema: ListToolsResultSchema,
        options
      });
    } catch (error) {
      throw error;
    }
  }
  async callTool({
    name: name17,
    args,
    options
  }) {
    try {
      return this.request({
        request: { method: "tools/call", params: { name: name17, arguments: args } },
        resultSchema: CallToolResultSchema,
        options: {
          signal: options == null ? void 0 : options.abortSignal
        }
      });
    } catch (error) {
      throw error;
    }
  }
  async notification(notification) {
    const jsonrpcNotification = {
      ...notification,
      jsonrpc: "2.0"
    };
    await this.transport.send(jsonrpcNotification);
  }
  /**
   * Returns a set of AI SDK tools from the MCP server
   * @returns A record of tool names to their implementations
   */
  async tools({
    schemas = "automatic"
  } = {}) {
    var _a17;
    const tools = {};
    try {
      const listToolsResult = await this.listTools();
      for (const { name: name17, description, inputSchema } of listToolsResult.tools) {
        if (schemas !== "automatic" && !(name17 in schemas)) {
          continue;
        }
        const parameters = schemas === "automatic" ? jsonSchema({
          ...inputSchema,
          properties: (_a17 = inputSchema.properties) != null ? _a17 : {},
          additionalProperties: false
        }) : schemas[name17].parameters;
        const self = this;
        const toolWithExecute = tool({
          description,
          parameters,
          execute: async (args, options) => {
            var _a18;
            (_a18 = options == null ? void 0 : options.abortSignal) == null ? void 0 : _a18.throwIfAborted();
            return self.callTool({
              name: name17,
              args,
              options
            });
          }
        });
        tools[name17] = toolWithExecute;
      }
      return tools;
    } catch (error) {
      throw error;
    }
  }
  onClose() {
    if (this.isClosed)
      return;
    this.isClosed = true;
    const error = new MCPClientError({
      message: "Connection closed"
    });
    for (const handler of this.responseHandlers.values()) {
      handler(error);
    }
    this.responseHandlers.clear();
  }
  onError(error) {
    if (this.onUncaughtError) {
      this.onUncaughtError(error);
    }
  }
  onResponse(response) {
    const messageId = Number(response.id);
    const handler = this.responseHandlers.get(messageId);
    if (handler === void 0) {
      throw new MCPClientError({
        message: `Protocol error: Received a response for an unknown message ID: ${JSON.stringify(
          response
        )}`
      });
    }
    this.responseHandlers.delete(messageId);
    handler(
      "result" in response ? response : new MCPClientError({
        message: response.error.message,
        cause: response.error
      })
    );
  }
};

// core/util/cosine-similarity.ts
function cosineSimilarity(vector1, vector2, options) {
  if (vector1.length !== vector2.length) {
    throw new InvalidArgumentError({
      parameter: "vector1,vector2",
      value: { vector1Length: vector1.length, vector2Length: vector2.length },
      message: `Vectors must have the same length`
    });
  }
  const n = vector1.length;
  if (n === 0) {
    if (options == null ? void 0 : options.throwErrorForEmptyVectors) {
      throw new InvalidArgumentError({
        parameter: "vector1",
        value: vector1,
        message: "Vectors cannot be empty"
      });
    }
    return 0;
  }
  let magnitudeSquared1 = 0;
  let magnitudeSquared2 = 0;
  let dotProduct = 0;
  for (let i = 0; i < n; i++) {
    const value1 = vector1[i];
    const value2 = vector2[i];
    magnitudeSquared1 += value1 * value1;
    magnitudeSquared2 += value2 * value2;
    dotProduct += value1 * value2;
  }
  return magnitudeSquared1 === 0 || magnitudeSquared2 === 0 ? 0 : dotProduct / (Math.sqrt(magnitudeSquared1) * Math.sqrt(magnitudeSquared2));
}

// core/util/simulate-readable-stream.ts
import { delay as delayFunction } from "@ai-sdk/provider-utils";
function simulateReadableStream({
  chunks,
  initialDelayInMs = 0,
  chunkDelayInMs = 0,
  _internal
}) {
  var _a17;
  const delay2 = (_a17 = _internal == null ? void 0 : _internal.delay) != null ? _a17 : delayFunction;
  let index = 0;
  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        await delay2(index === 0 ? initialDelayInMs : chunkDelayInMs);
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    }
  });
}

// streams/assistant-response.ts
import {
  formatAssistantStreamPart as formatAssistantStreamPart2
} from "@ai-sdk/ui-utils";
function AssistantResponse({ threadId, messageId }, process2) {
  const stream = new ReadableStream({
    async start(controller) {
      var _a17;
      const textEncoder = new TextEncoder();
      const sendMessage = (message) => {
        controller.enqueue(
          textEncoder.encode(
            formatAssistantStreamPart2("assistant_message", message)
          )
        );
      };
      const sendDataMessage = (message) => {
        controller.enqueue(
          textEncoder.encode(
            formatAssistantStreamPart2("data_message", message)
          )
        );
      };
      const sendError = (errorMessage) => {
        controller.enqueue(
          textEncoder.encode(formatAssistantStreamPart2("error", errorMessage))
        );
      };
      const forwardStream = async (stream2) => {
        var _a18, _b;
        let result = void 0;
        for await (const value of stream2) {
          switch (value.event) {
            case "thread.message.created": {
              controller.enqueue(
                textEncoder.encode(
                  formatAssistantStreamPart2("assistant_message", {
                    id: value.data.id,
                    role: "assistant",
                    content: [{ type: "text", text: { value: "" } }]
                  })
                )
              );
              break;
            }
            case "thread.message.delta": {
              const content = (_a18 = value.data.delta.content) == null ? void 0 : _a18[0];
              if ((content == null ? void 0 : content.type) === "text" && ((_b = content.text) == null ? void 0 : _b.value) != null) {
                controller.enqueue(
                  textEncoder.encode(
                    formatAssistantStreamPart2("text", content.text.value)
                  )
                );
              }
              break;
            }
            case "thread.run.completed":
            case "thread.run.requires_action": {
              result = value.data;
              break;
            }
          }
        }
        return result;
      };
      controller.enqueue(
        textEncoder.encode(
          formatAssistantStreamPart2("assistant_control_data", {
            threadId,
            messageId
          })
        )
      );
      try {
        await process2({
          sendMessage,
          sendDataMessage,
          forwardStream
        });
      } catch (error) {
        sendError((_a17 = error.message) != null ? _a17 : `${error}`);
      } finally {
        controller.close();
      }
    },
    pull(controller) {
    },
    cancel() {
    }
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

// streams/langchain-adapter.ts
var langchain_adapter_exports = {};
__export(langchain_adapter_exports, {
  mergeIntoDataStream: () => mergeIntoDataStream,
  toDataStream: () => toDataStream,
  toDataStreamResponse: () => toDataStreamResponse
});
import { formatDataStreamPart as formatDataStreamPart4 } from "@ai-sdk/ui-utils";

// streams/stream-callbacks.ts
function createCallbacksTransformer(callbacks = {}) {
  const textEncoder = new TextEncoder();
  let aggregatedResponse = "";
  return new TransformStream({
    async start() {
      if (callbacks.onStart)
        await callbacks.onStart();
    },
    async transform(message, controller) {
      controller.enqueue(textEncoder.encode(message));
      aggregatedResponse += message;
      if (callbacks.onToken)
        await callbacks.onToken(message);
      if (callbacks.onText && typeof message === "string") {
        await callbacks.onText(message);
      }
    },
    async flush() {
      if (callbacks.onCompletion) {
        await callbacks.onCompletion(aggregatedResponse);
      }
      if (callbacks.onFinal) {
        await callbacks.onFinal(aggregatedResponse);
      }
    }
  });
}

// streams/langchain-adapter.ts
function toDataStreamInternal(stream, callbacks) {
  return stream.pipeThrough(
    new TransformStream({
      transform: async (value, controller) => {
        var _a17;
        if (typeof value === "string") {
          controller.enqueue(value);
          return;
        }
        if ("event" in value) {
          if (value.event === "on_chat_model_stream") {
            forwardAIMessageChunk(
              (_a17 = value.data) == null ? void 0 : _a17.chunk,
              controller
            );
          }
          return;
        }
        forwardAIMessageChunk(value, controller);
      }
    })
  ).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream({
      transform: async (chunk, controller) => {
        controller.enqueue(formatDataStreamPart4("text", chunk));
      }
    })
  );
}
function toDataStream(stream, callbacks) {
  return toDataStreamInternal(stream, callbacks).pipeThrough(
    new TextEncoderStream()
  );
}
function toDataStreamResponse(stream, options) {
  var _a17;
  const dataStream = toDataStreamInternal(
    stream,
    options == null ? void 0 : options.callbacks
  ).pipeThrough(new TextEncoderStream());
  const data = options == null ? void 0 : options.data;
  const init = options == null ? void 0 : options.init;
  const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
  return new Response(responseStream, {
    status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
    statusText: init == null ? void 0 : init.statusText,
    headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
      contentType: "text/plain; charset=utf-8",
      dataStreamVersion: "v1"
    })
  });
}
function mergeIntoDataStream(stream, options) {
  options.dataStream.merge(toDataStreamInternal(stream, options.callbacks));
}
function forwardAIMessageChunk(chunk, controller) {
  if (typeof chunk.content === "string") {
    controller.enqueue(chunk.content);
  } else {
    const content = chunk.content;
    for (const item of content) {
      if (item.type === "text") {
        controller.enqueue(item.text);
      }
    }
  }
}

// streams/llamaindex-adapter.ts
var llamaindex_adapter_exports = {};
__export(llamaindex_adapter_exports, {
  mergeIntoDataStream: () => mergeIntoDataStream2,
  toDataStream: () => toDataStream2,
  toDataStreamResponse: () => toDataStreamResponse2
});
import { convertAsyncIteratorToReadableStream } from "@ai-sdk/provider-utils";
import { formatDataStreamPart as formatDataStreamPart5 } from "@ai-sdk/ui-utils";
function toDataStreamInternal2(stream, callbacks) {
  const trimStart = trimStartOfStream();
  return convertAsyncIteratorToReadableStream(stream[Symbol.asyncIterator]()).pipeThrough(
    new TransformStream({
      async transform(message, controller) {
        controller.enqueue(trimStart(message.delta));
      }
    })
  ).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(
    new TransformStream({
      transform: async (chunk, controller) => {
        controller.enqueue(formatDataStreamPart5("text", chunk));
      }
    })
  );
}
function toDataStream2(stream, callbacks) {
  return toDataStreamInternal2(stream, callbacks).pipeThrough(
    new TextEncoderStream()
  );
}
function toDataStreamResponse2(stream, options = {}) {
  var _a17;
  const { init, data, callbacks } = options;
  const dataStream = toDataStreamInternal2(stream, callbacks).pipeThrough(
    new TextEncoderStream()
  );
  const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
  return new Response(responseStream, {
    status: (_a17 = init == null ? void 0 : init.status) != null ? _a17 : 200,
    statusText: init == null ? void 0 : init.statusText,
    headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
      contentType: "text/plain; charset=utf-8",
      dataStreamVersion: "v1"
    })
  });
}
function mergeIntoDataStream2(stream, options) {
  options.dataStream.merge(toDataStreamInternal2(stream, options.callbacks));
}
function trimStartOfStream() {
  let isStreamStart = true;
  return (text2) => {
    if (isStreamStart) {
      text2 = text2.trimStart();
      if (text2)
        isStreamStart = false;
    }
    return text2;
  };
}

// streams/stream-data.ts
import { formatDataStreamPart as formatDataStreamPart6 } from "@ai-sdk/ui-utils";

// util/constants.ts
var HANGING_STREAM_WARNING_TIME_MS = 15 * 1e3;

// streams/stream-data.ts
var StreamData = class {
  constructor() {
    this.encoder = new TextEncoder();
    this.controller = null;
    this.isClosed = false;
    this.warningTimeout = null;
    const self = this;
    this.stream = new ReadableStream({
      start: async (controller) => {
        self.controller = controller;
        if (process.env.NODE_ENV === "development") {
          self.warningTimeout = setTimeout(() => {
            console.warn(
              "The data stream is hanging. Did you forget to close it with `data.close()`?"
            );
          }, HANGING_STREAM_WARNING_TIME_MS);
        }
      },
      pull: (controller) => {
      },
      cancel: (reason) => {
        this.isClosed = true;
      }
    });
  }
  async close() {
    if (this.isClosed) {
      throw new Error("Data Stream has already been closed.");
    }
    if (!this.controller) {
      throw new Error("Stream controller is not initialized.");
    }
    this.controller.close();
    this.isClosed = true;
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
    }
  }
  append(value) {
    if (this.isClosed) {
      throw new Error("Data Stream has already been closed.");
    }
    if (!this.controller) {
      throw new Error("Stream controller is not initialized.");
    }
    this.controller.enqueue(
      this.encoder.encode(formatDataStreamPart6("data", [value]))
    );
  }
  appendMessageAnnotation(value) {
    if (this.isClosed) {
      throw new Error("Data Stream has already been closed.");
    }
    if (!this.controller) {
      throw new Error("Stream controller is not initialized.");
    }
    this.controller.enqueue(
      this.encoder.encode(formatDataStreamPart6("message_annotations", [value]))
    );
  }
};
export {
  AISDKError17 as AISDKError,
  APICallError2 as APICallError,
  AssistantResponse,
  DownloadError,
  EmptyResponseBodyError,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidMessageRoleError,
  InvalidPromptError2 as InvalidPromptError,
  InvalidResponseDataError,
  InvalidStreamPartError,
  InvalidToolArgumentsError,
  JSONParseError2 as JSONParseError,
  langchain_adapter_exports as LangChainAdapter,
  llamaindex_adapter_exports as LlamaIndexAdapter,
  LoadAPIKeyError,
  MCPClientError,
  MessageConversionError,
  NoContentGeneratedError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoOutputSpecifiedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  output_exports as Output,
  RetryError,
  StreamData,
  ToolCallRepairError,
  ToolExecutionError,
  TypeValidationError3 as TypeValidationError,
  UnsupportedFunctionalityError2 as UnsupportedFunctionalityError,
  UnsupportedModelVersionError,
  appendClientMessage,
  appendResponseMessages,
  convertToCoreMessages,
  coreAssistantMessageSchema,
  coreMessageSchema,
  coreSystemMessageSchema,
  coreToolMessageSchema,
  coreUserMessageSchema,
  cosineSimilarity,
  createDataStream,
  createDataStreamResponse,
  createIdGenerator5 as createIdGenerator,
  createProviderRegistry,
  customProvider,
  defaultSettingsMiddleware,
  embed,
  embedMany,
  createMCPClient as experimental_createMCPClient,
  experimental_createProviderRegistry,
  experimental_customProvider,
  generateImage as experimental_generateImage,
  generateSpeech as experimental_generateSpeech,
  transcribe as experimental_transcribe,
  experimental_wrapLanguageModel,
  extractReasoningMiddleware,
  formatAssistantStreamPart,
  formatDataStreamPart3 as formatDataStreamPart,
  generateId2 as generateId,
  generateObject,
  generateText,
  jsonSchema2 as jsonSchema,
  parseAssistantStreamPart,
  parseDataStreamPart,
  pipeDataStreamToResponse,
  processDataStream,
  processTextStream,
  simulateReadableStream,
  simulateStreamingMiddleware,
  smoothStream,
  streamObject,
  streamText,
  tool,
  wrapLanguageModel,
  zodSchema
};
//# sourceMappingURL=index.mjs.map