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
  asValidator: () => asValidator,
  combineHeaders: () => combineHeaders,
  convertAsyncIteratorToReadableStream: () => convertAsyncIteratorToReadableStream,
  convertBase64ToUint8Array: () => convertBase64ToUint8Array,
  convertUint8ArrayToBase64: () => convertUint8ArrayToBase64,
  createBinaryResponseHandler: () => createBinaryResponseHandler,
  createEventSourceParserStream: () => createEventSourceParserStream,
  createEventSourceResponseHandler: () => createEventSourceResponseHandler,
  createIdGenerator: () => createIdGenerator,
  createJsonErrorResponseHandler: () => createJsonErrorResponseHandler,
  createJsonResponseHandler: () => createJsonResponseHandler,
  createJsonStreamResponseHandler: () => createJsonStreamResponseHandler,
  createStatusCodeErrorResponseHandler: () => createStatusCodeErrorResponseHandler,
  delay: () => delay,
  extractResponseHeaders: () => extractResponseHeaders,
  generateId: () => generateId,
  getErrorMessage: () => getErrorMessage,
  getFromApi: () => getFromApi,
  isAbortError: () => isAbortError,
  isParsableJson: () => isParsableJson,
  isValidator: () => isValidator,
  loadApiKey: () => loadApiKey,
  loadOptionalSetting: () => loadOptionalSetting,
  loadSetting: () => loadSetting,
  parseJSON: () => parseJSON,
  parseProviderOptions: () => parseProviderOptions,
  postFormDataToApi: () => postFormDataToApi,
  postJsonToApi: () => postJsonToApi,
  postToApi: () => postToApi,
  removeUndefinedEntries: () => removeUndefinedEntries,
  resolve: () => resolve,
  safeParseJSON: () => safeParseJSON,
  safeValidateTypes: () => safeValidateTypes,
  validateTypes: () => validateTypes,
  validator: () => validator,
  validatorSymbol: () => validatorSymbol,
  withoutTrailingSlash: () => withoutTrailingSlash,
  zodValidator: () => zodValidator
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
async function delay(delayInMs) {
  return delayInMs == null ? Promise.resolve() : new Promise((resolve2) => setTimeout(resolve2, delayInMs));
}

// src/event-source-parser-stream.ts
function createEventSourceParserStream() {
  let buffer = "";
  let event = void 0;
  let data = [];
  let lastEventId = void 0;
  let retry = void 0;
  function parseLine(line, controller) {
    if (line === "") {
      dispatchEvent(controller);
      return;
    }
    if (line.startsWith(":")) {
      return;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      handleField(line, "");
      return;
    }
    const field = line.slice(0, colonIndex);
    const valueStart = colonIndex + 1;
    const value = valueStart < line.length && line[valueStart] === " " ? line.slice(valueStart + 1) : line.slice(valueStart);
    handleField(field, value);
  }
  function dispatchEvent(controller) {
    if (data.length > 0) {
      controller.enqueue({
        event,
        data: data.join("\n"),
        id: lastEventId,
        retry
      });
      data = [];
      event = void 0;
      retry = void 0;
    }
  }
  function handleField(field, value) {
    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        data.push(value);
        break;
      case "id":
        lastEventId = value;
        break;
      case "retry":
        const parsedRetry = parseInt(value, 10);
        if (!isNaN(parsedRetry)) {
          retry = parsedRetry;
        }
        break;
    }
  }
  return new TransformStream({
    transform(chunk, controller) {
      const { lines, incompleteLine } = splitLines(buffer, chunk);
      buffer = incompleteLine;
      for (let i = 0; i < lines.length; i++) {
        parseLine(lines[i], controller);
      }
    },
    flush(controller) {
      parseLine(buffer, controller);
      dispatchEvent(controller);
    }
  });
}
function splitLines(buffer, chunk) {
  const lines = [];
  let currentLine = buffer;
  for (let i = 0; i < chunk.length; ) {
    const char = chunk[i++];
    if (char === "\n") {
      lines.push(currentLine);
      currentLine = "";
    } else if (char === "\r") {
      lines.push(currentLine);
      currentLine = "";
      if (chunk[i] === "\n") {
        i++;
      }
    } else {
      currentLine += char;
    }
  }
  return { lines, incompleteLine: currentLine };
}

// src/extract-response-headers.ts
function extractResponseHeaders(response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

// src/generate-id.ts
var import_provider = require("@ai-sdk/provider");
var import_non_secure = require("nanoid/non-secure");
var createIdGenerator = ({
  prefix,
  size: defaultSize = 16,
  alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  separator = "-"
} = {}) => {
  const generator = (0, import_non_secure.customAlphabet)(alphabet, defaultSize);
  if (prefix == null) {
    return generator;
  }
  if (alphabet.includes(separator)) {
    throw new import_provider.InvalidArgumentError({
      argument: "separator",
      message: `The separator "${separator}" must not be part of the alphabet "${alphabet}".`
    });
  }
  return (size) => `${prefix}${separator}${generator(size)}`;
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
var import_provider2 = require("@ai-sdk/provider");

// src/remove-undefined-entries.ts
function removeUndefinedEntries(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([_key, value]) => value != null)
  );
}

// src/is-abort-error.ts
function isAbortError(error) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
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
        if (isAbortError(error) || import_provider2.APICallError.isInstance(error)) {
          throw error;
        }
        throw new import_provider2.APICallError({
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
        if (isAbortError(error) || import_provider2.APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new import_provider2.APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: {}
      });
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof TypeError && error.message === "fetch failed") {
      const cause = error.cause;
      if (cause != null) {
        throw new import_provider2.APICallError({
          message: `Cannot connect to API: ${cause.message}`,
          cause,
          url,
          isRetryable: true,
          requestBodyValues: {}
        });
      }
    }
    throw error;
  }
};

// src/load-api-key.ts
var import_provider3 = require("@ai-sdk/provider");
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
    throw new import_provider3.LoadAPIKeyError({
      message: `${description} API key must be a string.`
    });
  }
  if (typeof process === "undefined") {
    throw new import_provider3.LoadAPIKeyError({
      message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter. Environment variables is not supported in this environment.`
    });
  }
  apiKey = process.env[environmentVariableName];
  if (apiKey == null) {
    throw new import_provider3.LoadAPIKeyError({
      message: `${description} API key is missing. Pass it using the '${apiKeyParameterName}' parameter or the ${environmentVariableName} environment variable.`
    });
  }
  if (typeof apiKey !== "string") {
    throw new import_provider3.LoadAPIKeyError({
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
var import_provider4 = require("@ai-sdk/provider");
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
    throw new import_provider4.LoadSettingError({
      message: `${description} setting must be a string.`
    });
  }
  if (typeof process === "undefined") {
    throw new import_provider4.LoadSettingError({
      message: `${description} setting is missing. Pass it using the '${settingName}' parameter. Environment variables is not supported in this environment.`
    });
  }
  settingValue = process.env[environmentVariableName];
  if (settingValue == null) {
    throw new import_provider4.LoadSettingError({
      message: `${description} setting is missing. Pass it using the '${settingName}' parameter or the ${environmentVariableName} environment variable.`
    });
  }
  if (typeof settingValue !== "string") {
    throw new import_provider4.LoadSettingError({
      message: `${description} setting must be a string. The value of the ${environmentVariableName} environment variable is not a string.`
    });
  }
  return settingValue;
}

// src/parse-json.ts
var import_provider6 = require("@ai-sdk/provider");
var import_secure_json_parse = __toESM(require("secure-json-parse"));

// src/validate-types.ts
var import_provider5 = require("@ai-sdk/provider");

// src/validator.ts
var validatorSymbol = Symbol.for("vercel.ai.validator");
function validator(validate) {
  return { [validatorSymbol]: true, validate };
}
function isValidator(value) {
  return typeof value === "object" && value !== null && validatorSymbol in value && value[validatorSymbol] === true && "validate" in value;
}
function asValidator(value) {
  return isValidator(value) ? value : zodValidator(value);
}
function zodValidator(zodSchema) {
  return validator((value) => {
    const result = zodSchema.safeParse(value);
    return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
  });
}

// src/validate-types.ts
function validateTypes({
  value,
  schema: inputSchema
}) {
  const result = safeValidateTypes({ value, schema: inputSchema });
  if (!result.success) {
    throw import_provider5.TypeValidationError.wrap({ value, cause: result.error });
  }
  return result.value;
}
function safeValidateTypes({
  value,
  schema
}) {
  const validator2 = asValidator(schema);
  try {
    if (validator2.validate == null) {
      return { success: true, value };
    }
    const result = validator2.validate(value);
    if (result.success) {
      return result;
    }
    return {
      success: false,
      error: import_provider5.TypeValidationError.wrap({ value, cause: result.error })
    };
  } catch (error) {
    return {
      success: false,
      error: import_provider5.TypeValidationError.wrap({ value, cause: error })
    };
  }
}

// src/parse-json.ts
function parseJSON({
  text,
  schema
}) {
  try {
    const value = import_secure_json_parse.default.parse(text);
    if (schema == null) {
      return value;
    }
    return validateTypes({ value, schema });
  } catch (error) {
    if (import_provider6.JSONParseError.isInstance(error) || import_provider6.TypeValidationError.isInstance(error)) {
      throw error;
    }
    throw new import_provider6.JSONParseError({ text, cause: error });
  }
}
function safeParseJSON({
  text,
  schema
}) {
  try {
    const value = import_secure_json_parse.default.parse(text);
    if (schema == null) {
      return { success: true, value, rawValue: value };
    }
    const validationResult = safeValidateTypes({ value, schema });
    return validationResult.success ? { ...validationResult, rawValue: value } : validationResult;
  } catch (error) {
    return {
      success: false,
      error: import_provider6.JSONParseError.isInstance(error) ? error : new import_provider6.JSONParseError({ text, cause: error })
    };
  }
}
function isParsableJson(input) {
  try {
    import_secure_json_parse.default.parse(input);
    return true;
  } catch (e) {
    return false;
  }
}

// src/parse-provider-options.ts
var import_provider7 = require("@ai-sdk/provider");
function parseProviderOptions({
  provider,
  providerOptions,
  schema
}) {
  if ((providerOptions == null ? void 0 : providerOptions[provider]) == null) {
    return void 0;
  }
  const parsedProviderOptions = safeValidateTypes({
    value: providerOptions[provider],
    schema
  });
  if (!parsedProviderOptions.success) {
    throw new import_provider7.InvalidArgumentError({
      argument: "providerOptions",
      message: `invalid ${provider} provider options`,
      cause: parsedProviderOptions.error
    });
  }
  return parsedProviderOptions.value;
}

// src/post-to-api.ts
var import_provider8 = require("@ai-sdk/provider");
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
        if (isAbortError(error) || import_provider8.APICallError.isInstance(error)) {
          throw error;
        }
        throw new import_provider8.APICallError({
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
        if (isAbortError(error) || import_provider8.APICallError.isInstance(error)) {
          throw error;
        }
      }
      throw new import_provider8.APICallError({
        message: "Failed to process successful response",
        cause: error,
        statusCode: response.status,
        url,
        responseHeaders,
        requestBodyValues: body.values
      });
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof TypeError && error.message === "fetch failed") {
      const cause = error.cause;
      if (cause != null) {
        throw new import_provider8.APICallError({
          message: `Cannot connect to API: ${cause.message}`,
          cause,
          url,
          requestBodyValues: body.values,
          isRetryable: true
          // retry when network error
        });
      }
    }
    throw error;
  }
};

// src/resolve.ts
async function resolve(value) {
  if (typeof value === "function") {
    value = value();
  }
  return Promise.resolve(value);
}

// src/response-handler.ts
var import_provider9 = require("@ai-sdk/provider");
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
      value: new import_provider9.APICallError({
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
    const parsedError = parseJSON({
      text: responseBody,
      schema: errorSchema
    });
    return {
      responseHeaders,
      value: new import_provider9.APICallError({
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
      value: new import_provider9.APICallError({
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
    throw new import_provider9.EmptyResponseBodyError({});
  }
  return {
    responseHeaders,
    value: response.body.pipeThrough(new TextDecoderStream()).pipeThrough(createEventSourceParserStream()).pipeThrough(
      new TransformStream({
        transform({ data }, controller) {
          if (data === "[DONE]") {
            return;
          }
          controller.enqueue(
            safeParseJSON({
              text: data,
              schema: chunkSchema
            })
          );
        }
      })
    )
  };
};
var createJsonStreamResponseHandler = (chunkSchema) => async ({ response }) => {
  const responseHeaders = extractResponseHeaders(response);
  if (response.body == null) {
    throw new import_provider9.EmptyResponseBodyError({});
  }
  let buffer = "";
  return {
    responseHeaders,
    value: response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
      new TransformStream({
        transform(chunkText, controller) {
          if (chunkText.endsWith("\n")) {
            controller.enqueue(
              safeParseJSON({
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
  const parsedResult = safeParseJSON({
    text: responseBody,
    schema: responseSchema
  });
  const responseHeaders = extractResponseHeaders(response);
  if (!parsedResult.success) {
    throw new import_provider9.APICallError({
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
    throw new import_provider9.APICallError({
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
    throw new import_provider9.APICallError({
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
    value: new import_provider9.APICallError({
      message: response.statusText,
      url,
      requestBodyValues,
      statusCode: response.status,
      responseHeaders,
      responseBody
    })
  };
};

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

// src/without-trailing-slash.ts
function withoutTrailingSlash(url) {
  return url == null ? void 0 : url.replace(/\/$/, "");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  asValidator,
  combineHeaders,
  convertAsyncIteratorToReadableStream,
  convertBase64ToUint8Array,
  convertUint8ArrayToBase64,
  createBinaryResponseHandler,
  createEventSourceParserStream,
  createEventSourceResponseHandler,
  createIdGenerator,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  createJsonStreamResponseHandler,
  createStatusCodeErrorResponseHandler,
  delay,
  extractResponseHeaders,
  generateId,
  getErrorMessage,
  getFromApi,
  isAbortError,
  isParsableJson,
  isValidator,
  loadApiKey,
  loadOptionalSetting,
  loadSetting,
  parseJSON,
  parseProviderOptions,
  postFormDataToApi,
  postJsonToApi,
  postToApi,
  removeUndefinedEntries,
  resolve,
  safeParseJSON,
  safeValidateTypes,
  validateTypes,
  validator,
  validatorSymbol,
  withoutTrailingSlash,
  zodValidator
});
//# sourceMappingURL=index.js.map