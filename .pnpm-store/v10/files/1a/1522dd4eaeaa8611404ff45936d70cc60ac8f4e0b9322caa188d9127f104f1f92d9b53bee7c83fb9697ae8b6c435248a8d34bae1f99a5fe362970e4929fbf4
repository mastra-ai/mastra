// rsc/ai-state.tsx
import * as jsondiffpatch from "jsondiffpatch";
import { AsyncLocalStorage } from "async_hooks";

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

// util/is-function.ts
var isFunction = (value) => typeof value === "function";

// rsc/ai-state.tsx
var asyncAIStateStorage = new AsyncLocalStorage();
function getAIStateStoreOrThrow(message) {
  const store = asyncAIStateStorage.getStore();
  if (!store) {
    throw new Error(message);
  }
  return store;
}
function withAIState({ state, options }, fn) {
  return asyncAIStateStorage.run(
    {
      currentState: JSON.parse(JSON.stringify(state)),
      // deep clone object
      originalState: state,
      sealed: false,
      options
    },
    fn
  );
}
function getAIStateDeltaPromise() {
  const store = getAIStateStoreOrThrow("Internal error occurred.");
  return store.mutationDeltaPromise;
}
function sealMutableAIState() {
  const store = getAIStateStoreOrThrow("Internal error occurred.");
  store.sealed = true;
}
function getAIState(...args) {
  const store = getAIStateStoreOrThrow(
    "`getAIState` must be called within an AI Action."
  );
  if (args.length > 0) {
    const key = args[0];
    if (typeof store.currentState !== "object") {
      throw new Error(
        `You can't get the "${String(
          key
        )}" field from the AI state because it's not an object.`
      );
    }
    return store.currentState[key];
  }
  return store.currentState;
}
function getMutableAIState(...args) {
  const store = getAIStateStoreOrThrow(
    "`getMutableAIState` must be called within an AI Action."
  );
  if (store.sealed) {
    throw new Error(
      "`getMutableAIState` must be called before returning from an AI Action. Please move it to the top level of the Action's function body."
    );
  }
  if (!store.mutationDeltaPromise) {
    const { promise, resolve } = createResolvablePromise();
    store.mutationDeltaPromise = promise;
    store.mutationDeltaResolve = resolve;
  }
  function doUpdate(newState, done) {
    var _a9, _b;
    if (args.length > 0) {
      if (typeof store.currentState !== "object") {
        const key = args[0];
        throw new Error(
          `You can't modify the "${String(
            key
          )}" field of the AI state because it's not an object.`
        );
      }
    }
    if (isFunction(newState)) {
      if (args.length > 0) {
        store.currentState[args[0]] = newState(store.currentState[args[0]]);
      } else {
        store.currentState = newState(store.currentState);
      }
    } else {
      if (args.length > 0) {
        store.currentState[args[0]] = newState;
      } else {
        store.currentState = newState;
      }
    }
    (_b = (_a9 = store.options).onSetAIState) == null ? void 0 : _b.call(_a9, {
      key: args.length > 0 ? args[0] : void 0,
      state: store.currentState,
      done
    });
  }
  const mutableState = {
    get: () => {
      if (args.length > 0) {
        const key = args[0];
        if (typeof store.currentState !== "object") {
          throw new Error(
            `You can't get the "${String(
              key
            )}" field from the AI state because it's not an object.`
          );
        }
        return store.currentState[key];
      }
      return store.currentState;
    },
    update: function update(newAIState) {
      doUpdate(newAIState, false);
    },
    done: function done(...doneArgs) {
      if (doneArgs.length > 0) {
        doUpdate(doneArgs[0], true);
      }
      const delta = jsondiffpatch.diff(store.originalState, store.currentState);
      store.mutationDeltaResolve(delta);
    }
  };
  return mutableState;
}

// rsc/provider.tsx
import * as React from "react";
import { InternalAIProvider } from "./rsc-shared.mjs";
import { jsx } from "react/jsx-runtime";
async function innerAction({
  action,
  options
}, state, ...args) {
  "use server";
  return await withAIState(
    {
      state,
      options
    },
    async () => {
      const result = await action(...args);
      sealMutableAIState();
      return [getAIStateDeltaPromise(), result];
    }
  );
}
function wrapAction(action, options) {
  return innerAction.bind(null, { action, options });
}
function createAI({
  actions,
  initialAIState,
  initialUIState,
  onSetAIState,
  onGetUIState
}) {
  const wrappedActions = {};
  for (const name9 in actions) {
    wrappedActions[name9] = wrapAction(actions[name9], {
      onSetAIState
    });
  }
  const wrappedSyncUIState = onGetUIState ? wrapAction(onGetUIState, {}) : void 0;
  const AI = async (props) => {
    var _a9, _b;
    if ("useState" in React) {
      throw new Error(
        "This component can only be used inside Server Components."
      );
    }
    let uiState = (_a9 = props.initialUIState) != null ? _a9 : initialUIState;
    let aiState = (_b = props.initialAIState) != null ? _b : initialAIState;
    let aiStateDelta = void 0;
    if (wrappedSyncUIState) {
      const [newAIStateDelta, newUIState] = await wrappedSyncUIState(aiState);
      if (newUIState !== void 0) {
        aiStateDelta = newAIStateDelta;
        uiState = newUIState;
      }
    }
    return /* @__PURE__ */ jsx(
      InternalAIProvider,
      {
        wrappedActions,
        wrappedSyncUIState,
        initialUIState: uiState,
        initialAIState: aiState,
        initialAIStatePatch: aiStateDelta,
        children: props.children
      }
    );
  };
  return AI;
}

// rsc/stream-ui/stream-ui.tsx
import { safeParseJSON } from "@ai-sdk/provider-utils";

// util/download-error.ts
import { AISDKError } from "@ai-sdk/provider";
var name = "AI_DownloadError";
var marker = `vercel.ai.error.${name}`;
var symbol = Symbol.for(marker);
var _a;
var DownloadError = class extends AISDKError {
  constructor({
    url,
    statusCode,
    statusText,
    cause,
    message = cause == null ? `Failed to download ${url}: ${statusCode} ${statusText}` : `Failed to download ${url}: ${cause}`
  }) {
    super({ name, message, cause });
    this[_a] = true;
    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker);
  }
};
_a = symbol;

// util/download.ts
async function download({ url }) {
  var _a9;
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
      mimeType: (_a9 = response.headers.get("content-type")) != null ? _a9 : void 0
    };
  } catch (error) {
    if (DownloadError.isInstance(error)) {
      throw error;
    }
    throw new DownloadError({ url: urlText, cause: error });
  }
}

// core/util/detect-mimetype.ts
import { convertBase64ToUint8Array } from "@ai-sdk/provider-utils";
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
var stripID3 = (data) => {
  const bytes = typeof data === "string" ? convertBase64ToUint8Array(data) : data;
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

// core/prompt/data-content.ts
import {
  convertBase64ToUint8Array as convertBase64ToUint8Array2,
  convertUint8ArrayToBase64
} from "@ai-sdk/provider-utils";

// core/prompt/invalid-data-content-error.ts
import { AISDKError as AISDKError2 } from "@ai-sdk/provider";
var name2 = "AI_InvalidDataContentError";
var marker2 = `vercel.ai.error.${name2}`;
var symbol2 = Symbol.for(marker2);
var _a2;
var InvalidDataContentError = class extends AISDKError2 {
  constructor({
    content,
    cause,
    message = `Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got ${typeof content}.`
  }) {
    super({ name: name2, message, cause });
    this[_a2] = true;
    this.content = content;
  }
  static isInstance(error) {
    return AISDKError2.hasMarker(error, marker2);
  }
};
_a2 = symbol2;

// core/prompt/data-content.ts
import { z } from "zod";
var dataContentSchema = z.union([
  z.string(),
  z.instanceof(Uint8Array),
  z.instanceof(ArrayBuffer),
  z.custom(
    // Buffer might not be available in some environments such as CloudFlare:
    (value) => {
      var _a9, _b;
      return (_b = (_a9 = globalThis.Buffer) == null ? void 0 : _a9.isBuffer(value)) != null ? _b : false;
    },
    { message: "Must be a Buffer" }
  )
]);
function convertDataContentToBase64String(content) {
  if (typeof content === "string") {
    return content;
  }
  if (content instanceof ArrayBuffer) {
    return convertUint8ArrayToBase64(new Uint8Array(content));
  }
  return convertUint8ArrayToBase64(content);
}
function convertDataContentToUint8Array(content) {
  if (content instanceof Uint8Array) {
    return content;
  }
  if (typeof content === "string") {
    try {
      return convertBase64ToUint8Array2(content);
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
import { AISDKError as AISDKError3 } from "@ai-sdk/provider";
var name3 = "AI_InvalidMessageRoleError";
var marker3 = `vercel.ai.error.${name3}`;
var symbol3 = Symbol.for(marker3);
var _a3;
var InvalidMessageRoleError = class extends AISDKError3 {
  constructor({
    role,
    message = `Invalid message role: '${role}'. Must be one of: "system", "user", "assistant", "tool".`
  }) {
    super({ name: name3, message });
    this[_a3] = true;
    this.role = role;
  }
  static isInstance(error) {
    return AISDKError3.hasMarker(error, marker3);
  }
};
_a3 = symbol3;

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
  var _a9, _b, _c, _d, _e, _f;
  const role = message.role;
  switch (role) {
    case "system": {
      return {
        role: "system",
        content: message.content,
        providerMetadata: (_a9 = message.providerOptions) != null ? _a9 : message.experimental_providerMetadata
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
          var _a10;
          const providerOptions = (_a10 = part.providerOptions) != null ? _a10 : part.experimental_providerMetadata;
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
          var _a10;
          return {
            type: "tool-result",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            result: part.result,
            content: part.experimental_content,
            isError: part.isError,
            providerMetadata: (_a10 = part.providerOptions) != null ? _a10 : part.experimental_providerMetadata
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
  var _a9, _b, _c, _d;
  if (part.type === "text") {
    return {
      type: "text",
      text: part.text,
      providerMetadata: (_a9 = part.providerOptions) != null ? _a9 : part.experimental_providerMetadata
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

// errors/invalid-argument-error.ts
import { AISDKError as AISDKError4 } from "@ai-sdk/provider";
var name4 = "AI_InvalidArgumentError";
var marker4 = `vercel.ai.error.${name4}`;
var symbol4 = Symbol.for(marker4);
var _a4;
var InvalidArgumentError = class extends AISDKError4 {
  constructor({
    parameter,
    value,
    message
  }) {
    super({
      name: name4,
      message: `Invalid argument for parameter ${parameter}: ${message}`
    });
    this[_a4] = true;
    this.parameter = parameter;
    this.value = value;
  }
  static isInstance(error) {
    return AISDKError4.hasMarker(error, marker4);
  }
};
_a4 = symbol4;

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

// util/retry-with-exponential-backoff.ts
import { APICallError } from "@ai-sdk/provider";
import { delay, getErrorMessage, isAbortError } from "@ai-sdk/provider-utils";

// util/retry-error.ts
import { AISDKError as AISDKError5 } from "@ai-sdk/provider";
var name5 = "AI_RetryError";
var marker5 = `vercel.ai.error.${name5}`;
var symbol5 = Symbol.for(marker5);
var _a5;
var RetryError = class extends AISDKError5 {
  constructor({
    message,
    reason,
    errors
  }) {
    super({ name: name5, message });
    this[_a5] = true;
    this.reason = reason;
    this.errors = errors;
    this.lastError = errors[errors.length - 1];
  }
  static isInstance(error) {
    return AISDKError5.hasMarker(error, marker5);
  }
};
_a5 = symbol5;

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

// core/prompt/prepare-tools-and-tool-choice.ts
import { asSchema } from "@ai-sdk/ui-utils";

// core/util/is-non-empty-object.ts
function isNonEmptyObject(object) {
  return object != null && Object.keys(object).length > 0;
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
    ([name9]) => activeTools.includes(name9)
  ) : Object.entries(tools);
  return {
    tools: filteredTools.map(([name9, tool]) => {
      const toolType = tool.type;
      switch (toolType) {
        case void 0:
        case "function":
          return {
            type: "function",
            name: name9,
            description: tool.description,
            parameters: asSchema(tool.parameters).jsonSchema
          };
        case "provider-defined":
          return {
            type: "provider-defined",
            name: name9,
            id: tool.id,
            args: tool.args
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

// core/prompt/standardize-prompt.ts
import { InvalidPromptError } from "@ai-sdk/provider";
import { safeValidateTypes } from "@ai-sdk/provider-utils";
import { z as z7 } from "zod";

// core/prompt/attachments-to-parts.ts
function attachmentsToParts(attachments) {
  var _a9, _b, _c;
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
        if ((_a9 = attachment.contentType) == null ? void 0 : _a9.startsWith("image/")) {
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
import { AISDKError as AISDKError6 } from "@ai-sdk/provider";
var name6 = "AI_MessageConversionError";
var marker6 = `vercel.ai.error.${name6}`;
var symbol6 = Symbol.for(marker6);
var _a6;
var MessageConversionError = class extends AISDKError6 {
  constructor({
    originalMessage,
    message
  }) {
    super({ name: name6, message });
    this[_a6] = true;
    this.originalMessage = originalMessage;
  }
  static isInstance(error) {
    return AISDKError6.hasMarker(error, marker6);
  }
};
_a6 = symbol6;

// core/prompt/convert-to-core-messages.ts
function convertToCoreMessages(messages, options) {
  var _a9, _b;
  const tools = (_a9 = options == null ? void 0 : options.tools) != null ? _a9 : {};
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
                    const tool = tools[toolName];
                    return (tool == null ? void 0 : tool.experimental_toToolResultContent) != null ? {
                      type: "tool-result",
                      toolCallId,
                      toolName,
                      result: tool.experimental_toToolResultContent(result),
                      experimental_content: tool.experimental_toToolResultContent(result)
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
          var _a10;
          return Math.max(max, (_a10 = toolInvocation.step) != null ? _a10 : 0);
        }, 0);
        for (let i2 = 0; i2 <= maxStep; i2++) {
          const stepInvocations = toolInvocations.filter(
            (toolInvocation) => {
              var _a10;
              return ((_a10 = toolInvocation.step) != null ? _a10 : 0) === i2;
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
              const tool = tools[toolName];
              return (tool == null ? void 0 : tool.experimental_toToolResultContent) != null ? {
                type: "tool-result",
                toolCallId,
                toolName,
                result: tool.experimental_toToolResultContent(result),
                experimental_content: tool.experimental_toToolResultContent(result)
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

// errors/invalid-tool-arguments-error.ts
import { AISDKError as AISDKError7, getErrorMessage as getErrorMessage2 } from "@ai-sdk/provider";
var name7 = "AI_InvalidToolArgumentsError";
var marker7 = `vercel.ai.error.${name7}`;
var symbol7 = Symbol.for(marker7);
var _a7;
var InvalidToolArgumentsError = class extends AISDKError7 {
  constructor({
    toolArgs,
    toolName,
    cause,
    message = `Invalid arguments for tool ${toolName}: ${getErrorMessage2(
      cause
    )}`
  }) {
    super({ name: name7, message, cause });
    this[_a7] = true;
    this.toolArgs = toolArgs;
    this.toolName = toolName;
  }
  static isInstance(error) {
    return AISDKError7.hasMarker(error, marker7);
  }
};
_a7 = symbol7;

// errors/no-such-tool-error.ts
import { AISDKError as AISDKError8 } from "@ai-sdk/provider";
var name8 = "AI_NoSuchToolError";
var marker8 = `vercel.ai.error.${name8}`;
var symbol8 = Symbol.for(marker8);
var _a8;
var NoSuchToolError = class extends AISDKError8 {
  constructor({
    toolName,
    availableTools = void 0,
    message = `Model tried to call unavailable tool '${toolName}'. ${availableTools === void 0 ? "No tools are available." : `Available tools: ${availableTools.join(", ")}.`}`
  }) {
    super({ name: name8, message });
    this[_a8] = true;
    this.toolName = toolName;
    this.availableTools = availableTools;
  }
  static isInstance(error) {
    return AISDKError8.hasMarker(error, marker8);
  }
};
_a8 = symbol8;

// util/is-async-generator.ts
function isAsyncGenerator(value) {
  return value != null && typeof value === "object" && Symbol.asyncIterator in value;
}

// util/is-generator.ts
function isGenerator(value) {
  return value != null && typeof value === "object" && Symbol.iterator in value;
}

// util/constants.ts
var HANGING_STREAM_WARNING_TIME_MS = 15 * 1e3;

// rsc/streamable-ui/create-suspended-chunk.tsx
import { Suspense } from "react";
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
var R = [
  async ({
    c: current,
    n: next
  }) => {
    const chunk = await next;
    if (chunk.done) {
      return chunk.value;
    }
    if (chunk.append) {
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        current,
        /* @__PURE__ */ jsx2(Suspense, { fallback: chunk.value, children: /* @__PURE__ */ jsx2(R, { c: chunk.value, n: chunk.next }) })
      ] });
    }
    return /* @__PURE__ */ jsx2(Suspense, { fallback: chunk.value, children: /* @__PURE__ */ jsx2(R, { c: chunk.value, n: chunk.next }) });
  }
][0];
function createSuspendedChunk(initialValue) {
  const { promise, resolve, reject } = createResolvablePromise();
  return {
    row: /* @__PURE__ */ jsx2(Suspense, { fallback: initialValue, children: /* @__PURE__ */ jsx2(R, { c: initialValue, n: promise }) }),
    resolve,
    reject
  };
}

// rsc/streamable-ui/create-streamable-ui.tsx
function createStreamableUI(initialValue) {
  let currentValue = initialValue;
  let closed = false;
  let { row, resolve, reject } = createSuspendedChunk(initialValue);
  function assertStream(method) {
    if (closed) {
      throw new Error(method + ": UI stream is already closed.");
    }
  }
  let warningTimeout;
  function warnUnclosedStream() {
    if (process.env.NODE_ENV === "development") {
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      warningTimeout = setTimeout(() => {
        console.warn(
          "The streamable UI has been slow to update. This may be a bug or a performance issue or you forgot to call `.done()`."
        );
      }, HANGING_STREAM_WARNING_TIME_MS);
    }
  }
  warnUnclosedStream();
  const streamable = {
    value: row,
    update(value) {
      assertStream(".update()");
      if (value === currentValue) {
        warnUnclosedStream();
        return streamable;
      }
      const resolvable = createResolvablePromise();
      currentValue = value;
      resolve({ value: currentValue, done: false, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;
      warnUnclosedStream();
      return streamable;
    },
    append(value) {
      assertStream(".append()");
      const resolvable = createResolvablePromise();
      currentValue = value;
      resolve({ value, done: false, append: true, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;
      warnUnclosedStream();
      return streamable;
    },
    error(error) {
      assertStream(".error()");
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      reject(error);
      return streamable;
    },
    done(...args) {
      assertStream(".done()");
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      if (args.length) {
        resolve({ value: args[0], done: true });
        return streamable;
      }
      resolve({ value: currentValue, done: true });
      return streamable;
    }
  };
  return streamable;
}

// rsc/stream-ui/stream-ui.tsx
var defaultTextRenderer = ({ content }) => content;
async function streamUI({
  model,
  tools,
  toolChoice,
  system,
  prompt,
  messages,
  maxRetries,
  abortSignal,
  headers,
  initial,
  text,
  experimental_providerMetadata,
  providerOptions = experimental_providerMetadata,
  onFinish,
  ...settings
}) {
  if (typeof model === "string") {
    throw new Error(
      "`model` cannot be a string in `streamUI`. Use the actual model instance instead."
    );
  }
  if ("functions" in settings) {
    throw new Error(
      "`functions` is not supported in `streamUI`, use `tools` instead."
    );
  }
  if ("provider" in settings) {
    throw new Error(
      "`provider` is no longer needed in `streamUI`. Use `model` instead."
    );
  }
  if (tools) {
    for (const [name9, tool] of Object.entries(tools)) {
      if ("render" in tool) {
        throw new Error(
          "Tool definition in `streamUI` should not have `render` property. Use `generate` instead. Found in tool: " + name9
        );
      }
    }
  }
  const ui = createStreamableUI(initial);
  const textRender = text || defaultTextRenderer;
  let finished;
  let finishEvent = null;
  async function render({
    args,
    renderer,
    streamableUI,
    isLastCall = false
  }) {
    if (!renderer)
      return;
    const renderFinished = createResolvablePromise();
    finished = finished ? finished.then(() => renderFinished.promise) : renderFinished.promise;
    const rendererResult = renderer(...args);
    if (isAsyncGenerator(rendererResult) || isGenerator(rendererResult)) {
      while (true) {
        const { done, value } = await rendererResult.next();
        const node = await value;
        if (isLastCall && done) {
          streamableUI.done(node);
        } else {
          streamableUI.update(node);
        }
        if (done)
          break;
      }
    } else {
      const node = await rendererResult;
      if (isLastCall) {
        streamableUI.done(node);
      } else {
        streamableUI.update(node);
      }
    }
    renderFinished.resolve(void 0);
  }
  const { retry } = prepareRetries({ maxRetries });
  const validatedPrompt = standardizePrompt({
    prompt: { system, prompt, messages },
    tools: void 0
    // streamUI tools don't support multi-modal tool result conversion
  });
  const result = await retry(
    async () => {
      var _a9;
      return model.doStream({
        mode: {
          type: "regular",
          ...prepareToolsAndToolChoice({
            tools,
            toolChoice,
            activeTools: void 0
          })
        },
        ...prepareCallSettings(settings),
        inputFormat: validatedPrompt.type,
        prompt: await convertToLanguageModelPrompt({
          prompt: validatedPrompt,
          modelSupportsImageUrls: model.supportsImageUrls,
          modelSupportsUrl: (_a9 = model.supportsUrl) == null ? void 0 : _a9.bind(model)
          // support 'this' context
        }),
        providerMetadata: providerOptions,
        abortSignal,
        headers
      });
    }
  );
  const [stream, forkedStream] = result.stream.tee();
  (async () => {
    try {
      let content = "";
      let hasToolCall = false;
      const reader = forkedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        switch (value.type) {
          case "text-delta": {
            content += value.textDelta;
            render({
              renderer: textRender,
              args: [{ content, done: false, delta: value.textDelta }],
              streamableUI: ui
            });
            break;
          }
          case "tool-call-delta": {
            hasToolCall = true;
            break;
          }
          case "tool-call": {
            const toolName = value.toolName;
            if (!tools) {
              throw new NoSuchToolError({ toolName });
            }
            const tool = tools[toolName];
            if (!tool) {
              throw new NoSuchToolError({
                toolName,
                availableTools: Object.keys(tools)
              });
            }
            hasToolCall = true;
            const parseResult = safeParseJSON({
              text: value.args,
              schema: tool.parameters
            });
            if (parseResult.success === false) {
              throw new InvalidToolArgumentsError({
                toolName,
                toolArgs: value.args,
                cause: parseResult.error
              });
            }
            render({
              renderer: tool.generate,
              args: [
                parseResult.value,
                {
                  toolName,
                  toolCallId: value.toolCallId
                }
              ],
              streamableUI: ui,
              isLastCall: true
            });
            break;
          }
          case "error": {
            throw value.error;
          }
          case "finish": {
            finishEvent = {
              finishReason: value.finishReason,
              usage: calculateLanguageModelUsage(value.usage),
              warnings: result.warnings,
              rawResponse: result.rawResponse
            };
            break;
          }
        }
      }
      if (!hasToolCall) {
        render({
          renderer: textRender,
          args: [{ content, done: true }],
          streamableUI: ui,
          isLastCall: true
        });
      }
      await finished;
      if (finishEvent && onFinish) {
        await onFinish({
          ...finishEvent,
          value: ui.value
        });
      }
    } catch (error) {
      ui.error(error);
    }
  })();
  return {
    ...result,
    stream,
    value: ui.value
  };
}

// rsc/streamable-value/streamable-value.ts
var STREAMABLE_VALUE_TYPE = Symbol.for("ui.streamable.value");

// rsc/streamable-value/create-streamable-value.ts
var STREAMABLE_VALUE_INTERNAL_LOCK = Symbol("streamable.value.lock");
function createStreamableValue(initialValue) {
  const isReadableStream = initialValue instanceof ReadableStream || typeof initialValue === "object" && initialValue !== null && "getReader" in initialValue && typeof initialValue.getReader === "function" && "locked" in initialValue && typeof initialValue.locked === "boolean";
  if (!isReadableStream) {
    return createStreamableValueImpl(initialValue);
  }
  const streamableValue = createStreamableValueImpl();
  streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = true;
  (async () => {
    try {
      const reader = initialValue.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
        if (typeof value === "string") {
          streamableValue.append(value);
        } else {
          streamableValue.update(value);
        }
        streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = true;
      }
      streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
      streamableValue.done();
    } catch (e) {
      streamableValue[STREAMABLE_VALUE_INTERNAL_LOCK] = false;
      streamableValue.error(e);
    }
  })();
  return streamableValue;
}
function createStreamableValueImpl(initialValue) {
  let closed = false;
  let locked = false;
  let resolvable = createResolvablePromise();
  let currentValue = initialValue;
  let currentError;
  let currentPromise = resolvable.promise;
  let currentPatchValue;
  function assertStream(method) {
    if (closed) {
      throw new Error(method + ": Value stream is already closed.");
    }
    if (locked) {
      throw new Error(
        method + ": Value stream is locked and cannot be updated."
      );
    }
  }
  let warningTimeout;
  function warnUnclosedStream() {
    if (process.env.NODE_ENV === "development") {
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      warningTimeout = setTimeout(() => {
        console.warn(
          "The streamable value has been slow to update. This may be a bug or a performance issue or you forgot to call `.done()`."
        );
      }, HANGING_STREAM_WARNING_TIME_MS);
    }
  }
  warnUnclosedStream();
  function createWrapped(initialChunk) {
    let init;
    if (currentError !== void 0) {
      init = { error: currentError };
    } else {
      if (currentPatchValue && !initialChunk) {
        init = { diff: currentPatchValue };
      } else {
        init = { curr: currentValue };
      }
    }
    if (currentPromise) {
      init.next = currentPromise;
    }
    if (initialChunk) {
      init.type = STREAMABLE_VALUE_TYPE;
    }
    return init;
  }
  function updateValueStates(value) {
    currentPatchValue = void 0;
    if (typeof value === "string") {
      if (typeof currentValue === "string") {
        if (value.startsWith(currentValue)) {
          currentPatchValue = [0, value.slice(currentValue.length)];
        }
      }
    }
    currentValue = value;
  }
  const streamable = {
    set [STREAMABLE_VALUE_INTERNAL_LOCK](state) {
      locked = state;
    },
    get value() {
      return createWrapped(true);
    },
    update(value) {
      assertStream(".update()");
      const resolvePrevious = resolvable.resolve;
      resolvable = createResolvablePromise();
      updateValueStates(value);
      currentPromise = resolvable.promise;
      resolvePrevious(createWrapped());
      warnUnclosedStream();
      return streamable;
    },
    append(value) {
      assertStream(".append()");
      if (typeof currentValue !== "string" && typeof currentValue !== "undefined") {
        throw new Error(
          `.append(): The current value is not a string. Received: ${typeof currentValue}`
        );
      }
      if (typeof value !== "string") {
        throw new Error(
          `.append(): The value is not a string. Received: ${typeof value}`
        );
      }
      const resolvePrevious = resolvable.resolve;
      resolvable = createResolvablePromise();
      if (typeof currentValue === "string") {
        currentPatchValue = [0, value];
        currentValue = currentValue + value;
      } else {
        currentPatchValue = void 0;
        currentValue = value;
      }
      currentPromise = resolvable.promise;
      resolvePrevious(createWrapped());
      warnUnclosedStream();
      return streamable;
    },
    error(error) {
      assertStream(".error()");
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      currentError = error;
      currentPromise = void 0;
      resolvable.resolve({ error });
      return streamable;
    },
    done(...args) {
      assertStream(".done()");
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      currentPromise = void 0;
      if (args.length) {
        updateValueStates(args[0]);
        resolvable.resolve(createWrapped());
        return streamable;
      }
      resolvable.resolve({});
      return streamable;
    }
  };
  return streamable;
}
export {
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState,
  streamUI
};
//# sourceMappingURL=rsc-server.mjs.map