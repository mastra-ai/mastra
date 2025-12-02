"use strict";Object.defineProperty(exports, "__esModule", {value: true});

var _chunkJ5MULIHTjs = require('./chunk-J5MULIHT.js');


var _chunkVYO5XDY2js = require('./chunk-VYO5XDY2.js');
require('./chunk-T3TW4P64.js');


var _chunk6B3ZQOO2js = require('./chunk-6B3ZQOO2.js');
require('./chunk-LK6DILFK.js');


var _chunkFRZQJNBOjs = require('./chunk-FRZQJNBO.js');
require('./chunk-PFGO5BSM.js');
require('./chunk-73NOP3T5.js');



var _chunk7Q53NNPVjs = require('./chunk-7Q53NNPV.js');




var _chunkDOWWQYXZjs = require('./chunk-DOWWQYXZ.js');
require('./chunk-SRMAQGPM.js');

// src/RemoteHttpInterceptor.ts
var RemoteHttpInterceptor = class extends _chunkJ5MULIHTjs.BatchInterceptor {
  constructor() {
    super({
      name: "remote-interceptor",
      interceptors: [
        new (0, _chunkVYO5XDY2js.ClientRequestInterceptor)(),
        new (0, _chunk6B3ZQOO2js.XMLHttpRequestInterceptor)(),
        new (0, _chunkFRZQJNBOjs.FetchInterceptor)()
      ]
    });
  }
  setup() {
    super.setup();
    let handleParentMessage;
    this.on("request", async ({ request, requestId, controller }) => {
      var _a;
      const serializedRequest = JSON.stringify({
        id: requestId,
        method: request.method,
        url: request.url,
        headers: Array.from(request.headers.entries()),
        credentials: request.credentials,
        body: ["GET", "HEAD"].includes(request.method) ? null : await request.text()
      });
      this.logger.info(
        "sent serialized request to the child:",
        serializedRequest
      );
      (_a = process.send) == null ? void 0 : _a.call(process, `request:${serializedRequest}`);
      const responsePromise = new Promise((resolve) => {
        handleParentMessage = (message) => {
          if (typeof message !== "string") {
            return resolve();
          }
          if (message.startsWith(`response:${requestId}`)) {
            const [, serializedResponse] = message.match(/^response:.+?:(.+)$/) || [];
            if (!serializedResponse) {
              return resolve();
            }
            const responseInit = JSON.parse(
              serializedResponse
            );
            const mockedResponse = new (0, _chunkDOWWQYXZjs.FetchResponse)(responseInit.body, {
              url: request.url,
              status: responseInit.status,
              statusText: responseInit.statusText,
              headers: responseInit.headers
            });
            controller.respondWith(mockedResponse);
            return resolve();
          }
        };
      });
      this.logger.info(
        'add "message" listener to the parent process',
        handleParentMessage
      );
      process.addListener("message", handleParentMessage);
      return responsePromise;
    });
    this.subscriptions.push(() => {
      process.removeListener("message", handleParentMessage);
    });
  }
};
function requestReviver(key, value) {
  switch (key) {
    case "url":
      return new URL(value);
    case "headers":
      return new Headers(value);
    default:
      return value;
  }
}
var _RemoteHttpResolver = class extends _chunkDOWWQYXZjs.Interceptor {
  constructor(options) {
    super(_RemoteHttpResolver.symbol);
    this.process = options.process;
  }
  setup() {
    const logger = this.logger.extend("setup");
    const handleChildMessage = async (message) => {
      logger.info("received message from child!", message);
      if (typeof message !== "string" || !message.startsWith("request:")) {
        logger.info("unknown message, ignoring...");
        return;
      }
      const [, serializedRequest] = message.match(/^request:(.+)$/) || [];
      if (!serializedRequest) {
        return;
      }
      const requestJson = JSON.parse(
        serializedRequest,
        requestReviver
      );
      logger.info("parsed intercepted request", requestJson);
      const request = new Request(requestJson.url, {
        method: requestJson.method,
        headers: new Headers(requestJson.headers),
        credentials: requestJson.credentials,
        body: requestJson.body
      });
      const controller = new (0, _chunkDOWWQYXZjs.RequestController)(request, {
        passthrough: () => {
        },
        respondWith: async (response) => {
          if (_chunk7Q53NNPVjs.isResponseError.call(void 0, response)) {
            this.logger.info("received a network error!", { response });
            throw new Error("Not implemented");
          }
          this.logger.info("received mocked response!", { response });
          const responseClone = response.clone();
          const responseText = await responseClone.text();
          const serializedResponse = JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()),
            body: responseText
          });
          this.process.send(
            `response:${requestJson.id}:${serializedResponse}`,
            (error) => {
              if (error) {
                return;
              }
              this.emitter.emit("response", {
                request,
                requestId: requestJson.id,
                response: responseClone,
                isMockedResponse: true
              });
            }
          );
          logger.info(
            "sent serialized mocked response to the parent:",
            serializedResponse
          );
        },
        errorWith: (reason) => {
          this.logger.info("request has errored!", { error: reason });
          throw new Error("Not implemented");
        }
      });
      await _chunk7Q53NNPVjs.handleRequest.call(void 0, {
        request,
        requestId: requestJson.id,
        controller,
        emitter: this.emitter
      });
    };
    this.subscriptions.push(() => {
      this.process.removeListener("message", handleChildMessage);
      logger.info('removed the "message" listener from the child process!');
    });
    logger.info('adding a "message" listener to the child process');
    this.process.addListener("message", handleChildMessage);
    this.process.once("error", () => this.dispose());
    this.process.once("exit", () => this.dispose());
  }
};
var RemoteHttpResolver = _RemoteHttpResolver;
RemoteHttpResolver.symbol = Symbol("remote-resolver");




exports.RemoteHttpInterceptor = RemoteHttpInterceptor; exports.RemoteHttpResolver = RemoteHttpResolver; exports.requestReviver = requestReviver;
//# sourceMappingURL=RemoteHttpInterceptor.js.map