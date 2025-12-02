"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunkLK6DILFKjs = require('./chunk-LK6DILFK.js');





var _chunk57RIRQUYjs = require('./chunk-57RIRQUY.js');







var _chunkJQ2S7G56js = require('./chunk-JQ2S7G56.js');

// src/BatchInterceptor.ts
var BatchInterceptor = class extends _chunkJQ2S7G56js.Interceptor {
  constructor(options) {
    BatchInterceptor.symbol = Symbol(options.name);
    super(BatchInterceptor.symbol);
    this.interceptors = options.interceptors;
  }
  setup() {
    const logger = this.logger.extend("setup");
    logger.info("applying all %d interceptors...", this.interceptors.length);
    for (const interceptor of this.interceptors) {
      logger.info('applying "%s" interceptor...', interceptor.constructor.name);
      interceptor.apply();
      logger.info("adding interceptor dispose subscription");
      this.subscriptions.push(() => interceptor.dispose());
    }
  }
  on(event, listener) {
    for (const interceptor of this.interceptors) {
      interceptor.on(event, listener);
    }
    return this;
  }
  once(event, listener) {
    for (const interceptor of this.interceptors) {
      interceptor.once(event, listener);
    }
    return this;
  }
  off(event, listener) {
    for (const interceptor of this.interceptors) {
      interceptor.off(event, listener);
    }
    return this;
  }
  removeAllListeners(event) {
    for (const interceptors of this.interceptors) {
      interceptors.removeAllListeners(event);
    }
    return this;
  }
};

// src/utils/getCleanUrl.ts
function getCleanUrl(url, isAbsolute = true) {
  return [isAbsolute && url.origin, url.pathname].filter(Boolean).join("");
}















exports.BatchInterceptor = BatchInterceptor; exports.FetchResponse = _chunk57RIRQUYjs.FetchResponse; exports.INTERNAL_REQUEST_ID_HEADER_NAME = _chunkJQ2S7G56js.INTERNAL_REQUEST_ID_HEADER_NAME; exports.IS_PATCHED_MODULE = _chunk57RIRQUYjs.IS_PATCHED_MODULE; exports.Interceptor = _chunkJQ2S7G56js.Interceptor; exports.InterceptorReadyState = _chunkJQ2S7G56js.InterceptorReadyState; exports.RequestController = _chunk57RIRQUYjs.RequestController; exports.createRequestId = _chunkJQ2S7G56js.createRequestId; exports.decodeBuffer = _chunkLK6DILFKjs.decodeBuffer; exports.deleteGlobalSymbol = _chunkJQ2S7G56js.deleteGlobalSymbol; exports.encodeBuffer = _chunkLK6DILFKjs.encodeBuffer; exports.getCleanUrl = getCleanUrl; exports.getGlobalSymbol = _chunkJQ2S7G56js.getGlobalSymbol; exports.getRawRequest = _chunk57RIRQUYjs.getRawRequest;
//# sourceMappingURL=index.js.map