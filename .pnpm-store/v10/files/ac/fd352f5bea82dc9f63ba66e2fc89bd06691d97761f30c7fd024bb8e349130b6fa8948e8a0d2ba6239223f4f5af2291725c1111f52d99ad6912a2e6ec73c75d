"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  EventSourceParserStream: () => import_stream2.EventSourceParserStream,
  asSchema: () => asSchema,
  asValidator: () => asValidator,
  combineHeaders: () => combineHeaders,
  convertAsyncIteratorToReadableStream: () => convertAsyncIteratorToReadableStream,
  convertBase64ToUint8Array: () => convertBase64ToUint8Array,
  convertToBase64: () => convertToBase64,
  convertUint8ArrayToBase64: () => convertUint8ArrayToBase64,
  createBinaryResponseHandler: () => createBinaryResponseHandler,
  createEventSourceResponseHandler: () => createEventSourceResponseHandler,
  createIdGenerator: () => createIdGenerator,
  createJsonErrorResponseHandler: () => createJsonErrorResponseHandler,
  createJsonResponseHandler: () => createJsonResponseHandler,
  createJsonStreamResponseHandler: () => createJsonStreamResponseHandler,
  createProviderDefinedToolFactory: () => createProviderDefinedToolFactory,
  createProviderDefinedToolFactoryWithOutputSchema: () => createProviderDefinedToolFactoryWithOutputSchema,
  createStatusCodeErrorResponseHandler: () => createStatusCodeErrorResponseHandler,
  delay: () => delay,
  dynamicTool: () => dynamicTool,
  executeTool: () => executeTool,
  extractResponseHeaders: () => extractResponseHeaders,
  generateId: () => generateId,
  getErrorMessage: () => getErrorMessage,
  getFromApi: () => getFromApi,
  isAbortError: () => isAbortError,
  isParsableJson: () => isParsableJson,
  isUrlSupported: () => isUrlSupported,
  isValidator: () => isValidator,
  jsonSchema: () => jsonSchema,
  loadApiKey: () => loadApiKey,
  loadOptionalSetting: () => loadOptionalSetting,
  loadSetting: () => loadSetting,
  parseJSON: () => parseJSON,
  parseJsonEventStream: () => parseJsonEventStream,
  parseProviderOptions: () => parseProviderOptions,
  postFormDataToApi: () => postFormDataToApi,
  postJsonToApi: () => postJsonToApi,
  postToApi: () => postToApi,
  removeUndefinedEntries: () => removeUndefinedEntries,
  resolve: () => resolve,
  safeParseJSON: () => safeParseJSON,
  safeValidateTypes: () => safeValidateTypes,
  standardSchemaValidator: () => standardSchemaValidator,
  tool: () => tool,
  validateTypes: () => validateTypes,
  validator: () => validator,
  validatorSymbol: () => validatorSymbol,
  withoutTrailingSlash: () => withoutTrailingSlash,
  zodSchema: () => zodSchema
});
module.exports = __toCommonJS(src_exports);

// src/combine-headers.ts
function combineHeaders(...headers) {
  return headers.reduce(
    (combinedHeaders, currentHeaders) => ({
      ...combinedHeaders,
      ...currentHeaders != null ? currentHeaders : {}
    }),
    {}
  );
}

// src/convert-async-iterator-to-readable-stream.ts
function convertAsyncIteratorToReadableStream(iterator) {
  return new ReadableStream({
    /**
     * Called when the consumer wants to pull more data from the stream.
     *
     * @param {ReadableStreamDefaultController<T>} controller - The controller to enqueue data into the stream.
     * @returns {Promise<void>}
     */
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
    /**
     * Called when the consumer cancels the stream.
     */
    cancel() {
    }
  });
}

// src/delay.ts
async function delay(delayInMs, options) {
  if (delayInMs == null) {
    return Promise.resolve();
  }
  const signal = options == null ? void 0 : options.abortSignal;
  return new Promise((resolve2, reject) => {
    if (signal == null ? void 0 : signal.aborted) {
      reject(createAbortError());
      return;
    }
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve2();
    }, delayInMs);
    const cleanup = () => {
      clearTimeout(timeoutId);
      signal == null ? void 0 : signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    signal == null ? void 0 : signal.addEventListener("abort", onAbort);
  });
}
function createAbortError() {
  return new DOMException("Delay was aborted", "AbortError");
}

// src/extract-response-headers.ts
function extractResponseHeaders(response) {
  return Object.fromEntries([...response.headers]);
}

// src/generate-id.ts
var import_provider = require("@ai-sdk/provider");
var createIdGenerator = ({
  prefix,
  size = 16,
  alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  separator = "-"
} = {}) => {
  const generator = () => {
    const alphabetLength = alphabet.length;
    const chars = new Array(size);
    for (let i = 0; i < size; i++) {
      chars[i] = alphabet[Math.random() * alphabetLength | 0];
    }
    return chars.join("");
  };
  if (prefix == null) {
    return generator;
  }
  if (alphabet.includes(separator)) {
    throw new import_provider.InvalidArgumentError({
      argument: "separator",
      message: `The separator "${separator}" must not be part of the alphabet "${alphabet}".`
    });
  }
  return () => `${prefix}${separator}${generator()}`;
};
var generateId = createIdGenerator();

// src/get-error-message.ts
function getErrorMessage(error) {
  if (error == null) {
    return "unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
}

// src/get-from-api.ts
var import_provider3 = require("@ai-sdk/provider");

// src/handle-fetch-error.ts
var import_provider2 = require("@ai-sdk/provider");

// src/is-abort-error.ts
function isAbortError(error) {
  return (error instanceof Error || error instanceof DOMException) && (error.name === "AbortError" || error.name === "ResponseAborted" || // Next.js
  error.name === "TimeoutError");
}

// src/handle-fetch-error.ts
var FETCH_FAILED_ERROR_MESSAGES = ["fetch failed", "failed to fetch"];
function handleFetchError({
  error,
  url,
  requestBodyValues
}) {
  if (isAbortError(error)) {
    return error;
  }
  if (error instanceof TypeError && FETCH_FAILED_ERROR_MESSAGES.includes(error.message.toLowerCase())) {
    const cause = error.cause;
    if (cause != null) {
      return new import_provider2.APICallError({
        message: `Cannot connect to API: ${cause.message}`,
        cause,
        url,
        requestBodyValues,
        isRetryable: true
        // retry when network error
      });
    }
  }
  return error;
}

// src/remove-undefined-entries.ts
function removeUndefinedEntries(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([_key, value]) => value != null)
  );
}

// src/get-from-api.ts
var getOriginalFetch = () => globalThis.fetch;
var getFromApi = async ({
  url,
  headers = {},
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch = getOriginalFetch()
}) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: removeUndefinedEntries(headers),
      signal: abortSignal
    });
    const responseHeaders = extractResponseHeaders(response);
    if (!response.ok) {
      let errorInformation;
      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: {}
        });
      } catch (error) {
        if (isAbortError(error) || import_provider3.APICallError.isInstance(error)) {
          throw error;
        }
        throw new import_provider3.APICallError({
          message: "Failed to process error response",
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: {}
        });
      }
      throw errorInformation.value;
    }
    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: {}
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || import_provider3.APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new import_provider3.APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: {}
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: {} });
  }
};

// src/is-url-supported.ts
function isUrlSupported({
  mediaType,
  url,
  supportedUrls
}) {
  url = url.toLowerCase();
  mediaType = mediaType.toLowerCase();
  return Object.entries(supportedUrls).map(([key, value]) => {
    const mediaType2 = key.toLowerCase();
    return mediaType2 === "*" || mediaType2 === "*/*" ? { mediaTypePrefix: "", regexes: value } : { mediaTypePrefix: mediaType2.replace(/\*/, ""), regexes: value };
  }).filter(({ mediaTypePrefix }) => mediaType.startsWith(mediaTypePrefix)).flatMap(({ regexes }) => regexes).some((pattern) => pattern.test(url));
}

// src/load-api-key.ts
var import_provider4 = require("@ai-sdk/provider");
function loadApiKey({
  apiKey,
  environmentVariableName,
  apiKeyParameterName = "apiKey",
  description
}) {
  if (typeof apiKey === "string") {
    return apiKey;
  }
  if (apiKey != null) {
    throw new import_provider4.LoadAPIKeyError({
      message: `${description} API key must be a string.`
    });
  }
  if (typeof process === "undefined") {
    throw new import_provider4.LoadAPIKeyError({
      message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter. Environment variables is not supported in this environment.`
    });
  }
  apiKey = process.env[environmentVariableName];
  if (apiKey == null) {
    throw new import_provider4.LoadAPIKeyError({
      message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter or the ${environmentVariableName} environment variable.`
    });
  }
  if (typeof apiKey !== "string") {
    throw new import_provider4.LoadAPIKeyError({
      message: `${description} API key must be a string. The value of the ${environmentVariableName} environment variable is not a string.`
    });
  }
  return apiKey;
}

// src/load-optional-setting.ts
function loadOptionalSetting({
  settingValue,
  environmentVariableName
}) {
  if (typeof settingValue === "string") {
    return settingValue;
  }
  if (settingValue != null || typeof process === "undefined") {
    return void 0;
  }
  settingValue = process.env[environmentVariableName];
  if (settingValue == null || typeof settingValue !== "string") {
    return void 0;
  }
  return settingValue;
}

// src/load-setting.ts
var import_provider5 = require("@ai-sdk/provider");
function loadSetting({
  settingValue,
  environmentVariableName,
  settingName,
  description
}) {
  if (typeof settingValue === "string") {
    return settingValue;
  }
  if (settingValue != null) {
    throw new import_provider5.LoadSettingError({
      message: `${description} setting must be a string.`
    });
  }
  if (typeof process === "undefined") {
    throw new import_provider5.LoadSettingError({
      message: `${description} setting is missing. Pass it using the '${settingName}' parameter. Environment variables is not supported in this environment.`
    });
  }
  settingValue = process.env[environmentVariableName];
  if (settingValue == null) {
    throw new import_provider5.LoadSettingError({
      message: `${description} setting is missing. Pass it using the '${settingName}' parameter or the ${environmentVariableName} environment variable.`
    });
  }
  if (typeof settingValue !== "string") {
    throw new import_provider5.LoadSettingError({
      message: `${description} setting must be a string. The value of the ${environmentVariableName} environment variable is not a string.`
    });
  }
  return settingValue;
}

// src/parse-json.ts
var import_provider8 = require("@ai-sdk/provider");

// src/secure-json-parse.ts
var suspectProtoRx = /"__proto__"\s*:/;
var suspectConstructorRx = /"constructor"\s*:/;
function _parse(text) {
  const obj = JSON.parse(text);
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (suspectProtoRx.test(text) === false && suspectConstructorRx.test(text) === false) {
    return obj;
  }
  return filter(obj);
}
function filter(obj) {
  let next = [obj];
  while (next.length) {
    const nodes = next;
    next = [];
    for (const node of nodes) {
      if (Object.prototype.hasOwnProperty.call(node, "__proto__")) {
        throw new SyntaxError("Object contains forbidden prototype property");
      }
      if (Object.prototype.hasOwnProperty.call(node, "constructor") && Object.prototype.hasOwnProperty.call(node.constructor, "prototype")) {
        throw new SyntaxError("Object contains forbidden prototype property");
      }
      for (const key in node) {
        const value = node[key];
        if (value && typeof value === "object") {
          next.push(value);
        }
      }
    }
  }
  return obj;
}
function secureJsonParse(text) {
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  try {
    return _parse(text);
  } finally {
    Error.stackTraceLimit = stackTraceLimit;
  }
}

// src/validate-types.ts
var import_provider7 = require("@ai-sdk/provider");

// src/validator.ts
var import_provider6 = require("@ai-sdk/provider");
var validatorSymbol = Symbol.for("vercel.ai.validator");
function validator(validate) {
  return { [validatorSymbol]: true, validate };
}
function isValidator(value) {
  return typeof value === "object" && value !== null && validatorSymbol in value && value[validatorSymbol] === true && "validate" in value;
}
function asValidator(value) {
  return isValidator(value) ? value : standardSchemaValidator(value);
}
function standardSchemaValidator(standardSchema) {
  return validator(async (value) => {
    const result = await standardSchema["~standard"].validate(value);
    return result.issues == null ? { success: true, value: result.value } : {
      success: false,
      error: new import_provider6.TypeValidationError({
        value,
        cause: result.issues
      })
    };
  });
}

// src/validate-types.ts
async function validateTypes({
  value,
  schema
}) {
  const result = await safeValidateTypes({ value, schema });
  if (!result.success) {
    throw import_provider7.TypeValidationError.wrap({ value, cause: result.error });
  }
  return result.value;
}
async function safeValidateTypes({
  value,
  schema
}) {
  const validator2 = asValidator(schema);
  try {
    if (validator2.validate == null) {
      return { success: true, value, rawValue: value };
    }
    const result = await validator2.validate(value);
    if (result.success) {
      return { success: true, value: result.value, rawValue: value };
    }
    return {
      success: false,
      error: import_provider7.TypeValidationError.wrap({ value, cause: result.error }),
      rawValue: value
    };
  } catch (error) {
    return {
      success: false,
      error: import_provider7.TypeValidationError.wrap({ value, cause: error }),
      rawValue: value
    };
  }
}

// src/parse-json.ts
async function parseJSON({
  text,
  schema
}) {
  try {
    const value = secureJsonParse(text);
    if (schema == null) {
      return value;
    }
    return validateTypes({ value, schema });
  } catch (error) {
    if (import_provider8.JSONParseError.isInstance(error) || import_provider8.TypeValidationError.isInstance(error)) {
      throw error;
    }
    throw new import_provider8.JSONParseError({ text, cause: error });
  }
}
async function safeParseJSON({
  text,
  schema
}) {
  try {
    const value = secureJsonParse(text);
    if (schema == null) {
      return { success: true, value, rawValue: value };
    }
    return await safeValidateTypes({ value, schema });
  } catch (error) {
    return {
      success: false,
      error: import_provider8.JSONParseError.isInstance(error) ? error : new import_provider8.JSONParseError({ text, cause: error }),
      rawValue: void 0
    };
  }
}
function isParsableJson(input) {
  try {
    secureJsonParse(input);
    return true;
  } catch (e) {
    return false;
  }
}

// src/parse-json-event-stream.ts
var import_stream = require("eventsource-parser/stream");
function parseJsonEventStream({
  stream,
  schema
}) {
  return stream.pipeThrough(new TextDecoderStream()).pipeThrough(new import_stream.EventSourceParserStream()).pipeThrough(
    new TransformStream({
      async transform({ data }, controller) {
        if (data === "[DONE]") {
          return;
        }
        controller.enqueue(await safeParseJSON({ text: data, schema }));
      }
    })
  );
}

// src/parse-provider-options.ts
var import_provider9 = require("@ai-sdk/provider");
async function parseProviderOptions({
  provider,
  providerOptions,
  schema
}) {
  if ((providerOptions == null ? void 0 : providerOptions[provider]) == null) {
    return void 0;
  }
  const parsedProviderOptions = await safeValidateTypes({
    value: providerOptions[provider],
    schema
  });
  if (!parsedProviderOptions.success) {
    throw new import_provider9.InvalidArgumentError({
      argument: "providerOptions",
      message: `invalid ${provider} provider options`,
      cause: parsedProviderOptions.error
    });
  }
  return parsedProviderOptions.value;
}

// src/post-to-api.ts
var import_provider10 = require("@ai-sdk/provider");
var getOriginalFetch2 = () => globalThis.fetch;
var postJsonToApi = async ({
  url,
  headers,
  body,
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch
}) => postToApi({
  url,
  headers: {
    "Content-Type": "application/json",
    ...headers
  },
  body: {
    content: JSON.stringify(body),
    values: body
  },
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch
});
var postFormDataToApi = async ({
  url,
  headers,
  formData,
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch
}) => postToApi({
  url,
  headers,
  body: {
    content: formData,
    values: Object.fromEntries(formData.entries())
  },
  failedResponseHandler,
  successfulResponseHandler,
  abortSignal,
  fetch
});
var postToApi = async ({
  url,
  headers = {},
  body,
  successfulResponseHandler,
  failedResponseHandler,
  abortSignal,
  fetch = getOriginalFetch2()
}) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: removeUndefinedEntries(headers),
      body: body.content,
      signal: abortSignal
    });
    const responseHeaders = extractResponseHeaders(response);
    if (!response.ok) {
      let errorInformation;
      try {
        errorInformation = await failedResponseHandler({
          response,
          url,
          requestBodyValues: body.values
        });
      } catch (error) {
        if (isAbortError(error) || import_provider10.APICallError.isInstance(error)) {
          throw error;
        }
        throw new import_provider10.APICallError({
          message: "Failed to process error response",
          cause: error,
          statusCode: response.status,
          url,
          responseHeaders,
          requestBodyValues: body.values
        });
      }
      throw errorInformation.value;
    }
    try {
      return await successfulResponseHandler({
        response,
        url,
        requestBodyValues: body.values
      });
    } catch (error) {
      if (error instanceof Error) {
        if (isAbortError(error) || import_provider10.APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new import_provider10.APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: body.values
      });
    }
  } catch (error) {
    throw handleFetchError({ error, url, requestBodyValues: body.values });
  }
};

// src/types/tool.ts
function tool(tool2) {
  return tool2;
}
function dynamicTool(tool2) {
  return { ...tool2, type: "dynamic" };
}

// src/provider-defined-tool-factory.ts
function createProviderDefinedToolFactory({
  id,
  name,
  inputSchema
}) {
  return ({
    execute,
    outputSchema,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }) => tool({
    type: "provider-defined",
    id,
    name,
    args,
    inputSchema,
    outputSchema,
    execute,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable
  });
}
function createProviderDefinedToolFactoryWithOutputSchema({
  id,
  name,
  inputSchema,
  outputSchema
}) {
  return ({
    execute,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }) => tool({
    type: "provider-defined",
    id,
    name,
    args,
    inputSchema,
    outputSchema,
    execute,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable
  });
}

// src/resolve.ts
async function resolve(value) {
  if (typeof value === "function") {
    value = value();
  }
  return Promise.resolve(value);
}

// src/response-handler.ts
var import_provider11 = require("@ai-sdk/provider");
var createJsonErrorResponseHandler = ({
  errorSchema,
  errorToMessage,
  isRetryable
}) => async ({ response, url, requestBodyValues }) => {
  const responseBody = await response.text();
  const responseHeaders = extractResponseHeaders(response);
  if (responseBody.trim() === "") {
    return {
      responseHeaders,
      value: new import_provider11.APICallError({
        message: response.statusText,
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        isRetryable: isRetryable == null ? void 0 : isRetryable(response)
      })
    };
  }
  try {
    const parsedError = await parseJSON({
      text: responseBody,
      schema: errorSchema
    });
    return {
      responseHeaders,
      value: new import_provider11.APICallError({
        message: errorToMessage(parsedError),
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        data: parsedError,
        isRetryable: isRetryable == null ? void 0 : isRetryable(response, parsedError)
      })
    };
  } catch (parseError) {
    return {
      responseHeaders,
      value: new import_provider11.APICallError({
        message: response.statusText,
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody,
        isRetryable: isRetryable == null ? void 0 : isRetryable(response)
      })
    };
  }
};
var createEventSourceResponseHandler = (chunkSchema) => async ({ response }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (response.body == null) {
    throw new import_provider11.EmptyResponseBodyError({});
  }
  return {
    responseHeaders,
    value: parseJsonEventStream({
      stream: response.body,
      schema: chunkSchema
    })
  };
};
var createJsonStreamResponseHandler = (chunkSchema) => async ({ response }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (response.body == null) {
    throw new import_provider11.EmptyResponseBodyError({});
  }
  let buffer = "";
  return {
    responseHeaders,
    value: response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        async transform(chunkText, controller) {
          if (chunkText.endsWith("\n")) {
            controller.enqueue(
              await safeParseJSON({
                text: buffer + chunkText,
                schema: chunkSchema
              })
            );
            buffer = "";
          } else {
            buffer += chunkText;
          }
        }
      })
    )
  };
};
var createJsonResponseHandler = (responseSchema) => async ({ response, url, requestBodyValues }) => {
  const responseBody = await response.text();
  const parsedResult = await safeParseJSON({
    text: responseBody,
    schema: responseSchema
  });
  const responseHeaders = extractResponseHeaders(response);
  if (!parsedResult.success) {
    throw new import_provider11.APICallError({
      message: "Invalid JSON response",
      cause: parsedResult.error,
      statusCode: response.status,
      responseHeaders,
      responseBody,
      url,
      requestBodyValues
    });
  }
  return {
    responseHeaders,
    value: parsedResult.value,
    rawValue: parsedResult.rawValue
  };
};
var createBinaryResponseHandler = () => async ({ response, url, requestBodyValues }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (!response.body) {
    throw new import_provider11.APICallError({
      message: "Response body is empty",
      url,
      requestBodyValues,
      statusCode: response.status,
      responseHeaders,
      responseBody: void 0
    });
  }
  try {
    const buffer = await response.arrayBuffer();
    return {
      responseHeaders,
      value: new Uint8Array(buffer)
    };
  } catch (error) {
    throw new import_provider11.APICallError({
      message: "Failed to read response as array buffer",
      url,
      requestBodyValues,
      statusCode: response.status,
      responseHeaders,
      responseBody: void 0,
      cause: error
    });
  }
};
var createStatusCodeErrorResponseHandler = () => async ({ response, url, requestBodyValues }) => {
  const responseHeaders = extractResponseHeaders(response);
  const responseBody = await response.text();
  return {
    responseHeaders,
    value: new import_provider11.APICallError({
      message: response.statusText,
      url,
      requestBodyValues,
      statusCode: response.status,
      responseHeaders,
      responseBody
    })
  };
};

// src/zod-schema.ts
var z4 = __toESM(require("zod/v4"));
var import_zod_to_json_schema = __toESM(require("zod-to-json-schema"));
function zod3Schema(zodSchema2, options) {
  var _a;
  const useReferences = (_a = options == null ? void 0 : options.useReferences) != null ? _a : false;
  return jsonSchema(
    (0, import_zod_to_json_schema.default)(zodSchema2, {
      $refStrategy: useReferences ? "root" : "none",
      target: "jsonSchema7"
      // note: openai mode breaks various gemini conversions
    }),
    {
      validate: async (value) => {
        const result = await zodSchema2.safeParseAsync(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      }
    }
  );
}
function zod4Schema(zodSchema2, options) {
  var _a;
  const useReferences = (_a = options == null ? void 0 : options.useReferences) != null ? _a : false;
  const z4JSONSchema = z4.toJSONSchema(zodSchema2, {
    target: "draft-7",
    io: "output",
    reused: useReferences ? "ref" : "inline"
  });
  return jsonSchema(z4JSONSchema, {
    validate: async (value) => {
      const result = await z4.safeParseAsync(zodSchema2, value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    }
  });
}
function isZod4Schema(zodSchema2) {
  return "_zod" in zodSchema2;
}
function zodSchema(zodSchema2, options) {
  if (isZod4Schema(zodSchema2)) {
    return zod4Schema(zodSchema2, options);
  } else {
    return zod3Schema(zodSchema2, options);
  }
}

// src/schema.ts
var schemaSymbol = Symbol.for("vercel.ai.schema");
function jsonSchema(jsonSchema2, {
  validate
} = {}) {
  return {
    [schemaSymbol]: true,
    _type: void 0,
    // should never be used directly
    [validatorSymbol]: true,
    jsonSchema: jsonSchema2,
    validate
  };
}
function isSchema(value) {
  return typeof value === "object" && value !== null && schemaSymbol in value && value[schemaSymbol] === true && "jsonSchema" in value && "validate" in value;
}
function asSchema(schema) {
  return schema == null ? jsonSchema({
    properties: {},
    additionalProperties: false
  }) : isSchema(schema) ? schema : zodSchema(schema);
}

// src/uint8-utils.ts
var { btoa, atob } = globalThis;
function convertBase64ToUint8Array(base64String) {
  const base64Url = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const latin1string = atob(base64Url);
  return Uint8Array.from(latin1string, (byte) => byte.codePointAt(0));
}
function convertUint8ArrayToBase64(array) {
  let latin1string = "";
  for (let i = 0; i < array.length; i++) {
    latin1string += String.fromCodePoint(array[i]);
  }
  return btoa(latin1string);
}
function convertToBase64(value) {
  return value instanceof Uint8Array ? convertUint8ArrayToBase64(value) : value;
}

// src/without-trailing-slash.ts
function withoutTrailingSlash(url) {
  return url == null ? void 0 : url.replace(/\/$/, "");
}

// src/is-async-iterable.ts
function isAsyncIterable(obj) {
  return obj != null && typeof obj[Symbol.asyncIterator] === "function";
}

// src/types/execute-tool.ts
async function* executeTool({
  execute,
  input,
  options
}) {
  const result = execute(input, options);
  if (isAsyncIterable(result)) {
    let lastOutput;
    for await (const output of result) {
      lastOutput = output;
      yield { type: "preliminary", output };
    }
    yield { type: "final", output: lastOutput };
  } else {
    yield { type: "final", output: await result };
  }
}

// src/index.ts
__reExport(src_exports, require("@standard-schema/spec"), module.exports);
var import_stream2 = require("eventsource-parser/stream");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EventSourceParserStream,
  asSchema,
  asValidator,
  combineHeaders,
  convertAsyncIteratorToReadableStream,
  convertBase64ToUint8Array,
  convertToBase64,
  convertUint8ArrayToBase64,
  createBinaryResponseHandler,
  createEventSourceResponseHandler,
  createIdGenerator,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  createJsonStreamResponseHandler,
  createProviderDefinedToolFactory,
  createProviderDefinedToolFactoryWithOutputSchema,
  createStatusCodeErrorResponseHandler,
  delay,
  dynamicTool,
  executeTool,
  extractResponseHeaders,
  generateId,
  getErrorMessage,
  getFromApi,
  isAbortError,
  isParsableJson,
  isUrlSupported,
  isValidator,
  jsonSchema,
  loadApiKey,
  loadOptionalSetting,
  loadSetting,
  parseJSON,
  parseJsonEventStream,
  parseProviderOptions,
  postFormDataToApi,
  postJsonToApi,
  postToApi,
  removeUndefinedEntries,
  resolve,
  safeParseJSON,
  safeValidateTypes,
  standardSchemaValidator,
  tool,
  validateTypes,
  validator,
  validatorSymbol,
  withoutTrailingSlash,
  zodSchema,
  ...require("@standard-schema/spec")
});
//# sourceMappingURL=index.js.map