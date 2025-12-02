"use strict";Object.defineProperty(exports, "__esModule", {value: true});


var _chunk57RIRQUYjs = require('./chunk-57RIRQUY.js');


var _chunk2HUMWGRDjs = require('./chunk-2HUMWGRD.js');

// src/utils/isObject.ts
function isObject(value, loose = false) {
  return loose ? Object.prototype.toString.call(value).startsWith("[object ") : Object.prototype.toString.call(value) === "[object Object]";
}

// src/utils/isPropertyAccessible.ts
function isPropertyAccessible(obj, key) {
  try {
    obj[key];
    return true;
  } catch (e) {
    return false;
  }
}

// src/utils/responseUtils.ts
function createServerErrorResponse(body) {
  return new Response(
    JSON.stringify(
      body instanceof Error ? {
        name: body.name,
        message: body.message,
        stack: body.stack
      } : body
    ),
    {
      status: 500,
      statusText: "Unhandled Exception",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
function isResponseError(response) {
  return response != null && response instanceof Response && isPropertyAccessible(response, "type") && response.type === "error";
}
function isResponseLike(value) {
  return isObject(value, true) && isPropertyAccessible(value, "status") && isPropertyAccessible(value, "statusText") && isPropertyAccessible(value, "bodyUsed");
}

// src/utils/handleRequest.ts
var _deferredpromise = require('@open-draft/deferred-promise');
var _until = require('@open-draft/until');

// src/utils/isNodeLikeError.ts
function isNodeLikeError(error) {
  if (error == null) {
    return false;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return "code" in error && "errno" in error;
}

// src/utils/handleRequest.ts
async function handleRequest(options) {
  const handleResponse = async (response) => {
    if (response instanceof Error) {
      await options.controller.errorWith(response);
      return true;
    }
    if (isResponseError(response)) {
      await options.controller.respondWith(response);
      return true;
    }
    if (isResponseLike(response)) {
      await options.controller.respondWith(response);
      return true;
    }
    if (isObject(response)) {
      await options.controller.errorWith(response);
      return true;
    }
    return false;
  };
  const handleResponseError = async (error) => {
    if (error instanceof _chunk57RIRQUYjs.InterceptorError) {
      throw result.error;
    }
    if (isNodeLikeError(error)) {
      await options.controller.errorWith(error);
      return true;
    }
    if (error instanceof Response) {
      return await handleResponse(error);
    }
    return false;
  };
  const requestAbortPromise = new (0, _deferredpromise.DeferredPromise)();
  if (options.request.signal) {
    if (options.request.signal.aborted) {
      await options.controller.errorWith(options.request.signal.reason);
      return;
    }
    options.request.signal.addEventListener(
      "abort",
      () => {
        requestAbortPromise.reject(options.request.signal.reason);
      },
      { once: true }
    );
  }
  const result = await _until.until.call(void 0, async () => {
    const requestListenersPromise = _chunk2HUMWGRDjs.emitAsync.call(void 0, options.emitter, "request", {
      requestId: options.requestId,
      request: options.request,
      controller: options.controller
    });
    await Promise.race([
      // Short-circuit the request handling promise if the request gets aborted.
      requestAbortPromise,
      requestListenersPromise,
      options.controller.handled
    ]);
  });
  if (requestAbortPromise.state === "rejected") {
    await options.controller.errorWith(requestAbortPromise.rejectionReason);
    return;
  }
  if (result.error) {
    if (await handleResponseError(result.error)) {
      return;
    }
    if (options.emitter.listenerCount("unhandledException") > 0) {
      const unhandledExceptionController = new (0, _chunk57RIRQUYjs.RequestController)(
        options.request,
        {
          /**
           * @note Intentionally empty passthrough handle.
           * This controller is created within another controller and we only need
           * to know if `unhandledException` listeners handled the request.
           */
          passthrough() {
          },
          async respondWith(response) {
            await handleResponse(response);
          },
          async errorWith(reason) {
            await options.controller.errorWith(reason);
          }
        }
      );
      await _chunk2HUMWGRDjs.emitAsync.call(void 0, options.emitter, "unhandledException", {
        error: result.error,
        request: options.request,
        requestId: options.requestId,
        controller: unhandledExceptionController
      });
      if (unhandledExceptionController.readyState !== _chunk57RIRQUYjs.RequestController.PENDING) {
        return;
      }
    }
    await options.controller.respondWith(
      createServerErrorResponse(result.error)
    );
    return;
  }
  if (options.controller.readyState === _chunk57RIRQUYjs.RequestController.PENDING) {
    return await options.controller.passthrough();
  }
  return options.controller.handled;
}




exports.isResponseError = isResponseError; exports.handleRequest = handleRequest;
//# sourceMappingURL=chunk-FW45TRCB.js.map