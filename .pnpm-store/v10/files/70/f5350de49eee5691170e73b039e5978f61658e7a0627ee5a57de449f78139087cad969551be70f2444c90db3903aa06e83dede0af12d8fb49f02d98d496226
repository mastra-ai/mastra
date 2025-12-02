"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunkFW45TRCBjs = require('./chunk-FW45TRCB.js');






var _chunk57RIRQUYjs = require('./chunk-57RIRQUY.js');



var _chunk2HUMWGRDjs = require('./chunk-2HUMWGRD.js');



var _chunkJQ2S7G56js = require('./chunk-JQ2S7G56.js');

// src/interceptors/fetch/index.ts
var _outvariant = require('outvariant');
var _until = require('@open-draft/until');
var _deferredpromise = require('@open-draft/deferred-promise');

// src/interceptors/fetch/utils/createNetworkError.ts
function createNetworkError(cause) {
  return Object.assign(new TypeError("Failed to fetch"), {
    cause
  });
}

// src/interceptors/fetch/utils/followRedirect.ts
var REQUEST_BODY_HEADERS = [
  "content-encoding",
  "content-language",
  "content-location",
  "content-type",
  "content-length"
];
var kRedirectCount = Symbol("kRedirectCount");
async function followFetchRedirect(request, response) {
  if (response.status !== 303 && request.body != null) {
    return Promise.reject(createNetworkError());
  }
  const requestUrl = new URL(request.url);
  let locationUrl;
  try {
    locationUrl = new URL(response.headers.get("location"), request.url);
  } catch (error) {
    return Promise.reject(createNetworkError(error));
  }
  if (!(locationUrl.protocol === "http:" || locationUrl.protocol === "https:")) {
    return Promise.reject(
      createNetworkError("URL scheme must be a HTTP(S) scheme")
    );
  }
  if (Reflect.get(request, kRedirectCount) > 20) {
    return Promise.reject(createNetworkError("redirect count exceeded"));
  }
  Object.defineProperty(request, kRedirectCount, {
    value: (Reflect.get(request, kRedirectCount) || 0) + 1
  });
  if (request.mode === "cors" && (locationUrl.username || locationUrl.password) && !sameOrigin(requestUrl, locationUrl)) {
    return Promise.reject(
      createNetworkError('cross origin not allowed for request mode "cors"')
    );
  }
  const requestInit = {};
  if ([301, 302].includes(response.status) && request.method === "POST" || response.status === 303 && !["HEAD", "GET"].includes(request.method)) {
    requestInit.method = "GET";
    requestInit.body = null;
    REQUEST_BODY_HEADERS.forEach((headerName) => {
      request.headers.delete(headerName);
    });
  }
  if (!sameOrigin(requestUrl, locationUrl)) {
    request.headers.delete("authorization");
    request.headers.delete("proxy-authorization");
    request.headers.delete("cookie");
    request.headers.delete("host");
  }
  requestInit.headers = request.headers;
  const finalResponse = await fetch(new Request(locationUrl, requestInit));
  Object.defineProperty(finalResponse, "redirected", {
    value: true,
    configurable: true
  });
  return finalResponse;
}
function sameOrigin(left, right) {
  if (left.origin === right.origin && left.origin === "null") {
    return true;
  }
  if (left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port) {
    return true;
  }
  return false;
}

// src/interceptors/fetch/utils/brotli-decompress.browser.ts
var BrotliDecompressionStream = class extends TransformStream {
  constructor() {
    console.warn(
      "[Interceptors]: Brotli decompression of response streams is not supported in the browser"
    );
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });
  }
};

// src/interceptors/fetch/utils/decompression.ts
var PipelineStream = class extends TransformStream {
  constructor(transformStreams, ...strategies) {
    super({}, ...strategies);
    const readable = [super.readable, ...transformStreams].reduce(
      (readable2, transform) => readable2.pipeThrough(transform)
    );
    Object.defineProperty(this, "readable", {
      get() {
        return readable;
      }
    });
  }
};
function parseContentEncoding(contentEncoding) {
  return contentEncoding.toLowerCase().split(",").map((coding) => coding.trim());
}
function createDecompressionStream(contentEncoding) {
  if (contentEncoding === "") {
    return null;
  }
  const codings = parseContentEncoding(contentEncoding);
  if (codings.length === 0) {
    return null;
  }
  const transformers = codings.reduceRight(
    (transformers2, coding) => {
      if (coding === "gzip" || coding === "x-gzip") {
        return transformers2.concat(new DecompressionStream("gzip"));
      } else if (coding === "deflate") {
        return transformers2.concat(new DecompressionStream("deflate"));
      } else if (coding === "br") {
        return transformers2.concat(new BrotliDecompressionStream());
      } else {
        transformers2.length = 0;
      }
      return transformers2;
    },
    []
  );
  return new PipelineStream(transformers);
}
function decompressResponse(response) {
  if (response.body === null) {
    return null;
  }
  const decompressionStream = createDecompressionStream(
    response.headers.get("content-encoding") || ""
  );
  if (!decompressionStream) {
    return null;
  }
  response.body.pipeTo(decompressionStream.writable);
  return decompressionStream.readable;
}

// src/interceptors/fetch/index.ts
var _FetchInterceptor = class extends _chunkJQ2S7G56js.Interceptor {
  constructor() {
    super(_FetchInterceptor.symbol);
  }
  checkEnvironment() {
    return _chunk2HUMWGRDjs.hasConfigurableGlobal.call(void 0, "fetch");
  }
  async setup() {
    const pureFetch = globalThis.fetch;
    _outvariant.invariant.call(void 0, 
      !pureFetch[_chunk57RIRQUYjs.IS_PATCHED_MODULE],
      'Failed to patch the "fetch" module: already patched.'
    );
    globalThis.fetch = async (input, init) => {
      const requestId = _chunkJQ2S7G56js.createRequestId.call(void 0, );
      const resolvedInput = typeof input === "string" && typeof location !== "undefined" && !_chunk57RIRQUYjs.canParseUrl.call(void 0, input) ? new URL(input, location.href) : input;
      const request = new Request(resolvedInput, init);
      if (input instanceof Request) {
        _chunk57RIRQUYjs.setRawRequest.call(void 0, request, input);
      }
      const responsePromise = new (0, _deferredpromise.DeferredPromise)();
      const controller = new (0, _chunk57RIRQUYjs.RequestController)(request, {
        passthrough: async () => {
          this.logger.info("request has not been handled, passthrough...");
          const requestCloneForResponseEvent = request.clone();
          const { error: responseError, data: originalResponse } = await _until.until.call(void 0, 
            () => pureFetch(request)
          );
          if (responseError) {
            return responsePromise.reject(responseError);
          }
          this.logger.info("original fetch performed", originalResponse);
          if (this.emitter.listenerCount("response") > 0) {
            this.logger.info('emitting the "response" event...');
            const responseClone = originalResponse.clone();
            await _chunk2HUMWGRDjs.emitAsync.call(void 0, this.emitter, "response", {
              response: responseClone,
              isMockedResponse: false,
              request: requestCloneForResponseEvent,
              requestId
            });
          }
          responsePromise.resolve(originalResponse);
        },
        respondWith: async (rawResponse) => {
          if (_chunkFW45TRCBjs.isResponseError.call(void 0, rawResponse)) {
            this.logger.info("request has errored!", { response: rawResponse });
            responsePromise.reject(createNetworkError(rawResponse));
            return;
          }
          this.logger.info("received mocked response!", {
            rawResponse
          });
          const decompressedStream = decompressResponse(rawResponse);
          const response = decompressedStream === null ? rawResponse : new (0, _chunk57RIRQUYjs.FetchResponse)(decompressedStream, rawResponse);
          _chunk57RIRQUYjs.FetchResponse.setUrl(request.url, response);
          if (_chunk57RIRQUYjs.FetchResponse.isRedirectResponse(response.status)) {
            if (request.redirect === "error") {
              responsePromise.reject(createNetworkError("unexpected redirect"));
              return;
            }
            if (request.redirect === "follow") {
              followFetchRedirect(request, response).then(
                (response2) => {
                  responsePromise.resolve(response2);
                },
                (reason) => {
                  responsePromise.reject(reason);
                }
              );
              return;
            }
          }
          if (this.emitter.listenerCount("response") > 0) {
            this.logger.info('emitting the "response" event...');
            await _chunk2HUMWGRDjs.emitAsync.call(void 0, this.emitter, "response", {
              // Clone the mocked response for the "response" event listener.
              // This way, the listener can read the response and not lock its body
              // for the actual fetch consumer.
              response: response.clone(),
              isMockedResponse: true,
              request,
              requestId
            });
          }
          responsePromise.resolve(response);
        },
        errorWith: (reason) => {
          this.logger.info("request has been aborted!", { reason });
          responsePromise.reject(reason);
        }
      });
      this.logger.info("[%s] %s", request.method, request.url);
      this.logger.info("awaiting for the mocked response...");
      this.logger.info(
        'emitting the "request" event for %s listener(s)...',
        this.emitter.listenerCount("request")
      );
      await _chunkFW45TRCBjs.handleRequest.call(void 0, {
        request,
        requestId,
        emitter: this.emitter,
        controller
      });
      return responsePromise;
    };
    Object.defineProperty(globalThis.fetch, _chunk57RIRQUYjs.IS_PATCHED_MODULE, {
      enumerable: true,
      configurable: true,
      value: true
    });
    this.subscriptions.push(() => {
      Object.defineProperty(globalThis.fetch, _chunk57RIRQUYjs.IS_PATCHED_MODULE, {
        value: void 0
      });
      globalThis.fetch = pureFetch;
      this.logger.info(
        'restored native "globalThis.fetch"!',
        globalThis.fetch.name
      );
    });
  }
};
var FetchInterceptor = _FetchInterceptor;
FetchInterceptor.symbol = Symbol("fetch");



exports.FetchInterceptor = FetchInterceptor;
//# sourceMappingURL=chunk-MNT2FUCH.js.map