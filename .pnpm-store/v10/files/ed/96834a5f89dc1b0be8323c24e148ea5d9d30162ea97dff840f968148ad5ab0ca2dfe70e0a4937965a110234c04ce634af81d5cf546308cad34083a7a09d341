"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/test/index.ts
var test_exports = {};
__export(test_exports, {
  mockFetchDataStream: () => mockFetchDataStream,
  mockFetchDataStreamWithGenerator: () => mockFetchDataStreamWithGenerator,
  mockFetchError: () => mockFetchError,
  mockFetchTextStream: () => mockFetchTextStream
});
module.exports = __toCommonJS(test_exports);

// src/test/mock-fetch.ts
var import_vitest = require("vitest");
function mockFetchTextStream({
  url,
  chunks
}) {
  import_vitest.vi.spyOn(global, "fetch").mockImplementation(async () => {
    function* generateChunks() {
      for (const chunk of chunks) {
        yield new TextEncoder().encode(chunk);
      }
    }
    const chunkGenerator = generateChunks();
    return {
      url,
      ok: true,
      status: 200,
      bodyUsed: false,
      headers: /* @__PURE__ */ new Map(),
      body: {
        getReader() {
          return {
            read() {
              return Promise.resolve(chunkGenerator.next());
            },
            releaseLock() {
            },
            cancel() {
            }
          };
        }
      }
    };
  });
}
function mockFetchDataStream({
  url,
  chunks,
  maxCalls
}) {
  async function* generateChunks() {
    const encoder = new TextEncoder();
    for (const chunk of chunks) {
      yield encoder.encode(chunk);
    }
  }
  return mockFetchDataStreamWithGenerator({
    url,
    chunkGenerator: generateChunks(),
    maxCalls
  });
}
function mockFetchDataStreamWithGenerator({
  url,
  chunkGenerator,
  maxCalls
}) {
  let requestBodyResolve;
  const requestBodyPromise = new Promise((resolve) => {
    requestBodyResolve = resolve;
  });
  let callCount = 0;
  import_vitest.vi.spyOn(global, "fetch").mockImplementation(async (url2, init) => {
    if (maxCalls !== void 0 && ++callCount >= maxCalls) {
      throw new Error("Too many calls");
    }
    requestBodyResolve == null ? void 0 : requestBodyResolve(init.body);
    return {
      url: url2,
      ok: true,
      status: 200,
      bodyUsed: false,
      body: new ReadableStream({
        async start(controller) {
          for await (const chunk of chunkGenerator) {
            controller.enqueue(chunk);
          }
          controller.close();
        }
      })
    };
  });
  return {
    requestBody: requestBodyPromise
  };
}
function mockFetchError({
  statusCode,
  errorMessage
}) {
  import_vitest.vi.spyOn(global, "fetch").mockImplementation(async () => {
    return {
      url: "https://example.com/api/chat",
      ok: false,
      status: statusCode,
      bodyUsed: false,
      body: {
        getReader() {
          return {
            read() {
              return Promise.resolve(errorMessage);
            },
            releaseLock() {
            },
            cancel() {
            }
          };
        }
      },
      text: () => Promise.resolve(errorMessage)
    };
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  mockFetchDataStream,
  mockFetchDataStreamWithGenerator,
  mockFetchError,
  mockFetchTextStream
});
//# sourceMappingURL=index.js.map