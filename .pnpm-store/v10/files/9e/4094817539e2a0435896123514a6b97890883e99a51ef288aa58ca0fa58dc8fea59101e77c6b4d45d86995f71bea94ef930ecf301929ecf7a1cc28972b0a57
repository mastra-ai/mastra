"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunkSRMAQGPMjs = require('./chunk-SRMAQGPM.js');

// src/Interceptor.ts
var _logger = require('@open-draft/logger');
var _stricteventemitter = require('strict-event-emitter');
var INTERNAL_REQUEST_ID_HEADER_NAME = "x-interceptors-internal-request-id";
function getGlobalSymbol(symbol) {
  return (
    // @ts-ignore https://github.com/Microsoft/TypeScript/issues/24587
    globalThis[symbol] || void 0
  );
}
function setGlobalSymbol(symbol, value) {
  globalThis[symbol] = value;
}
function deleteGlobalSymbol(symbol) {
  delete globalThis[symbol];
}
var InterceptorReadyState = /* @__PURE__ */ ((InterceptorReadyState2) => {
  InterceptorReadyState2["INACTIVE"] = "INACTIVE";
  InterceptorReadyState2["APPLYING"] = "APPLYING";
  InterceptorReadyState2["APPLIED"] = "APPLIED";
  InterceptorReadyState2["DISPOSING"] = "DISPOSING";
  InterceptorReadyState2["DISPOSED"] = "DISPOSED";
  return InterceptorReadyState2;
})(InterceptorReadyState || {});
var Interceptor = class {
  constructor(symbol) {
    this.symbol = symbol;
    this.readyState = "INACTIVE" /* INACTIVE */;
    this.emitter = new (0, _stricteventemitter.Emitter)();
    this.subscriptions = [];
    this.logger = new (0, _logger.Logger)(symbol.description);
    this.emitter.setMaxListeners(0);
    this.logger.info("constructing the interceptor...");
  }
  /**
   * Determine if this interceptor can be applied
   * in the current environment.
   */
  checkEnvironment() {
    return true;
  }
  /**
   * Apply this interceptor to the current process.
   * Returns an already running interceptor instance if it's present.
   */
  apply() {
    const logger = this.logger.extend("apply");
    logger.info("applying the interceptor...");
    if (this.readyState === "APPLIED" /* APPLIED */) {
      logger.info("intercepted already applied!");
      return;
    }
    const shouldApply = this.checkEnvironment();
    if (!shouldApply) {
      logger.info("the interceptor cannot be applied in this environment!");
      return;
    }
    this.readyState = "APPLYING" /* APPLYING */;
    const runningInstance = this.getInstance();
    if (runningInstance) {
      logger.info("found a running instance, reusing...");
      this.on = (event, listener) => {
        logger.info('proxying the "%s" listener', event);
        runningInstance.emitter.addListener(event, listener);
        this.subscriptions.push(() => {
          runningInstance.emitter.removeListener(event, listener);
          logger.info('removed proxied "%s" listener!', event);
        });
        return this;
      };
      this.readyState = "APPLIED" /* APPLIED */;
      return;
    }
    logger.info("no running instance found, setting up a new instance...");
    this.setup();
    this.setInstance();
    this.readyState = "APPLIED" /* APPLIED */;
  }
  /**
   * Setup the module augments and stubs necessary for this interceptor.
   * This method is not run if there's a running interceptor instance
   * to prevent instantiating an interceptor multiple times.
   */
  setup() {
  }
  /**
   * Listen to the interceptor's public events.
   */
  on(event, listener) {
    const logger = this.logger.extend("on");
    if (this.readyState === "DISPOSING" /* DISPOSING */ || this.readyState === "DISPOSED" /* DISPOSED */) {
      logger.info("cannot listen to events, already disposed!");
      return this;
    }
    logger.info('adding "%s" event listener:', event, listener);
    this.emitter.on(event, listener);
    return this;
  }
  once(event, listener) {
    this.emitter.once(event, listener);
    return this;
  }
  off(event, listener) {
    this.emitter.off(event, listener);
    return this;
  }
  removeAllListeners(event) {
    this.emitter.removeAllListeners(event);
    return this;
  }
  /**
   * Disposes of any side-effects this interceptor has introduced.
   */
  dispose() {
    const logger = this.logger.extend("dispose");
    if (this.readyState === "DISPOSED" /* DISPOSED */) {
      logger.info("cannot dispose, already disposed!");
      return;
    }
    logger.info("disposing the interceptor...");
    this.readyState = "DISPOSING" /* DISPOSING */;
    if (!this.getInstance()) {
      logger.info("no interceptors running, skipping dispose...");
      return;
    }
    this.clearInstance();
    logger.info("global symbol deleted:", getGlobalSymbol(this.symbol));
    if (this.subscriptions.length > 0) {
      logger.info("disposing of %d subscriptions...", this.subscriptions.length);
      for (const dispose of this.subscriptions) {
        dispose();
      }
      this.subscriptions = [];
      logger.info("disposed of all subscriptions!", this.subscriptions.length);
    }
    this.emitter.removeAllListeners();
    logger.info("destroyed the listener!");
    this.readyState = "DISPOSED" /* DISPOSED */;
  }
  getInstance() {
    var _a;
    const instance = getGlobalSymbol(this.symbol);
    this.logger.info("retrieved global instance:", (_a = instance == null ? void 0 : instance.constructor) == null ? void 0 : _a.name);
    return instance;
  }
  setInstance() {
    setGlobalSymbol(this.symbol, this);
    this.logger.info("set global instance!", this.symbol.description);
  }
  clearInstance() {
    deleteGlobalSymbol(this.symbol);
    this.logger.info("cleared global instance!", this.symbol.description);
  }
};

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
    _chunkSRMAQGPMjs.__privateAdd.call(void 0, this, _handled);
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
    _chunkSRMAQGPMjs.__privateGet.call(void 0, this, _handled, handled_get).resolve();
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
    _chunkSRMAQGPMjs.__privateGet.call(void 0, this, _handled, handled_get).resolve();
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
    _chunkSRMAQGPMjs.__privateGet.call(void 0, this, _handled, handled_get).resolve();
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

// src/createRequestId.ts
function createRequestId() {
  return Math.random().toString(16).slice(2);
}

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












exports.INTERNAL_REQUEST_ID_HEADER_NAME = INTERNAL_REQUEST_ID_HEADER_NAME; exports.getGlobalSymbol = getGlobalSymbol; exports.deleteGlobalSymbol = deleteGlobalSymbol; exports.InterceptorReadyState = InterceptorReadyState; exports.Interceptor = Interceptor; exports.InterceptorError = InterceptorError; exports.RequestController = RequestController; exports.createRequestId = createRequestId; exports.canParseUrl = canParseUrl; exports.FetchResponse = FetchResponse;
//# sourceMappingURL=chunk-DOWWQYXZ.js.map