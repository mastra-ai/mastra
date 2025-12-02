// src/test/mock-fetch.ts
import { vi } from "vitest";
function mockFetchTextStream({
  url,
  chunks
}) {
  vi.spyOn(global, "fetch").mockImplementation(async () => {
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
  vi.spyOn(global, "fetch").mockImplementation(async (url2, init) => {
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
  vi.spyOn(global, "fetch").mockImplementation(async () => {
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
export {
  mockFetchDataStream,
  mockFetchDataStreamWithGenerator,
  mockFetchError,
  mockFetchTextStream
};
//# sourceMappingURL=index.mjs.map