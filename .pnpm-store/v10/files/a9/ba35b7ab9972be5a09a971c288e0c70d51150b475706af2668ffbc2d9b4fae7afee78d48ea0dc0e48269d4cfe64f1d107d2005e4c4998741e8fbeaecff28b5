import mustache from 'mustache';

class SimpleEventEmitter {
  constructor() {
    this.events = {};
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => {
      this.events[event] = this.events[event].filter(x => x !== listener);
    };
  }
  emit(event, payload) {
    for (const listener of this.events[event] || []) {
      listener(payload);
    }
    for (const listener of this.events["*"] || []) {
      listener(event, payload);
    }
  }
}

const DEFAULT_PROMPT_CACHE_TTL_SECONDS = 60;
class LangfusePromptCacheItem {
  constructor(value, ttlSeconds) {
    this.value = value;
    this._expiry = Date.now() + ttlSeconds * 1000;
  }
  get isExpired() {
    return Date.now() > this._expiry;
  }
}
class LangfusePromptCache {
  constructor() {
    this._cache = new Map();
    this._defaultTtlSeconds = DEFAULT_PROMPT_CACHE_TTL_SECONDS;
    this._refreshingKeys = new Map();
  }
  getIncludingExpired(key) {
    return this._cache.get(key) ?? null;
  }
  set(key, value, ttlSeconds) {
    const effectiveTtlSeconds = ttlSeconds ?? this._defaultTtlSeconds;
    this._cache.set(key, new LangfusePromptCacheItem(value, effectiveTtlSeconds));
  }
  addRefreshingPromise(key, promise) {
    this._refreshingKeys.set(key, promise);
    promise.then(() => {
      this._refreshingKeys.delete(key);
    }).catch(() => {
      this._refreshingKeys.delete(key);
    });
  }
  isRefreshing(key) {
    return this._refreshingKeys.has(key);
  }
  invalidate(promptName) {
    console.log("invalidating", promptName, this._cache.keys());
    for (const key of this._cache.keys()) {
      if (key.startsWith(promptName)) {
        this._cache.delete(key);
      }
    }
  }
}

var LangfusePersistedProperty;
(function (LangfusePersistedProperty) {
  LangfusePersistedProperty["Props"] = "props";
  LangfusePersistedProperty["Queue"] = "queue";
  LangfusePersistedProperty["OptedOut"] = "opted_out";
})(LangfusePersistedProperty || (LangfusePersistedProperty = {}));
var ChatMessageType;
(function (ChatMessageType) {
  ChatMessageType["ChatMessage"] = "chatmessage";
  ChatMessageType["Placeholder"] = "placeholder";
})(ChatMessageType || (ChatMessageType = {}));

mustache.escape = function (text) {
  return text;
};
class BasePromptClient {
  constructor(prompt, isFallback = false, type) {
    this.name = prompt.name;
    this.version = prompt.version;
    this.config = prompt.config;
    this.labels = prompt.labels;
    this.tags = prompt.tags;
    this.isFallback = isFallback;
    this.type = type;
    this.commitMessage = prompt.commitMessage;
  }
  _transformToLangchainVariables(content) {
    const jsonEscapedContent = this.escapeJsonForLangchain(content);
    return jsonEscapedContent.replace(/\{\{(\w+)\}\}/g, "{$1}");
  }
  /**
   * Escapes every curly brace that is part of a JSON object by doubling it.
   *
   * A curly brace is considered “JSON-related” when, after skipping any immediate
   * whitespace, the next non-whitespace character is a single (') or double (") quote.
   *
   * Braces that are already doubled (e.g. `{{variable}}` placeholders) are left untouched.
   *
   * @param text - Input string that may contain JSON snippets.
   * @returns The string with JSON-related braces doubled.
   */
  escapeJsonForLangchain(text) {
    const out = []; // collected characters
    const stack = []; // true = “this { belongs to JSON”, false = normal “{”
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      // ---------- opening brace ----------
      if (ch === "{") {
        // leave existing “{{ …” untouched
        if (i + 1 < n && text[i + 1] === "{") {
          out.push("{{");
          i += 2;
          continue;
        }
        // look ahead to find the next non-space character
        let j = i + 1;
        while (j < n && /\s/.test(text[j])) {
          j++;
        }
        const isJson = j < n && (text[j] === "'" || text[j] === '"');
        out.push(isJson ? "{{" : "{");
        stack.push(isJson); // remember how this “{” was treated
        i += 1;
        continue;
      }
      // ---------- closing brace ----------
      if (ch === "}") {
        // leave existing “… }}” untouched
        if (i + 1 < n && text[i + 1] === "}") {
          out.push("}}");
          i += 2;
          continue;
        }
        const isJson = stack.pop() ?? false;
        out.push(isJson ? "}}" : "}");
        i += 1;
        continue;
      }
      // ---------- any other character ----------
      out.push(ch);
      i += 1;
    }
    return out.join("");
  }
}
class TextPromptClient extends BasePromptClient {
  constructor(prompt, isFallback = false) {
    super(prompt, isFallback, "text");
    this.promptResponse = prompt;
    this.prompt = prompt.prompt;
  }
  compile(variables, _placeholders) {
    return mustache.render(this.promptResponse.prompt, variables ?? {});
  }
  getLangchainPrompt(_options) {
    /**
     * Converts Langfuse prompt into string compatible with Langchain PromptTemplate.
     *
     * It specifically adapts the mustache-style double curly braces {{variable}} used in Langfuse
     * to the single curly brace {variable} format expected by Langchain.
     *
     * @returns {string} The string that can be plugged into Langchain's PromptTemplate.
     */
    return this._transformToLangchainVariables(this.prompt);
  }
  toJSON() {
    return JSON.stringify({
      name: this.name,
      prompt: this.prompt,
      version: this.version,
      isFallback: this.isFallback,
      tags: this.tags,
      labels: this.labels,
      type: this.type,
      config: this.config
    });
  }
}
class ChatPromptClient extends BasePromptClient {
  constructor(prompt, isFallback = false) {
    const normalizedPrompt = ChatPromptClient.normalizePrompt(prompt.prompt);
    const typedPrompt = {
      ...prompt,
      prompt: normalizedPrompt
    };
    super(typedPrompt, isFallback, "chat");
    this.promptResponse = typedPrompt;
    this.prompt = normalizedPrompt;
  }
  static normalizePrompt(prompt) {
    // Convert ChatMessages to ChatMessageWithPlaceholders for backward compatibility
    return prompt.map(item => {
      if ("type" in item) {
        // Already has type field (new format)
        return item;
      } else {
        // Plain ChatMessage (legacy format) - add type field
        return {
          type: ChatMessageType.ChatMessage,
          ...item
        };
      }
    });
  }
  compile(variables, placeholders) {
    /**
     * Compiles the chat prompt by replacing placeholders and variables with provided values.
     *
     * First fills-in placeholders by from the provided placeholder parameter.
     * Then compiles variables into the message content.
     * Unresolved placeholders are included in the output as placeholder objects.
     * If you only want to fill-in placeholders, pass an empty object for variables.
     *
     * @param variables - Key-value pairs for Mustache variable substitution in message content
     * @param placeholders - Key-value pairs where keys are placeholder names and values can be ChatMessage arrays
     * @returns Array of ChatMessage objects and placeholder objects with placeholders replaced and variables rendered
     */
    const messagesWithPlaceholdersReplaced = [];
    const placeholderValues = placeholders ?? {};
    for (const item of this.prompt) {
      if ("type" in item && item.type === ChatMessageType.Placeholder) {
        const placeholderValue = placeholderValues[item.name];
        if (Array.isArray(placeholderValue) && placeholderValue.length > 0 && placeholderValue.every(msg => typeof msg === "object" && "role" in msg && "content" in msg)) {
          messagesWithPlaceholdersReplaced.push(...placeholderValue);
        } else if (Array.isArray(placeholderValue) && placeholderValue.length === 0) ; else if (placeholderValue !== undefined) {
          // Non-standard placeholder value format, just stringfiy
          messagesWithPlaceholdersReplaced.push(JSON.stringify(placeholderValue));
        } else {
          // Keep unresolved placeholder in the output
          messagesWithPlaceholdersReplaced.push(item);
        }
      } else if ("role" in item && "content" in item && item.type === ChatMessageType.ChatMessage) {
        messagesWithPlaceholdersReplaced.push({
          role: item.role,
          content: item.content
        });
      }
    }
    return messagesWithPlaceholdersReplaced.map(item => {
      if (typeof item === "object" && item !== null && "role" in item && "content" in item) {
        return {
          ...item,
          content: mustache.render(item.content, variables ?? {})
        };
      } else {
        // Return placeholder or stringified value as-is
        return item;
      }
    });
  }
  getLangchainPrompt(options) {
    /*
     * Converts Langfuse prompt into format compatible with Langchain PromptTemplate.
     *
     * Fills-in placeholders from provided values and converts unresolved ones to Langchain MessagesPlaceholder objects.
     * Transforms variables from {{var}} to {var} format for Langchain without rendering them.
     *
     * @param options - Configuration object
     * @param options.placeholders - Key-value pairs where keys are placeholder names and values can be ChatMessage arrays
     * @returns Array of ChatMessage objects and Langchain MessagesPlaceholder objects with variables transformed for Langchain compatibility.
     *
     * @example
     * ```typescript
     * const client = new ChatPromptClient(prompt);
     * client.getLangchainPrompt({ placeholders: { examples: [{ role: "user", content: "Hello" }] } });
     * ```
     */
    const messagesWithPlaceholdersReplaced = [];
    const placeholderValues = options?.placeholders ?? {};
    for (const item of this.prompt) {
      if ("type" in item && item.type === ChatMessageType.Placeholder) {
        const placeholderValue = placeholderValues[item.name];
        if (Array.isArray(placeholderValue) && placeholderValue.length > 0 && placeholderValue.every(msg => typeof msg === "object" && "role" in msg && "content" in msg)) {
          // Complete placeholder fill-in, replace with it
          messagesWithPlaceholdersReplaced.push(...placeholderValue.map(msg => {
            return {
              role: msg.role,
              content: this._transformToLangchainVariables(msg.content)
            };
          }));
        } else if (Array.isArray(placeholderValue) && placeholderValue.length === 0) ; else if (placeholderValue !== undefined) {
          // Non-standard placeholder value, just stringify and add directly
          messagesWithPlaceholdersReplaced.push(JSON.stringify(placeholderValue));
        } else {
          // Convert unresolved placeholder to Langchain MessagesPlaceholder
          messagesWithPlaceholdersReplaced.push({
            variableName: item.name,
            optional: false
          });
        }
      } else if ("role" in item && "content" in item && item.type === ChatMessageType.ChatMessage) {
        messagesWithPlaceholdersReplaced.push({
          role: item.role,
          content: this._transformToLangchainVariables(item.content)
        });
      }
    }
    return messagesWithPlaceholdersReplaced;
  }
  toJSON() {
    return JSON.stringify({
      name: this.name,
      prompt: this.promptResponse.prompt.map(item => {
        if ("type" in item && item.type === ChatMessageType.ChatMessage) {
          const {
            type: _,
            ...messageWithoutType
          } = item;
          return messageWithoutType;
        }
        return item;
      }),
      version: this.version,
      isFallback: this.isFallback,
      tags: this.tags,
      labels: this.labels,
      type: this.type,
      config: this.config
    });
  }
}

function assert(truthyValue, message) {
  if (!truthyValue) {
    throw new Error(message);
  }
}
function removeTrailingSlash(url) {
  return url?.replace(/\/+$/, "");
}
async function retriable(fn, props = {}, log) {
  const {
    retryCount = 3,
    retryDelay = 5000,
    retryCheck = () => true
  } = props;
  let lastError = null;
  for (let i = 0; i < retryCount + 1; i++) {
    if (i > 0) {
      // don't wait when it's the first try
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      log(`Retrying ${i + 1} of ${retryCount + 1}`);
    }
    try {
      const res = await fn();
      return res;
    } catch (e) {
      lastError = e;
      if (!retryCheck(e)) {
        throw e;
      }
      log(`Retriable error: ${JSON.stringify(e)}`);
    }
  }
  throw lastError;
}
// https://stackoverflow.com/a/8809472
function generateUUID(globalThis) {
  // Public Domain/MIT
  let d = new Date().getTime(); //Timestamp
  let d2 = globalThis && globalThis.performance && globalThis.performance.now && globalThis.performance.now() * 1000 || 0; //Time in microseconds since page-load or 0 if unsupported
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = Math.random() * 16; //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : r & 0x3 | 0x8).toString(16);
  });
}
function currentTimestamp() {
  return new Date().getTime();
}
function currentISOTime() {
  return new Date().toISOString();
}
function safeSetTimeout(fn, timeout) {
  // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
  // rather than setImmediate.
  const t = setTimeout(fn, timeout);
  // We unref if available to prevent Node.js hanging on exit
  t?.unref && t?.unref();
  return t;
}
function getEnv(key) {
  if (typeof process !== "undefined" && process.env[key]) {
    return process.env[key];
  } else if (typeof globalThis !== "undefined") {
    return globalThis[key];
  }
  return;
}
function configLangfuseSDK(params, secretRequired = true) {
  const {
    publicKey,
    secretKey,
    ...coreOptions
  } = params ?? {};
  // check environment variables if values not provided
  const finalPublicKey = publicKey ?? getEnv("LANGFUSE_PUBLIC_KEY");
  const finalSecretKey = secretRequired ? secretKey ?? getEnv("LANGFUSE_SECRET_KEY") : undefined;
  const finalBaseUrl = coreOptions.baseUrl ?? getEnv("LANGFUSE_BASEURL");
  const finalCoreOptions = {
    ...coreOptions,
    baseUrl: finalBaseUrl
  };
  return {
    publicKey: finalPublicKey,
    ...(secretRequired ? {
      secretKey: finalSecretKey
    } : undefined),
    ...finalCoreOptions
  };
}
const encodeQueryParams = params => {
  const queryParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // check for date
      if (value instanceof Date) {
        queryParams.append(key, value.toISOString());
      } else {
        queryParams.append(key, value.toString());
      }
    }
  });
  return queryParams.toString();
};

var utils = /*#__PURE__*/Object.freeze({
  __proto__: null,
  assert: assert,
  configLangfuseSDK: configLangfuseSDK,
  currentISOTime: currentISOTime,
  currentTimestamp: currentTimestamp,
  encodeQueryParams: encodeQueryParams,
  generateUUID: generateUUID,
  getEnv: getEnv,
  removeTrailingSlash: removeTrailingSlash,
  retriable: retriable,
  safeSetTimeout: safeSetTimeout
});

const common_release_envs = [
// Vercel
"VERCEL_GIT_COMMIT_SHA", "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
// Netlify
"COMMIT_REF",
// Render
"RENDER_GIT_COMMIT",
// GitLab CI
"CI_COMMIT_SHA",
// CicleCI
"CIRCLE_SHA1",
// Cloudflare pages
"CF_PAGES_COMMIT_SHA",
// AWS Amplify
"REACT_APP_GIT_SHA",
// Heroku
"SOURCE_VERSION",
// Trigger.dev
"TRIGGER_DEPLOYMENT_ID"];
function getCommonReleaseEnvs() {
  for (const key of common_release_envs) {
    const value = getEnv(key);
    if (value) {
      return value;
    }
  }
  return undefined;
}

let fs = null;
let cryptoModule = null;
// Use wrapper to prevent bundlers from trying to resolve the dynamic import
// Otherwise, the import will be incorrectly resolved as a static import even though it's dynamic
// Test for browser environment would fail because the import will be incorrectly resolved as a static import and fs and crypto will be unavailable
const dynamicImport = module => {
  return import( /* webpackIgnore: true */module);
};
if (typeof globalThis.Deno !== "undefined") {
  // Deno
  Promise.all([dynamicImport("node:fs"), dynamicImport("node:crypto")]).then(([importedFs, importedCrypto]) => {
    fs = importedFs;
    cryptoModule = importedCrypto;
  }).catch(); // Errors are handled on runtime
} else if (typeof process !== "undefined" && process.versions?.node) {
  // Node
  Promise.all([dynamicImport("fs"), dynamicImport("crypto")]).then(([importedFs, importedCrypto]) => {
    fs = importedFs;
    cryptoModule = importedCrypto;
  }).catch(); // Errors are handled on runtime
} else if (typeof crypto !== "undefined") {
  // Edge runtime (Cloudflare Workers, Vercel Cloud Function)
  cryptoModule = crypto;
}
/**
 * A class for wrapping media objects for upload to Langfuse.
 *
 * This class handles the preparation and formatting of media content for Langfuse,
 * supporting both base64 data URIs and raw content bytes.
 */
class LangfuseMedia {
  constructor(params) {
    const {
      obj,
      base64DataUri,
      contentType,
      contentBytes,
      filePath
    } = params;
    this.obj = obj;
    this._mediaId = undefined;
    if (base64DataUri) {
      const [contentBytesParsed, contentTypeParsed] = this.parseBase64DataUri(base64DataUri);
      this._contentBytes = contentBytesParsed;
      this._contentType = contentTypeParsed;
      this._source = "base64_data_uri";
    } else if (contentBytes && contentType) {
      this._contentBytes = contentBytes;
      this._contentType = contentType;
      this._source = "bytes";
    } else if (filePath && contentType) {
      if (!fs) {
        throw new Error("File system support is not available in this environment");
      }
      if (!fs.existsSync(filePath)) {
        throw new Error(`File at path ${filePath} does not exist`);
      }
      this._contentBytes = this.readFile(filePath);
      this._contentType = this._contentBytes ? contentType : undefined;
      this._source = this._contentBytes ? "file" : undefined;
    } else {
      console.error("base64DataUri, or contentBytes and contentType, or filePath must be provided to LangfuseMedia");
    }
  }
  readFile(filePath) {
    try {
      if (!fs) {
        throw new Error("File system support is not available in this environment");
      }
      return fs.readFileSync(filePath);
    } catch (error) {
      console.error(`Error reading file at path ${filePath}`, error);
      return undefined;
    }
  }
  parseBase64DataUri(data) {
    try {
      if (!data || typeof data !== "string") {
        throw new Error("Data URI is not a string");
      }
      if (!data.startsWith("data:")) {
        throw new Error("Data URI does not start with 'data:'");
      }
      const [header, actualData] = data.slice(5).split(",", 2);
      if (!header || !actualData) {
        throw new Error("Invalid URI");
      }
      const headerParts = header.split(";");
      if (!headerParts.includes("base64")) {
        throw new Error("Data is not base64 encoded");
      }
      const contentType = headerParts[0];
      if (!contentType) {
        throw new Error("Content type is empty");
      }
      return [Buffer.from(actualData, "base64"), contentType];
    } catch (error) {
      console.error("Error parsing base64 data URI", error);
      return [undefined, undefined];
    }
  }
  get contentLength() {
    return this._contentBytes?.length;
  }
  get contentSha256Hash() {
    if (!this._contentBytes) {
      return undefined;
    }
    if (!cryptoModule) {
      console.error("Crypto support is not available in this environment");
      return undefined;
    }
    const sha256Hash = cryptoModule.createHash("sha256").update(this._contentBytes).digest("base64");
    return sha256Hash;
  }
  toJSON() {
    if (!this._contentType || !this._source || !this._mediaId) {
      return `<Upload handling failed for LangfuseMedia of type ${this._contentType}>`;
    }
    return `@@@langfuseMedia:type=${this._contentType}|id=${this._mediaId}|source=${this._source}@@@`;
  }
  /**
   * Parses a media reference string into a ParsedMediaReference.
   *
   * Example reference string:
   *     "@@@langfuseMedia:type=image/jpeg|id=some-uuid|source=base64DataUri@@@"
   *
   * @param referenceString - The reference string to parse.
   * @returns An object with the mediaId, source, and contentType.
   *
   * @throws Error if the reference string is invalid or missing required fields.
   */
  static parseReferenceString(referenceString) {
    const prefix = "@@@langfuseMedia:";
    const suffix = "@@@";
    if (!referenceString.startsWith(prefix)) {
      throw new Error("Reference string does not start with '@@@langfuseMedia:type='");
    }
    if (!referenceString.endsWith(suffix)) {
      throw new Error("Reference string does not end with '@@@'");
    }
    const content = referenceString.slice(prefix.length, -suffix.length);
    const pairs = content.split("|");
    const parsedData = {};
    for (const pair of pairs) {
      const [key, value] = pair.split("=", 2);
      parsedData[key] = value;
    }
    if (!("type" in parsedData && "id" in parsedData && "source" in parsedData)) {
      throw new Error("Missing required fields in reference string");
    }
    return {
      mediaId: parsedData["id"],
      source: parsedData["source"],
      contentType: parsedData["type"]
    };
  }
  /**
   * Replaces the media reference strings in an object with base64 data URIs for the media content.
   *
   * This method recursively traverses an object (up to a maximum depth of 10) looking for media reference strings
   * in the format "@@@langfuseMedia:...@@@". When found, it fetches the actual media content using the provided
   * Langfuse client and replaces the reference string with a base64 data URI.
   *
   * If fetching media content fails for a reference string, a warning is logged and the reference string is left unchanged.
   *
   * @param params - Configuration object
   * @param params.obj - The object to process. Can be a primitive value, array, or nested object
   * @param params.langfuseClient - Langfuse client instance used to fetch media content
   * @param params.resolveWith - The representation of the media content to replace the media reference string with. Currently only "base64DataUri" is supported.
   * @param params.maxDepth - Optional. Default is 10. The maximum depth to traverse the object.
   *
   * @returns A deep copy of the input object with all media references replaced with base64 data URIs where possible
   *
   * @example
   * ```typescript
   * const obj = {
   *   image: "@@@langfuseMedia:type=image/jpeg|id=123|source=bytes@@@",
   *   nested: {
   *     pdf: "@@@langfuseMedia:type=application/pdf|id=456|source=bytes@@@"
   *   }
   * };
   *
   * const result = await LangfuseMedia.resolveMediaReferences({
   *   obj,
   *   langfuseClient
   * });
   *
   * // Result:
   * // {
   * //   image: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
   * //   nested: {
   * //     pdf: "data:application/pdf;base64,JVBERi0xLjcK..."
   * //   }
   * // }
   * ```
   */
  static async resolveMediaReferences(params) {
    const {
      obj,
      langfuseClient,
      maxDepth = 10
    } = params;
    async function traverse(obj, depth) {
      if (depth > maxDepth) {
        return obj;
      }
      // Handle string with potential media references
      if (typeof obj === "string") {
        const regex = /@@@langfuseMedia:.+?@@@/g;
        const referenceStringMatches = obj.match(regex);
        if (!referenceStringMatches) {
          return obj;
        }
        let result = obj;
        const referenceStringToMediaContentMap = new Map();
        await Promise.all(referenceStringMatches.map(async referenceString => {
          try {
            const parsedMediaReference = LangfuseMedia.parseReferenceString(referenceString);
            const mediaData = await langfuseClient.fetchMedia(parsedMediaReference.mediaId);
            const mediaContent = await langfuseClient.fetch(mediaData.url, {
              method: "GET",
              headers: {}
            });
            if (mediaContent.status !== 200) {
              throw new Error("Failed to fetch media content");
            }
            const base64MediaContent = Buffer.from(await mediaContent.arrayBuffer()).toString("base64");
            const base64DataUri = `data:${mediaData.contentType};base64,${base64MediaContent}`;
            referenceStringToMediaContentMap.set(referenceString, base64DataUri);
          } catch (error) {
            console.warn("Error fetching media content for reference string", referenceString, error);
            // Do not replace the reference string if there's an error
          }
        }));
        for (const [referenceString, base64MediaContent] of referenceStringToMediaContentMap.entries()) {
          result = result.replaceAll(referenceString, base64MediaContent);
        }
        return result;
      }
      // Handle arrays
      if (Array.isArray(obj)) {
        return Promise.all(obj.map(async item => await traverse(item, depth + 1)));
      }
      // Handle objects
      if (typeof obj === "object" && obj !== null) {
        return Object.fromEntries(await Promise.all(Object.entries(obj).map(async ([key, value]) => [key, await traverse(value, depth + 1)])));
      }
      return obj;
    }
    return traverse(obj, 0);
  }
}

/**
 * A consistent sampling function that works for arbitrary strings across all JavaScript runtimes.
 */
function isInSample(input, sampleRate) {
  if (sampleRate === undefined) {
    return true;
  } else if (sampleRate === 0) {
    return false;
  }
  if (sampleRate < 0 || sampleRate > 1 || isNaN(sampleRate)) {
    console.warn("Sample rate must be between 0 and 1. Ignoring setting.");
    return true;
  }
  return simpleHash(input) < sampleRate;
}
/**
 * Simple and consistent string hashing function.
 * Uses character codes and prime numbers for good distribution.
 */
function simpleHash(str) {
  let hash = 0;
  const prime = 31;
  for (let i = 0; i < str.length; i++) {
    // Use rolling multiplication instead of Math.pow
    hash = hash * prime + str.charCodeAt(i) >>> 0;
  }
  // Use bit operations for better distribution
  hash = (hash >>> 16 ^ hash) * 0x45d9f3b;
  hash = (hash >>> 16 ^ hash) * 0x45d9f3b;
  hash = hash >>> 16 ^ hash;
  return Math.abs(hash) / 0x7fffffff;
}

class LangfuseMemoryStorage {
  constructor() {
    this._memoryStorage = {};
  }
  getProperty(key) {
    return this._memoryStorage[key];
  }
  setProperty(key, value) {
    this._memoryStorage[key] = value !== null ? value : undefined;
  }
}

const MAX_EVENT_SIZE_BYTES = getEnv("LANGFUSE_MAX_EVENT_SIZE_BYTES") ? Number(getEnv("LANGFUSE_MAX_EVENT_SIZE_BYTES")) : 1_000_000;
const MAX_BATCH_SIZE_BYTES = getEnv("LANGFUSE_MAX_BATCH_SIZE_BYTES") ? Number(getEnv("LANGFUSE_MAX_BATCH_SIZE_BYTES")) : 2_500_000;
const ENVIRONMENT_PATTERN = /^(?!langfuse)[a-z0-9_-]+$/;
// NOTE: This list whitelists environments that are used for traces ingested by Langfuse. Please mirror edits to this list in the Langfuse ingestion schema.
const WHITELISTED_LANGFUSE_INTERNAL_ENVIRONMENTS = ["langfuse-prompt-experiment"];
class LangfuseFetchHttpError extends Error {
  constructor(response, body) {
    super("HTTP error while fetching Langfuse: " + response.status + " and body: " + body);
    this.response = response;
    this.name = "LangfuseFetchHttpError";
  }
}
class LangfuseFetchNetworkError extends Error {
  constructor(error) {
    super("Network error while fetching Langfuse", error instanceof Error ? {
      cause: error
    } : {});
    this.error = error;
    this.name = "LangfuseFetchNetworkError";
  }
}
function isLangfuseFetchHttpError(error) {
  return typeof error === "object" && error.name === "LangfuseFetchHttpError";
}
function isLangfuseFetchNetworkError(error) {
  return typeof error === "object" && error.name === "LangfuseFetchNetworkError";
}
function isLangfuseFetchError(err) {
  return isLangfuseFetchHttpError(err) || isLangfuseFetchNetworkError(err);
}
// Constants for URLs
const SUPPORT_URL = "https://langfuse.com/support";
const API_DOCS_URL = "https://api.reference.langfuse.com";
const RBAC_DOCS_URL = "https://langfuse.com/docs/rbac";
const INSTALLATION_DOCS_URL = "https://langfuse.com/docs/sdk/typescript/guide";
const RATE_LIMITS_URL = "https://langfuse.com/faq/all/api-limits";
const NPM_PACKAGE_URL = "https://www.npmjs.com/package/langfuse";
// Error messages
const updatePromptResponse = `Make sure to keep your SDK updated, refer to ${NPM_PACKAGE_URL} for details.`;
const defaultServerErrorPrompt = `This is an unusual occurrence and we are monitoring it closely. For help, please contact support: ${SUPPORT_URL}.`;
const defaultErrorResponse = `Unexpected error occurred. Please check your request and contact support: ${SUPPORT_URL}.`;
// Error response map
const errorResponseByCode = new Map([
// Internal error category: 5xx errors, 404 error
[500, `Internal server error occurred. For help, please contact support: ${SUPPORT_URL}`], [501, `Not implemented. Please check your request and contact support for help: ${SUPPORT_URL}.`], [502, `Bad gateway. ${defaultServerErrorPrompt}`], [503, `Service unavailable. ${defaultServerErrorPrompt}`], [504, `Gateway timeout. ${defaultServerErrorPrompt}`], [404, `Internal error occurred. ${defaultServerErrorPrompt}`],
// Client error category: 4xx errors, excluding 404
[400, `Bad request. Please check your request for any missing or incorrect parameters. Refer to our API docs: ${API_DOCS_URL} for details.`], [401, `Unauthorized. Please check your public/private host settings. Refer to our installation and setup guide: ${INSTALLATION_DOCS_URL} for details on SDK configuration.`], [403, `Forbidden. Please check your access control settings. Refer to our RBAC docs: ${RBAC_DOCS_URL} for details.`], [429, `Rate limit exceeded. For more information on rate limits please see: ${RATE_LIMITS_URL}`]]);
// Returns a user-friendly error message based on the HTTP status code
function getErrorResponseByCode(code) {
  if (!code) {
    return `${defaultErrorResponse} ${updatePromptResponse}`;
  }
  const errorResponse = errorResponseByCode.get(code) || defaultErrorResponse;
  return `${code}: ${errorResponse} ${updatePromptResponse}`;
}
function logIngestionError(error) {
  if (isLangfuseFetchHttpError(error)) {
    const code = error.response.status;
    const errorResponse = getErrorResponseByCode(code);
    console.error("[Langfuse SDK]", errorResponse, `Error details: ${error}`);
  } else if (isLangfuseFetchNetworkError(error)) {
    console.error("[Langfuse SDK] Network error: ", error);
  } else {
    console.error("[Langfuse SDK] Unknown error:", error);
  }
}
class LangfuseCoreStateless {
  constructor(params) {
    this.additionalHeaders = {};
    this.debugMode = false;
    this.pendingEventProcessingPromises = {};
    this.pendingIngestionPromises = {};
    this.localEventExportMap = new Map();
    // internal
    this._events = new SimpleEventEmitter();
    const {
      publicKey,
      secretKey,
      enabled,
      _projectId,
      _isLocalEventExportEnabled,
      ...options
    } = params;
    this._events.on("error", payload => {
      console.error(`[Langfuse SDK] ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
    });
    this.enabled = enabled === false ? false : true;
    this.publicKey = publicKey ?? "";
    this.secretKey = secretKey;
    this.baseUrl = removeTrailingSlash(options?.baseUrl || "https://cloud.langfuse.com");
    this.additionalHeaders = options?.additionalHeaders || {};
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 15;
    this.flushInterval = options?.flushInterval ?? 10000;
    this.release = options?.release ?? getEnv("LANGFUSE_RELEASE") ?? getCommonReleaseEnvs() ?? undefined;
    this.mask = options?.mask;
    this.sampleRate = options?.sampleRate ?? (getEnv("LANGFUSE_SAMPLE_RATE") ? Number(getEnv("LANGFUSE_SAMPLE_RATE")) : undefined);
    if (this.sampleRate) {
      this._events.emit("debug", `Langfuse trace sampling enabled with sampleRate ${this.sampleRate}.`);
    }
    this.environment = options?.environment ?? getEnv("LANGFUSE_TRACING_ENVIRONMENT");
    if (this.environment && !(ENVIRONMENT_PATTERN.test(this.environment) || WHITELISTED_LANGFUSE_INTERNAL_ENVIRONMENTS.includes(this.environment)) && !_isLocalEventExportEnabled) {
      this._events.emit("error", `Invalid tracing environment set: ${this.environment} . Environment must match regex ${ENVIRONMENT_PATTERN}. Events will be rejected by Langfuse server.`);
    }
    this._retryOptions = {
      retryCount: options?.fetchRetryCount ?? 3,
      retryDelay: options?.fetchRetryDelay ?? 3000,
      retryCheck: isLangfuseFetchError
    };
    this.requestTimeout = options?.requestTimeout ?? 5000; // 5 seconds
    this.sdkIntegration = options?.sdkIntegration ?? "DEFAULT";
    this.isLocalEventExportEnabled = _isLocalEventExportEnabled ?? false;
    if (this.isLocalEventExportEnabled && !_projectId) {
      this._events.emit("error", "Local event export is enabled, but no project ID was provided. Disabling local export.");
      this.isLocalEventExportEnabled = false;
      return;
    } else if (!this.isLocalEventExportEnabled && _projectId) {
      this._events.emit("error", "Local event export is disabled, but a project ID was provided. Disabling local export.");
      this.isLocalEventExportEnabled = false;
      return;
    } else {
      this.projectId = _projectId;
    }
  }
  getSdkIntegration() {
    return this.sdkIntegration;
  }
  getCommonEventProperties() {
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion()
    };
  }
  on(event, cb) {
    return this._events.on(event, cb);
  }
  debug(enabled = true) {
    this.removeDebugCallback?.();
    this.debugMode = enabled;
    if (enabled) {
      this.removeDebugCallback = this.on("*", (event, payload) => {
        // we already have a logger attached to error events
        if (event === "error") {
          return;
        }
        console.log("[Langfuse Debug]", event, JSON.stringify(payload));
      });
    }
  }
  /***
   *** Handlers for each object type
   ***/
  traceStateless(body) {
    const {
      id: bodyId,
      timestamp: bodyTimestamp,
      release: bodyRelease,
      ...rest
    } = body;
    const id = bodyId ?? generateUUID();
    const release = bodyRelease ?? this.release;
    const parsedBody = {
      id,
      release,
      timestamp: bodyTimestamp ?? new Date(),
      environment: this.environment,
      ...rest
    };
    this.enqueue("trace-create", parsedBody);
    return id;
  }
  eventStateless(body) {
    const {
      id: bodyId,
      startTime: bodyStartTime,
      ...rest
    } = body;
    const id = bodyId ?? generateUUID();
    const parsedBody = {
      id,
      startTime: bodyStartTime ?? new Date(),
      environment: this.environment,
      ...rest
    };
    this.enqueue("event-create", parsedBody);
    return id;
  }
  spanStateless(body) {
    const {
      id: bodyId,
      startTime: bodyStartTime,
      ...rest
    } = body;
    const id = bodyId || generateUUID();
    const parsedBody = {
      id,
      startTime: bodyStartTime ?? new Date(),
      environment: this.environment,
      ...rest
    };
    this.enqueue("span-create", parsedBody);
    return id;
  }
  generationStateless(body) {
    const {
      id: bodyId,
      startTime: bodyStartTime,
      prompt,
      ...rest
    } = body;
    const promptDetails = prompt && !prompt.isFallback ? {
      promptName: prompt.name,
      promptVersion: prompt.version
    } : {};
    const id = bodyId || generateUUID();
    const parsedBody = {
      id,
      startTime: bodyStartTime ?? new Date(),
      environment: this.environment,
      ...promptDetails,
      ...rest
    };
    this.enqueue("generation-create", parsedBody);
    return id;
  }
  scoreStateless(body) {
    const {
      id: bodyId,
      ...rest
    } = body;
    const id = bodyId || generateUUID();
    const parsedBody = {
      id,
      environment: this.environment,
      ...rest
    };
    this.enqueue("score-create", parsedBody);
    return id;
  }
  updateSpanStateless(body) {
    this.enqueue("span-update", body);
    return body.id;
  }
  updateGenerationStateless(body) {
    const {
      prompt,
      ...rest
    } = body;
    const promptDetails = prompt && !prompt.isFallback ? {
      promptName: prompt.name,
      promptVersion: prompt.version
    } : {};
    const parsedBody = {
      ...promptDetails,
      ...rest
    };
    this.enqueue("generation-update", parsedBody);
    return body.id;
  }
  async _getDataset(name) {
    const encodedName = encodeURIComponent(name);
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/v2/datasets/${encodedName}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  async _getDatasetItems(query) {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/dataset-items?${params}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  async _fetchMedia(id) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/media/${id}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  async fetchTraces(query) {
    // destructure the response into data and meta to be explicit about the shape of the response and add type-warnings in case the API changes
    const {
      data,
      meta
    } = await this.fetchAndLogErrors(`${this.baseUrl}/api/public/traces?${encodeQueryParams(query)}`, this._getFetchOptions({
      method: "GET"
    }));
    return {
      data,
      meta
    };
  }
  async fetchTrace(traceId) {
    const res = await this.fetchAndLogErrors(`${this.baseUrl}/api/public/traces/${traceId}`, this._getFetchOptions({
      method: "GET"
    }));
    return {
      data: res
    };
  }
  async fetchObservations(query) {
    // destructure the response into data and meta to be explicit about the shape of the response and add type-warnings in case the API changes
    const {
      data,
      meta
    } = await this.fetchAndLogErrors(`${this.baseUrl}/api/public/observations?${encodeQueryParams(query)}`, this._getFetchOptions({
      method: "GET"
    }));
    return {
      data,
      meta
    };
  }
  async fetchObservation(observationId) {
    const res = await this.fetchAndLogErrors(`${this.baseUrl}/api/public/observations/${observationId}`, this._getFetchOptions({
      method: "GET"
    }));
    return {
      data: res
    };
  }
  async fetchSessions(query) {
    // destructure the response into data and meta to be explicit about the shape of the response and add type-warnings in case the API changes
    const {
      data,
      meta
    } = await this.fetchAndLogErrors(`${this.baseUrl}/api/public/sessions?${encodeQueryParams(query)}`, this._getFetchOptions({
      method: "GET"
    }));
    return {
      data,
      meta
    };
  }
  async getDatasetRun(params) {
    const encodedDatasetName = encodeURIComponent(params.datasetName);
    const encodedRunName = encodeURIComponent(params.runName);
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/datasets/${encodedDatasetName}/runs/${encodedRunName}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  async getDatasetRuns(datasetName, query) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/datasets/${encodeURIComponent(datasetName)}/runs?${encodeQueryParams(query)}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  async createDatasetRunItem(body) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/dataset-run-items`, this._getFetchOptions({
      method: "POST",
      body: JSON.stringify(body)
    }));
  }
  /**
   * Creates a dataset. Upserts the dataset if it already exists.
   *
   * @param dataset Can be either a string (name) or an object with name, description and metadata
   * @returns A promise that resolves to the response of the create operation.
   */
  async createDataset(dataset) {
    const body = typeof dataset === "string" ? {
      name: dataset
    } : dataset;
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/datasets`, this._getFetchOptions({
      method: "POST",
      body: JSON.stringify(body)
    }));
  }
  /**
   * Creates a dataset item. Upserts the item if it already exists.
   * @param body The body of the dataset item to be created.
   * @returns A promise that resolves to the response of the create operation.
   */
  async createDatasetItem(body) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/dataset-items`, this._getFetchOptions({
      method: "POST",
      body: JSON.stringify(body)
    }));
  }
  async getDatasetItem(id) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/dataset-items/${id}`, this._getFetchOptions({
      method: "GET"
    }));
  }
  _parsePayload(response) {
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }
  async createPromptStateless(body) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/v2/prompts`, this._getFetchOptions({
      method: "POST",
      body: JSON.stringify(body)
    }));
  }
  async updatePromptStateless(body) {
    return this.fetchAndLogErrors(`${this.baseUrl}/api/public/v2/prompts/${encodeURIComponent(body.name)}/versions/${encodeURIComponent(body.version)}`, this._getFetchOptions({
      method: "PATCH",
      body: JSON.stringify(body)
    }));
  }
  async getPromptStateless(name, version, label, maxRetries, requestTimeout // this will override the default requestTimeout for fetching prompts. Together with maxRetries, it can be used to fetch prompts fast when the first fetch is slow.
  ) {
    const encodedName = encodeURIComponent(name);
    const params = new URLSearchParams();
    // Add parameters only if they are provided
    if (version && label) {
      throw new Error("Provide either version or label, not both.");
    }
    if (version) {
      params.append("version", version.toString());
    }
    if (label) {
      params.append("label", label);
    }
    const url = `${this.baseUrl}/api/public/v2/prompts/${encodedName}${params.size ? "?" + params : ""}`;
    const boundedMaxRetries = this._getBoundedMaxRetries({
      maxRetries,
      defaultMaxRetries: 2,
      maxRetriesUpperBound: 4
    });
    const retryOptions = {
      ...this._retryOptions,
      retryCount: boundedMaxRetries,
      retryDelay: 500
    };
    const retryLogger = string => this._events.emit("retry", string + ", " + url + ", " + JSON.stringify(retryOptions));
    return retriable(async () => {
      const res = await this.fetch(url, this._getFetchOptions({
        method: "GET",
        fetchTimeout: requestTimeout ?? this.requestTimeout
      })).catch(e => {
        if (e.name === "AbortError") {
          throw new LangfuseFetchNetworkError("Fetch request timed out");
        }
        throw new LangfuseFetchNetworkError(e);
      });
      if (res.status >= 500) {
        throw new LangfuseFetchHttpError(res, await res.text());
      }
      const data = await res.json();
      return {
        fetchResult: res.status === 200 ? "success" : "failure",
        data
      };
    }, retryOptions, retryLogger);
  }
  _getBoundedMaxRetries(params) {
    const defaultMaxRetries = Math.max(params.defaultMaxRetries ?? 2, 0);
    const maxRetriesUpperBound = Math.max(params.maxRetriesUpperBound ?? 4, 0);
    if (params.maxRetries === undefined) {
      return defaultMaxRetries;
    }
    return Math.min(Math.max(params.maxRetries, 0), maxRetriesUpperBound);
  }
  /***
   *** QUEUEING AND FLUSHING
   ***/
  enqueue(type, body) {
    if (!this.enabled) {
      return;
    }
    // Sampling
    const traceId = this.parseTraceId(type, body);
    if (!traceId) {
      this._events.emit("warning", "Failed to parse traceID for sampling. Please open a Github issue in https://github.com/langfuse/langfuse/issues/new/choose");
    } else if (!isInSample(traceId, this.sampleRate)) {
      this._events.emit("debug", `Event with trace ID ${traceId} is out of sample. Skipping.`);
      return;
    }
    const promise = this.processEnqueueEvent(type, body);
    const promiseId = generateUUID();
    this.pendingEventProcessingPromises[promiseId] = promise;
    promise.catch(e => {
      this._events.emit("error", e);
    }).finally(() => {
      delete this.pendingEventProcessingPromises[promiseId];
    });
  }
  async processEnqueueEvent(type, body) {
    this.maskEventBodyInPlace(body);
    await this.processMediaInEvent(type, body);
    const finalEventBody = this.truncateEventBody(body, MAX_EVENT_SIZE_BYTES);
    try {
      JSON.stringify(finalEventBody);
    } catch (e) {
      this._events.emit("error", `Event Body for ${type} is not JSON-serializable: ${e}`);
      return;
    }
    const queue = this.getPersistedProperty(LangfusePersistedProperty.Queue) || [];
    queue.push({
      id: generateUUID(),
      type,
      timestamp: currentISOTime(),
      body: finalEventBody,
      // TODO: fix typecast. EventBody is not correctly narrowed to the correct type dictated by the 'type' property. This should be part of a larger type cleanup.
      metadata: undefined
    });
    this.setPersistedProperty(LangfusePersistedProperty.Queue, queue);
    this._events.emit(type, finalEventBody);
    // Flush queued events if we meet the flushAt length
    if (queue.length >= this.flushAt) {
      this.flush();
    }
    if (this.flushInterval && !this._flushTimer) {
      this._flushTimer = safeSetTimeout(() => this.flush(), this.flushInterval);
    }
  }
  maskEventBodyInPlace(body) {
    if (!this.mask) {
      return;
    }
    const maskableKeys = ["input", "output"];
    for (const key of maskableKeys) {
      if (key in body) {
        try {
          body[key] = this.mask({
            data: body[key]
          });
        } catch (e) {
          this._events.emit("error", `Error masking ${key}: ${e}`);
          body[key] = "<fully masked due to failed mask function>";
        }
      }
    }
  }
  /**
   * Truncates the event body if its byte size exceeds the specified maximum byte size.
   * Emits a warning event if truncation occurs.
   * The fields that may be truncated are: "input", "output", and "metadata".
   * The fields are truncated in the order of their size, from largest to smallest until the total byte size is within the limit.
   */
  truncateEventBody(body, maxByteSize) {
    const bodySize = this.getByteSize(body);
    if (bodySize <= maxByteSize) {
      return body;
    }
    this._events.emit("warning", `Event Body is too large (${bodySize} bytes) and will be truncated`);
    // Sort keys by size and truncate the largest keys first
    const keysToCheck = ["input", "output", "metadata"];
    const keySizes = keysToCheck.map(key => ({
      key,
      size: key in body ? this.getByteSize(body[key]) : 0
    })).sort((a, b) => b.size - a.size);
    let result = {
      ...body
    };
    let currentSize = bodySize;
    for (const {
      key,
      size
    } of keySizes) {
      if (currentSize > maxByteSize && Object.prototype.hasOwnProperty.call(result, key)) {
        result = {
          ...result,
          [key]: "<truncated due to size exceeding limit>"
        };
        this._events.emit("warning", `Truncated ${key} due to total size exceeding limit`);
        currentSize -= size;
      }
    }
    return result;
  }
  getByteSize(obj) {
    const serialized = JSON.stringify(obj);
    // Use TextEncoder if available, otherwise fallback to encodeURIComponent
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(serialized).length;
    } else {
      return encodeURIComponent(serialized).replace(/%[A-F\d]{2}/g, "U").length;
    }
  }
  async processMediaInEvent(type, body) {
    if (!body) {
      return;
    }
    const traceId = this.parseTraceId(type, body);
    if (!traceId) {
      this._events.emit("warning", "traceId is required for media upload");
      return;
    }
    const observationId = (type.includes("generation") || type.includes("span")) && body.id ? body.id : undefined;
    await Promise.all(["input", "output", "metadata"].map(async field => {
      if (body[field]) {
        body[field] = (await this.findAndProcessMedia({
          data: body[field],
          traceId,
          observationId,
          field
        }).catch(e => {
          this._events.emit("error", `Error processing multimodal event: ${e}`);
        })) ?? body[field];
      }
    }));
  }
  parseTraceId(type, body) {
    return "traceId" in body ? body.traceId : type.includes("trace") ? body.id : undefined;
  }
  async findAndProcessMedia({
    data,
    traceId,
    observationId,
    field
  }) {
    const seenObjects = new WeakMap();
    const maxLevels = 10;
    const processRecursively = async (data, level) => {
      if (typeof data === "string" && data.startsWith("data:")) {
        const media = new LangfuseMedia({
          base64DataUri: data
        });
        await this.processMediaItem({
          media,
          traceId,
          observationId,
          field
        });
        return media;
      }
      if (typeof data !== "object" || data === null) {
        return data;
      }
      // Use WeakMap to detect cycles
      if (seenObjects.has(data) || level > maxLevels) {
        return data;
      }
      seenObjects.set(data, true);
      if (data instanceof LangfuseMedia || Object.prototype.toString.call(data) === "[object LangfuseMedia]") {
        await this.processMediaItem({
          media: data,
          traceId,
          observationId,
          field
        });
        return data;
      }
      if (Array.isArray(data)) {
        return await Promise.all(data.map(item => processRecursively(item, level + 1)));
      }
      // Parse OpenAI input audio data which is passed as base64 string NOT in the data uri format
      if (typeof data === "object" && data !== null) {
        if ("input_audio" in data && typeof data["input_audio"] === "object" && "data" in data.input_audio) {
          const media = new LangfuseMedia({
            base64DataUri: `data:audio/${data.input_audio["format"] || "wav"};base64,${data.input_audio.data}`
          });
          await this.processMediaItem({
            media,
            traceId,
            observationId,
            field
          });
          return {
            ...data,
            input_audio: {
              ...data.input_audio,
              data: media
            }
          };
        }
        // OpenAI output audio data is passed as base64 string NOT in the data uri format
        if ("audio" in data && typeof data["audio"] === "object" && "data" in data.audio) {
          const media = new LangfuseMedia({
            base64DataUri: `data:audio/${data.audio["format"] || "wav"};base64,${data.audio.data}`
          });
          await this.processMediaItem({
            media,
            traceId,
            observationId,
            field
          });
          return {
            ...data,
            audio: {
              ...data.audio,
              data: media
            }
          };
        }
        // Recursively process nested objects
        return Object.fromEntries(await Promise.all(Object.entries(data).map(async ([key, value]) => [key, await processRecursively(value, level + 1)])));
      }
      return data;
    };
    return await processRecursively(data, 1);
  }
  async processMediaItem({
    media,
    traceId,
    observationId,
    field
  }) {
    try {
      if (!media.contentLength || !media._contentType || !media.contentSha256Hash || !media._contentBytes) {
        return;
      }
      const getUploadUrlBody = {
        contentLength: media.contentLength,
        traceId,
        observationId,
        field,
        contentType: media._contentType,
        sha256Hash: media.contentSha256Hash
      };
      const fetchResponse = await this.fetch(`${this.baseUrl}/api/public/media`, this._getFetchOptions({
        method: "POST",
        body: JSON.stringify(getUploadUrlBody)
      }));
      const uploadUrlResponse = await fetchResponse.json();
      const {
        uploadUrl,
        mediaId
      } = uploadUrlResponse;
      media._mediaId = mediaId;
      if (uploadUrl) {
        this._events.emit("debug", `Uploading media ${mediaId}`);
        const startTime = Date.now();
        const uploadResponse = await this.uploadMediaWithBackoff({
          uploadUrl,
          contentBytes: media._contentBytes,
          contentType: media._contentType,
          contentSha256Hash: media.contentSha256Hash,
          maxRetries: 3,
          baseDelay: 1000
        });
        if (!uploadResponse) {
          throw Error("Media upload process failed");
        }
        const patchMediaBody = {
          uploadedAt: new Date().toISOString(),
          uploadHttpStatus: uploadResponse.status,
          uploadHttpError: await uploadResponse.text(),
          uploadTimeMs: Date.now() - startTime
        };
        await this.fetch(`${this.baseUrl}/api/public/media/${mediaId}`, this._getFetchOptions({
          method: "PATCH",
          body: JSON.stringify(patchMediaBody)
        }));
        this._events.emit("debug", `Media upload status reported for ${mediaId}`);
      } else {
        this._events.emit("debug", `Media ${mediaId} already uploaded`);
      }
    } catch (err) {
      this._events.emit("error", `Error processing media item: ${err}`);
    }
  }
  async uploadMediaWithBackoff(params) {
    const {
      uploadUrl,
      contentType,
      contentSha256Hash,
      contentBytes,
      maxRetries,
      baseDelay
    } = params;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const uploadResponse = await this.fetch(uploadUrl, {
          method: "PUT",
          body: contentBytes,
          headers: {
            "Content-Type": contentType,
            "x-amz-checksum-sha256": contentSha256Hash,
            "x-ms-blob-type": "BlockBlob"
          }
        });
        if (attempt < maxRetries && uploadResponse.status !== 200 && uploadResponse.status !== 201) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }
        return uploadResponse;
      } catch (e) {
        if (attempt === maxRetries) {
          throw e;
        }
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }
  }
  /**
   * Asynchronously flushes all events that are not yet sent to the server.
   * This function always resolves, even if there were errors when flushing.
   * Errors are emitted as "error" events and the promise resolves.
   *
   * @returns {Promise<void>} A promise that resolves when the flushing is completed.
   */
  async flushAsync() {
    await Promise.all(Object.values(this.pendingEventProcessingPromises)).catch(e => {
      logIngestionError(e);
    });
    return new Promise((resolve, _reject) => {
      try {
        this.flush((err, data) => {
          if (err) {
            logIngestionError(err);
            resolve();
          } else {
            resolve(data);
          }
        });
        // safeguard against unexpected synchronous errors
      } catch (e) {
        console.error("[Langfuse SDK] Error while flushing Langfuse", e);
      }
    });
  }
  // Flushes all events that are not yet sent to the server
  flush(callback) {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    const queue = this.getPersistedProperty(LangfusePersistedProperty.Queue) || [];
    if (!queue.length) {
      return callback?.();
    }
    const items = queue.splice(0, this.flushAt);
    const {
      processedItems,
      remainingItems
    } = this.processQueueItems(items, MAX_EVENT_SIZE_BYTES, MAX_BATCH_SIZE_BYTES);
    this.setPersistedProperty(LangfusePersistedProperty.Queue, [...remainingItems, ...queue]);
    const promiseUUID = generateUUID();
    const done = err => {
      if (err) {
        this._events.emit("warning", err);
      }
      callback?.(err, items);
      this._events.emit("flush", items);
    };
    // If local event export is enabled, we don't send the events to the server, but instead store them in the localEventExportMap
    if (this.isLocalEventExportEnabled && this.projectId) {
      if (!this.localEventExportMap.has(this.projectId)) {
        this.localEventExportMap.set(this.projectId, [...items]);
      } else {
        this.localEventExportMap.get(this.projectId)?.push(...items);
      }
      done();
      return;
    }
    const payload = JSON.stringify({
      batch: processedItems,
      metadata: {
        batch_size: processedItems.length,
        sdk_integration: this.sdkIntegration,
        sdk_version: this.getLibraryVersion(),
        sdk_variant: this.getLibraryId(),
        public_key: this.publicKey,
        sdk_name: "langfuse-js"
      }
    }); // implicit conversion also of dates to strings
    const url = `${this.baseUrl}/api/public/ingestion`;
    const fetchOptions = this._getFetchOptions({
      method: "POST",
      body: payload
    });
    const requestPromise = this.fetchWithRetry(url, fetchOptions).then(() => done()).catch(err => {
      done(err);
    });
    this.pendingIngestionPromises[promiseUUID] = requestPromise;
    requestPromise.finally(() => {
      delete this.pendingIngestionPromises[promiseUUID];
    });
  }
  processQueueItems(queue, MAX_MSG_SIZE, BATCH_SIZE_LIMIT) {
    let totalSize = 0;
    const processedItems = [];
    const remainingItems = [];
    for (let i = 0; i < queue.length; i++) {
      try {
        const itemSize = new Blob([JSON.stringify(queue[i])]).size;
        // discard item if it exceeds the maximum size per event
        if (itemSize > MAX_MSG_SIZE) {
          console.warn(`Item exceeds size limit (size: ${itemSize}), dropping item.`);
          continue;
        }
        // if adding the next item would exceed the batch size limit, stop processing
        if (totalSize + itemSize >= BATCH_SIZE_LIMIT) {
          console.debug(`hit batch size limit (size: ${totalSize + itemSize})`);
          remainingItems.push(...queue.slice(i));
          console.log(`Remaining items: ${remainingItems.length}`);
          console.log(`processes items: ${processedItems.length}`);
          break;
        }
        // only add the item if it passes both requirements
        totalSize += itemSize;
        processedItems.push(queue[i]);
      } catch (error) {
        this._events.emit("error", error);
        remainingItems.push(...queue.slice(i));
        break;
      }
    }
    return {
      processedItems,
      remainingItems
    };
  }
  _getFetchOptions(p) {
    const fetchOptions = {
      method: p.method,
      headers: {
        "Content-Type": "application/json",
        "X-Langfuse-Sdk-Name": "langfuse-js",
        "X-Langfuse-Sdk-Version": this.getLibraryVersion(),
        "X-Langfuse-Sdk-Variant": this.getLibraryId(),
        "X-Langfuse-Sdk-Integration": this.sdkIntegration,
        "X-Langfuse-Public-Key": this.publicKey,
        ...this.additionalHeaders,
        ...this.constructAuthorizationHeader(this.publicKey, this.secretKey)
      },
      body: p.body,
      ...(p.fetchTimeout !== undefined ? {
        signal: AbortSignal.timeout(p.fetchTimeout)
      } : {})
    };
    return fetchOptions;
  }
  constructAuthorizationHeader(publicKey, secretKey) {
    if (secretKey === undefined) {
      return {
        Authorization: "Bearer " + publicKey
      };
    } else {
      const encodedCredentials = typeof btoa === "function" ?
      // btoa() is available, the code is running in a browser or edge environment
      btoa(publicKey + ":" + secretKey) :
      // btoa() is not available, the code is running in Node.js
      Buffer.from(publicKey + ":" + secretKey).toString("base64");
      return {
        Authorization: "Basic " + encodedCredentials
      };
    }
  }
  async fetchWithRetry(url, options, retryOptions) {
    AbortSignal.timeout ??= function timeout(ms) {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), ms);
      return ctrl.signal;
    };
    return await retriable(async () => {
      let res = null;
      try {
        res = await this.fetch(url, {
          signal: AbortSignal.timeout(this.requestTimeout),
          ...options
        });
      } catch (e) {
        // fetch will only throw on network errors or on timeouts
        throw new LangfuseFetchNetworkError(e);
      }
      if (res.status < 200 || res.status >= 400) {
        const body = await res.json();
        throw new LangfuseFetchHttpError(res, JSON.stringify(body));
      }
      const returnBody = await res.json();
      if (res.status === 207 && returnBody.errors.length > 0) {
        throw new LangfuseFetchHttpError(res, JSON.stringify(returnBody.errors));
      }
      return res;
    }, {
      ...this._retryOptions,
      ...retryOptions
    }, string => this._events.emit("retry", string + ", " + url + ", " + JSON.stringify(options)));
  }
  async fetchAndLogErrors(url, options) {
    const res = await this.fetch(url, options);
    // 429 responses do not have a JSON body, so attempting to execute `json()`
    // will throw and error before the 429 is logged.
    const data = res.status === 429 ? await res.text() : await res.json();
    if (res.status < 200 || res.status >= 400) {
      logIngestionError(new LangfuseFetchHttpError(res, JSON.stringify(data)));
    }
    return data;
  }
  async shutdownAsync() {
    clearTimeout(this._flushTimer);
    try {
      await this.flushAsync();
      await Promise.all(Object.values(this.pendingIngestionPromises).map(x => x.catch(() => {
        // ignore errors as we are shutting down and can't deal with them anyways.
      })));
      // flush again in case there are new events that were added while we were waiting for the pending promises to resolve
      await this.flushAsync();
    } catch (e) {
      console.error("[Langfuse SDK] Error while shutting down Langfuse", e);
    }
  }
  async _exportLocalEvents(projectId) {
    if (this.isLocalEventExportEnabled) {
      clearTimeout(this._flushTimer);
      await this.flushAsync();
      const events = this.localEventExportMap.get(projectId) ?? [];
      this.localEventExportMap.delete(projectId);
      return events;
    } else {
      this._events.emit("error", "Local event exports are disabled, but _exportLocalEvents() was called.");
      return [];
    }
  }
  shutdown() {
    console.warn("shutdown() is deprecated. It does not wait for all events to be processed. Please use shutdownAsync() instead.");
    void this.shutdownAsync();
  }
  async awaitAllQueuedAndPendingRequests() {
    clearTimeout(this._flushTimer);
    await this.flushAsync();
    await Promise.all(Object.values(this.pendingIngestionPromises));
  }
}
class LangfuseWebStateless extends LangfuseCoreStateless {
  constructor(params) {
    const {
      flushAt,
      flushInterval,
      publicKey,
      enabled,
      ...rest
    } = params;
    let isObservabilityEnabled = enabled === false ? false : true;
    if (isObservabilityEnabled && !publicKey) {
      isObservabilityEnabled = false;
      console.warn("Langfuse public key not passed to constructor and not set as 'LANGFUSE_PUBLIC_KEY' environment variable. No observability data will be sent to Langfuse.");
    }
    super({
      ...rest,
      publicKey,
      flushAt: flushAt ?? 1,
      flushInterval: flushInterval ?? 0,
      enabled: isObservabilityEnabled
    });
  }
  async score(body) {
    this.scoreStateless(body);
    await this.awaitAllQueuedAndPendingRequests();
    return this;
  }
}
class LangfuseCore extends LangfuseCoreStateless {
  constructor(params) {
    const {
      publicKey,
      secretKey,
      enabled,
      _isLocalEventExportEnabled
    } = params;
    let isObservabilityEnabled = enabled === false ? false : true;
    if (_isLocalEventExportEnabled) {
      isObservabilityEnabled = true;
    } else if (!secretKey) {
      isObservabilityEnabled = false;
      if (enabled !== false) {
        console.warn("Langfuse secret key was not passed to constructor or not set as 'LANGFUSE_SECRET_KEY' environment variable. No observability data will be sent to Langfuse.");
      }
    } else if (!publicKey) {
      isObservabilityEnabled = false;
      if (enabled !== false) {
        console.warn("Langfuse public key was not passed to constructor or not set as 'LANGFUSE_PUBLIC_KEY' environment variable. No observability data will be sent to Langfuse.");
      }
    }
    super({
      ...params,
      enabled: isObservabilityEnabled
    });
    this._promptCache = new LangfusePromptCache();
  }
  trace(body) {
    const id = this.traceStateless(body ?? {});
    const t = new LangfuseTraceClient(this, id);
    if (getEnv("DEFER") && body) {
      try {
        const deferRuntime = getEnv("__deferRuntime");
        if (deferRuntime) {
          deferRuntime.langfuseTraces([{
            id: id,
            name: body.name || "",
            url: t.getTraceUrl()
          }]);
        }
      } catch {}
    }
    return t;
  }
  span(body) {
    const traceId = body.traceId || this.traceStateless({
      name: body.name
    });
    const id = this.spanStateless({
      ...body,
      traceId
    });
    return new LangfuseSpanClient(this, id, traceId);
  }
  generation(body) {
    const traceId = body.traceId || this.traceStateless({
      name: body.name
    });
    const id = this.generationStateless({
      ...body,
      traceId
    });
    return new LangfuseGenerationClient(this, id, traceId);
  }
  event(body) {
    const traceId = body.traceId || this.traceStateless({
      name: body.name
    });
    const id = this.eventStateless({
      ...body,
      traceId
    });
    return new LangfuseEventClient(this, id, traceId);
  }
  score(body) {
    this.scoreStateless(body);
    return this;
  }
  async getDataset(name, options) {
    const dataset = await this._getDataset(name);
    const items = [];
    let page = 1;
    while (true) {
      const itemsResponse = await this._getDatasetItems({
        datasetName: name,
        limit: options?.fetchItemsPageSize ?? 50,
        page
      });
      items.push(...itemsResponse.data);
      if (itemsResponse.meta.totalPages <= page) {
        break;
      }
      page++;
    }
    const returnDataset = {
      ...dataset,
      description: dataset.description ?? undefined,
      metadata: dataset.metadata ?? undefined,
      items: items.map(item => ({
        ...item,
        link: async (obj, runName, runArgs) => {
          await this.awaitAllQueuedAndPendingRequests();
          const data = await this.createDatasetRunItem({
            runName,
            datasetItemId: item.id,
            observationId: obj.observationId,
            traceId: obj.traceId,
            runDescription: runArgs?.description,
            metadata: runArgs?.metadata
          });
          return data;
        }
      }))
    };
    return returnDataset;
  }
  async createPrompt(body) {
    const labels = body.labels ?? [];
    const promptResponse = body.type === "chat" // necessary to get types right here
    ? await this.createPromptStateless({
      ...body,
      prompt: body.prompt.map(item => {
        if ("type" in item && item.type === ChatMessageType.Placeholder) {
          return {
            type: ChatMessageType.Placeholder,
            name: item.name
          };
        } else {
          // Handle regular ChatMessage (without type field) from API
          return {
            type: ChatMessageType.ChatMessage,
            ...item
          };
        }
      }),
      labels: body.isActive ? [...new Set([...labels, "production"])] : labels // backward compatibility for isActive
    }) : await this.createPromptStateless({
      ...body,
      type: body.type ?? "text",
      labels: body.isActive ? [...new Set([...labels, "production"])] : labels // backward compatibility for isActive
    });
    if (promptResponse.type === "chat") {
      return new ChatPromptClient(promptResponse);
    }
    return new TextPromptClient(promptResponse);
  }
  async updatePrompt(body) {
    const newPrompt = await this.updatePromptStateless(body);
    this._promptCache.invalidate(body.name);
    return newPrompt;
  }
  async getPrompt(name, version, options) {
    const cacheKey = this._getPromptCacheKey({
      name,
      version,
      label: options?.label
    });
    const cachedPrompt = this._promptCache.getIncludingExpired(cacheKey);
    if (!cachedPrompt || options?.cacheTtlSeconds === 0) {
      try {
        return await this._fetchPromptAndUpdateCache({
          name,
          version,
          label: options?.label,
          cacheTtlSeconds: options?.cacheTtlSeconds,
          maxRetries: options?.maxRetries,
          fetchTimeout: options?.fetchTimeoutMs
        });
      } catch (err) {
        if (options?.fallback) {
          const sharedFallbackParams = {
            name,
            version: version ?? 0,
            labels: options.label ? [options.label] : [],
            cacheTtlSeconds: options?.cacheTtlSeconds,
            config: {},
            tags: []
          };
          if (options.type === "chat") {
            return new ChatPromptClient({
              ...sharedFallbackParams,
              type: "chat",
              prompt: options.fallback.map(msg => ({
                type: ChatMessageType.ChatMessage,
                ...msg
              }))
            }, true);
          } else {
            return new TextPromptClient({
              ...sharedFallbackParams,
              type: "text",
              prompt: options.fallback
            }, true);
          }
        }
        throw err;
      }
    }
    if (cachedPrompt.isExpired) {
      // If the cache is not currently being refreshed, start refreshing it and register the promise in the cache
      if (!this._promptCache.isRefreshing(cacheKey)) {
        const refreshPromptPromise = this._fetchPromptAndUpdateCache({
          name,
          version,
          label: options?.label,
          cacheTtlSeconds: options?.cacheTtlSeconds,
          maxRetries: options?.maxRetries,
          fetchTimeout: options?.fetchTimeoutMs
        }).catch(() => {
          console.warn(`Failed to refresh prompt cache '${cacheKey}', stale cache will be used until next refresh succeeds.`);
        });
        this._promptCache.addRefreshingPromise(cacheKey, refreshPromptPromise);
      }
      return cachedPrompt.value;
    }
    return cachedPrompt.value;
  }
  _getPromptCacheKey(params) {
    const {
      name,
      version,
      label
    } = params;
    const parts = [name];
    if (version !== undefined) {
      parts.push("version:" + version.toString());
    } else if (label !== undefined) {
      parts.push("label:" + label);
    } else {
      parts.push("label:production");
    }
    return parts.join("-");
  }
  async _fetchPromptAndUpdateCache(params) {
    const cacheKey = this._getPromptCacheKey(params);
    try {
      const {
        name,
        version,
        cacheTtlSeconds,
        label,
        maxRetries,
        fetchTimeout
      } = params;
      const {
        data,
        fetchResult
      } = await this.getPromptStateless(name, version, label, maxRetries, fetchTimeout);
      if (fetchResult === "failure") {
        throw Error(data.message ?? "Internal error while fetching prompt");
      }
      let prompt;
      if (data.type === "chat") {
        prompt = new ChatPromptClient(data);
      } else {
        prompt = new TextPromptClient(data);
      }
      this._promptCache.set(cacheKey, prompt, cacheTtlSeconds);
      return prompt;
    } catch (error) {
      console.error(`[Langfuse SDK] Error while fetching prompt '${cacheKey}':`, error);
      throw error;
    }
  }
  async fetchMedia(id) {
    return await this._fetchMedia(id);
  }
  /**
   * Replaces the media reference strings in an object with base64 data URIs for the media content.
   *
   * This method recursively traverses an object (up to a maximum depth of 10) looking for media reference strings
   * in the format "@@@langfuseMedia:...@@@". When found, it fetches the actual media content using the provided
   * Langfuse client and replaces the reference string with a base64 data URI.
   *
   * If fetching media content fails for a reference string, a warning is logged and the reference string is left unchanged.
   *
   * @param params - Configuration object
   * @param params.obj - The object to process. Can be a primitive value, array, or nested object
   * @param params.langfuseClient - Langfuse client instance used to fetch media content
   * @param params.resolveWith - The representation of the media content to replace the media reference string with. Currently only "base64DataUri" is supported.
   * @param params.maxDepth - Optional. Default is 10. The maximum depth to traverse the object.
   *
   * @returns A deep copy of the input object with all media references replaced with base64 data URIs where possible
   *
   * @example
   * ```typescript
   * const obj = {
   *   image: "@@@langfuseMedia:type=image/jpeg|id=123|source=bytes@@@",
   *   nested: {
   *     pdf: "@@@langfuseMedia:type=application/pdf|id=456|source=bytes@@@"
   *   }
   * };
   *
   * const result = await LangfuseMedia.resolveMediaReferences({
   *   obj,
   *   langfuseClient
   * });
   *
   * // Result:
   * // {
   * //   image: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
   * //   nested: {
   * //     pdf: "data:application/pdf;base64,JVBERi0xLjcK..."
   * //   }
   * // }
   * ```
   */
  async resolveMediaReferences(params) {
    const {
      obj,
      ...rest
    } = params;
    return LangfuseMedia.resolveMediaReferences({
      ...rest,
      langfuseClient: this,
      obj
    });
  }
  _updateSpan(body) {
    this.updateSpanStateless(body);
    return this;
  }
  _updateGeneration(body) {
    this.updateGenerationStateless(body);
    return this;
  }
}
class LangfuseObjectClient {
  constructor({
    client,
    id,
    traceId,
    observationId
  }) {
    this.client = client;
    this.id = id;
    this.traceId = traceId;
    this.observationId = observationId;
  }
  event(body) {
    return this.client.event({
      ...body,
      traceId: this.traceId,
      parentObservationId: this.observationId
    });
  }
  span(body) {
    return this.client.span({
      ...body,
      traceId: this.traceId,
      parentObservationId: this.observationId
    });
  }
  generation(body) {
    return this.client.generation({
      ...body,
      traceId: this.traceId,
      parentObservationId: this.observationId
    });
  }
  score(body) {
    this.client.score({
      ...body,
      traceId: this.traceId,
      observationId: this.observationId
    });
    return this;
  }
  getTraceUrl() {
    return `${this.client.baseUrl}/trace/${this.traceId}`;
  }
}
class LangfuseTraceClient extends LangfuseObjectClient {
  constructor(client, traceId) {
    super({
      client,
      id: traceId,
      traceId,
      observationId: null
    });
  }
  update(body) {
    this.client.trace({
      ...body,
      id: this.id
    });
    return this;
  }
}
class LangfuseObservationClient extends LangfuseObjectClient {
  constructor(client, id, traceId) {
    super({
      client,
      id,
      traceId,
      observationId: id
    });
  }
}
class LangfuseSpanClient extends LangfuseObservationClient {
  constructor(client, id, traceId) {
    super(client, id, traceId);
  }
  update(body) {
    this.client._updateSpan({
      ...body,
      id: this.id,
      traceId: this.traceId
    });
    return this;
  }
  end(body) {
    this.client._updateSpan({
      ...body,
      id: this.id,
      traceId: this.traceId,
      endTime: new Date()
    });
    return this;
  }
}
class LangfuseGenerationClient extends LangfuseObservationClient {
  constructor(client, id, traceId) {
    super(client, id, traceId);
  }
  update(body) {
    this.client._updateGeneration({
      ...body,
      id: this.id,
      traceId: this.traceId
    });
    return this;
  }
  end(body) {
    this.client._updateGeneration({
      ...body,
      id: this.id,
      traceId: this.traceId,
      endTime: new Date()
    });
    return this;
  }
}
class LangfuseEventClient extends LangfuseObservationClient {
  constructor(client, id, traceId) {
    super(client, id, traceId);
  }
}

export { ChatMessageType, ChatPromptClient, LangfuseCore, LangfuseEventClient, LangfuseGenerationClient, LangfuseMedia, LangfuseMemoryStorage, LangfuseObjectClient, LangfusePersistedProperty, LangfuseSpanClient, LangfuseTraceClient, LangfuseWebStateless, TextPromptClient, utils };
//# sourceMappingURL=index.mjs.map
