import { httpActionGeneric } from "./impl/registration_impl.js";
import { HttpActionBuilder } from "./registration.js";
import { httpRouter } from "./router.js";
import { expect, test } from "vitest";

const httpAction = httpActionGeneric as HttpActionBuilder;

const action1 = httpAction(() => Promise.resolve(new Response()));
const action2 = httpAction(() => Promise.resolve(new Response()));
const action3 = httpAction(() => Promise.resolve(new Response()));
const action4 = httpAction(() => Promise.resolve(new Response()));

test("HttpRouter", () => {
  const http = httpRouter();
  http.route({
    path: "/path1",
    method: "GET",
    handler: action1,
  });
  http.route({
    path: "/path1",
    method: "POST",
    handler: action2,
  });
  http.route({
    path: "/path2",
    method: "GET",
    handler: action3,
  });
  http.route({
    pathPrefix: "/path3/",
    method: "GET",
    handler: action4,
  });

  expect(() => {
    http.route({
      path: "/path1",
      method: "GET",
      handler: action1,
    });
  }).toThrow();

  expect(() => {
    http.route({
      path: "/newpath",
      // @ts-expect-error  // not a valid method
      method: "MADE_UP_METHOD",
      handler: action1,
    });
  }).toThrow();

  expect(() => {
    http.route({
      path: "no-leading-slash",
      method: "GET",
      handler: action1,
    });
  }).toThrow();

  expect(() => {
    http.route({ pathPrefix: "/.files/", method: "GET", handler: action1 });
  }).toThrow("pathPrefix '/.files/' is reserved");
  expect(() => {
    http.route({ path: "/.files", method: "GET", handler: action1 });
  }).toThrow("is reserved");
  expect(() => {
    http.route({ path: "/.files/", method: "GET", handler: action1 });
  }).toThrow("is reserved");
  expect(() => {
    http.route({ path: "/.files/foo/bar", method: "GET", handler: action1 });
  }).toThrow("is reserved");

  expect(http.getRoutes()).toEqual([
    ["/path1", "GET", action1],
    ["/path1", "POST", action2],
    ["/path2", "GET", action3],
    ["/path3/*", "GET", action4],
  ]);

  expect(http.lookup("/path2", "GET")).toEqual([action3, "GET", "/path2"]);
  expect(http.lookup("/path2/", "GET")).toEqual(null);
  expect(http.lookup("/path3/foo", "GET")).toEqual([
    action4,
    "GET",
    "/path3/*",
  ]);

  // HEAD requests return GET handlers
  expect(http.lookup("/path3/foo", "HEAD")).toEqual([
    action4,
    "GET",
    "/path3/*",
  ]);
});

test("HttpRouter pathPrefix", () => {
  const http = httpRouter();

  http.route({ pathPrefix: "/path1/", method: "GET", handler: action1 });

  // prefix same as a prefix
  expect(() => {
    http.route({ pathPrefix: "/path1/", method: "GET", handler: action1 });
  }).toThrow();

  // more specific pathPrefix
  http.route({
    pathPrefix: "/path1/foo/",
    method: "GET",
    handler: action1,
  });

  // less specific pathPrefix
  http.route({
    pathPrefix: "/",
    method: "GET",
    handler: action1,
  });

  // Longest matching prefix is used.
  expect(http.lookup("/path1/foo/bar", "GET")).toEqual([
    action1,
    "GET",
    "/path1/foo/*",
  ]);
  expect(http.lookup("/path1/foo", "GET")).toEqual([
    action1,
    "GET",
    "/path1/*",
  ]);
  expect(http.lookup("/path1", "GET")).toEqual([action1, "GET", "/*"]);

  // Exact path is more specific than prefix
  http.route({ path: "/path1/foo", method: "GET", handler: action1 });
  expect(http.lookup("/path1/foo", "GET")).toEqual([
    action1,
    "GET",
    "/path1/foo",
  ]);
  // Duplicate exact match
  expect(() =>
    http.route({ path: "/path1/foo", method: "GET", handler: action1 }),
  ).toThrow();

  // Not shadowed: last path segment is different
  http.route({ pathPrefix: "/path11/", method: "GET", handler: action1 });
});
