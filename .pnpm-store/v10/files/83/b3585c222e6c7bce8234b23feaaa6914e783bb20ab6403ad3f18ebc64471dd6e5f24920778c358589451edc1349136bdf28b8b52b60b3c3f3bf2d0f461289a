"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunkJQ2S7G56js = require('./chunk-JQ2S7G56.js');

// src/glossary.ts
var IS_PATCHED_MODULE = Symbol("isPatchedModule");

// src/RequestController.ts
var _deferredpromise = require('@open-draft/deferred-promise');
var _outvariant = require('outvariant');

// src/InterceptorError.ts
var InterceptorError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InterceptorError";
    Object.setPrototypeOf(this, InterceptorError.prototype);
  }
};

// src/RequestController.ts
var _handled, handled_get;
var _RequestController = class {
  constructor(request, source) {
    this.request = request;
    this.source = source;
    _chunkJQ2S7G56js.__privateAdd.call(void 0, this, _handled);
    this.readyState = _RequestController.PENDING;
    this.handled = new (0, _deferredpromise.DeferredPromise)();
  }
  /**
   * Perform this request as-is.
   */
  async passthrough() {
    _outvariant.invariant.as(
      InterceptorError,
      this.readyState === _RequestController.PENDING,
      'Failed to passthrough the "%s %s" request: the request has already been handled',
      this.request.method,
      this.request.url
    );
    this.readyState = _RequestController.PASSTHROUGH;
    await this.source.passthrough();
    _chunkJQ2S7G56js.__privateGet.call(void 0, this, _handled, handled_get).resolve();
  }
  /**
   * Respond to this request with the given `Response` instance.
   *
   * @example
   * controller.respondWith(new Response())
   * controller.respondWith(Response.json({ id }))
   * controller.respondWith(Response.error())
   */
  respondWith(response) {
    _outvariant.invariant.as(
      InterceptorError,
      this.readyState === _RequestController.PENDING,
      'Failed to respond to the "%s %s" request with "%d %s": the request has already been handled (%d)',
      this.request.method,
      this.request.url,
      response.status,
      response.statusText || "OK",
      this.readyState
    );
    this.readyState = _RequestController.RESPONSE;
    _chunkJQ2S7G56js.__privateGet.call(void 0, this, _handled, handled_get).resolve();
    this.source.respondWith(response);
  }
  /**
   * Error this request with the given reason.
   *
   * @example
   * controller.errorWith()
   * controller.errorWith(new Error('Oops!'))
   * controller.errorWith({ message: 'Oops!'})
   */
  errorWith(reason) {
    _outvariant.invariant.as(
      InterceptorError,
      this.readyState === _RequestController.PENDING,
      'Failed to error the "%s %s" request with "%s": the request has already been handled (%d)',
      this.request.method,
      this.request.url,
      reason == null ? void 0 : reason.toString(),
      this.readyState
    );
    this.readyState = _RequestController.ERROR;
    this.source.errorWith(reason);
    _chunkJQ2S7G56js.__privateGet.call(void 0, this, _handled, handled_get).resolve();
  }
};
var RequestController = _RequestController;
_handled = new WeakSet();
handled_get = function() {
  return this.handled;
};
RequestController.PENDING = 0;
RequestController.PASSTHROUGH = 1;
RequestController.RESPONSE = 2;
RequestController.ERROR = 3;

// src/utils/canParseUrl.ts
function canParseUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (_error) {
    return false;
  }
}

// src/utils/getValueBySymbol.ts
function getValueBySymbol(symbolName, source) {
  const ownSymbols = Object.getOwnPropertySymbols(source);
  const symbol = ownSymbols.find((symbol2) => {
    return symbol2.description === symbolName;
  });
  if (symbol) {
    return Reflect.get(source, symbol);
  }
  return;
}

// src/utils/fetchUtils.ts
var _FetchResponse = class extends Response {
  static isConfigurableStatusCode(status) {
    return status >= 200 && status <= 599;
  }
  static isRedirectResponse(status) {
    return _FetchResponse.STATUS_CODES_WITH_REDIRECT.includes(status);
  }
  /**
   * Returns a boolean indicating whether the given response status
   * code represents a response that can have a body.
   */
  static isResponseWithBody(status) {
    return !_FetchResponse.STATUS_CODES_WITHOUT_BODY.includes(status);
  }
  static setUrl(url, response) {
    if (!url || url === "about:" || !canParseUrl(url)) {
      return;
    }
    const state = getValueBySymbol("state", response);
    if (state) {
      state.urlList.push(new URL(url));
    } else {
      Object.defineProperty(response, "url", {
        value: url,
        enumerable: true,
        configurable: true,
        writable: false
      });
    }
  }
  /**
   * Parses the given raw HTTP headers into a Fetch API `Headers` instance.
   */
  static parseRawHeaders(rawHeaders) {
    const headers = new Headers();
    for (let line = 0; line < rawHeaders.length; line += 2) {
      headers.append(rawHeaders[line], rawHeaders[line + 1]);
    }
    return headers;
  }
  constructor(body, init = {}) {
    var _a;
    const status = (_a = init.status) != null ? _a : 200;
    const safeStatus = _FetchResponse.isConfigurableStatusCode(status) ? status : 200;
    const finalBody = _FetchResponse.isResponseWithBody(status) ? body : null;
    super(finalBody, {
      status: safeStatus,
      statusText: init.statusText,
      headers: init.headers
    });
    if (status !== safeStatus) {
      const state = getValueBySymbol("state", this);
      if (state) {
        state.status = status;
      } else {
        Object.defineProperty(this, "status", {
          value: status,
          enumerable: true,
          configurable: true,
          writable: false
        });
      }
    }
    _FetchResponse.setUrl(init.url, this);
  }
};
var FetchResponse = _FetchResponse;
/**
 * Response status codes for responses that cannot have body.
 * @see https://fetch.spec.whatwg.org/#statuses
 */
FetchResponse.STATUS_CODES_WITHOUT_BODY = [101, 103, 204, 205, 304];
FetchResponse.STATUS_CODES_WITH_REDIRECT = [301, 302, 303, 307, 308];

// src/getRawRequest.ts
var kRawRequest = Symbol("kRawRequest");
function getRawRequest(request) {
  return Reflect.get(request, kRawRequest);
}
function setRawRequest(request, rawRequest) {
  Reflect.set(request, kRawRequest, rawRequest);
}









exports.IS_PATCHED_MODULE = IS_PATCHED_MODULE; exports.InterceptorError = InterceptorError; exports.RequestController = RequestController; exports.canParseUrl = canParseUrl; exports.FetchResponse = FetchResponse; exports.getRawRequest = getRawRequest; exports.setRawRequest = setRawRequest;
//# sourceMappingURL=chunk-57RIRQUY.js.map