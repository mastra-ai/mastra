import { test, expect, afterEach, vi } from "vitest";
import { ConvexHttpClient, setFetch } from "./http_client.js";
import { makeFunctionReference } from "../server/index.js";

const apiMutationFunc = makeFunctionReference<
  "mutation",
  { value: string },
  string
>("test:mutation");

afterEach(() => {
  setFetch(globalThis.fetch);
});

test("mutation queue processes mutations sequentially", async () => {
  const client = new ConvexHttpClient("http://test");

  // Mock fetch to simulate network delays
  const fetchMock = vi.fn();
  let resolveFirst: (value: any) => void;
  let resolveSecond: (value: any) => void;

  fetchMock.mockImplementation((url, options) => {
    const body = JSON.parse(options.body);
    if (body.path === "test:mutation" && body.args[0].value === "first") {
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    }
    if (body.path === "test:mutation" && body.args[0].value === "second") {
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    }
    return Promise.reject(new Error("Unexpected mutation"));
  });

  setFetch(fetchMock);

  // Start two queued mutations
  const firstPromise = client.mutation(apiMutationFunc, { value: "first" });
  const secondPromise = client.mutation(apiMutationFunc, { value: "second" });

  // Verify first mutation started but second hasn't
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).args[0].value).toBe(
    "first",
  );

  // Resolve first mutation
  resolveFirst!({
    ok: true,
    json: () => Promise.resolve({ status: "success", value: "first result" }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Verify second mutation started
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).args[0].value).toBe(
    "second",
  );

  // Resolve second mutation
  resolveSecond!({
    ok: true,
    json: () => Promise.resolve({ status: "success", value: "second result" }),
  });

  // Verify both promises resolve
  await expect(firstPromise).resolves.toBe("first result");
  await expect(secondPromise).resolves.toBe("second result");
});

test("unqueued mutations skip the queue", async () => {
  const client = new ConvexHttpClient("http://test");

  const fetchMock = vi.fn();
  let resolveQueued: (value: any) => void;

  fetchMock.mockImplementation((url, options) => {
    const body = JSON.parse(options.body);
    if (body.path === "test:mutation" && body.args[0].value === "queued") {
      return new Promise((resolve) => {
        resolveQueued = resolve;
      });
    }
    if (body.path === "test:mutation" && body.args[0].value === "unqueued") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ status: "success", value: "unqueued result" }),
      });
    }
    return Promise.reject(new Error("Unexpected mutation"));
  });

  setFetch(fetchMock);

  // Start a queued mutation
  const queuedPromise = client.mutation(apiMutationFunc, { value: "queued" });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Start an unqueued mutation while first is still running
  const unqueuedPromise = client.mutation(
    apiMutationFunc,
    { value: "unqueued" },
    { skipQueue: true },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Verify both mutations started immediately
  expect(fetchMock).toHaveBeenCalledTimes(2);

  // Resolve the queued mutation
  resolveQueued!({
    ok: true,
    json: () => Promise.resolve({ status: "success", value: "queued result" }),
  });

  // Verify both promises resolve
  await expect(queuedPromise).resolves.toBe("queued result");
  await expect(unqueuedPromise).resolves.toBe("unqueued result");
});

test("failed mutations don't block the queue", async () => {
  const client = new ConvexHttpClient("http://test");

  const fetchMock = vi.fn();
  let resolveSecond: (value: any) => void;

  fetchMock.mockImplementation((url, options) => {
    const body = JSON.parse(options.body);
    if (body.path === "test:mutation" && body.args[0].value === "first") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "error",
            errorMessage: "First mutation failed",
          }),
      });
    }
    if (body.path === "test:mutation" && body.args[0].value === "second") {
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    }
    return Promise.reject(new Error("Unexpected mutation"));
  });

  setFetch(fetchMock);

  // Start two queued mutations
  const firstPromise = client.mutation(apiMutationFunc, { value: "first" });
  const secondPromise = client.mutation(apiMutationFunc, { value: "second" });

  await expect(firstPromise).rejects.toThrow("First mutation failed");

  // First mutation failed, second should start
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).args[0].value).toBe(
    "second",
  );

  // Resolve second mutation
  resolveSecond!({
    ok: true,
    json: () => Promise.resolve({ status: "success", value: "second result" }),
  });

  // Verify first promise rejects and second resolves
  await expect(firstPromise).rejects.toThrow("First mutation failed");
  await expect(secondPromise).resolves.toBe("second result");
});
