/**
 * @vitest-environment custom-vitest-environment.ts
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { test, describe, expect } from "vitest";
import { anyApi } from "../server/api.js";

import { ApiFromModules, QueryBuilder } from "../server/index.js";
import { useQuery as useQueryReal } from "./client.js";

// Intentional noop, we're just testing types.
const useQuery = (() => {}) as unknown as typeof useQueryReal;

const query: QueryBuilder<any, "public"> = (() => {
  // Intentional noop. We're only testing the type
}) as any;

const module = {
  noArgs: query(() => "result"),
  args: query((_ctx, { _arg }: { _arg: string }) => "result"),
  /*
  // TODO some of these may be worth testing or proving
  // that they produce the same function reference types.
  untypedArgs: query((_ctx, _args) => "result"),
  unpackedUntypedArgs: query((_ctx, { _arg }) => "result"),
  configNoArgs: query({
    handler: () => "result",
  }),
  configEmptyArgs: query({
    args: {},
    handler: () => "result",
  }),
  configArgs: query({
    args: { _arg: v.string() },
    handler: (args) => "result",
  }),
  */
};
type API = ApiFromModules<{ module: typeof module }>;
const api = anyApi as unknown as API;

// Test the existing behavior of useQuery types.
// The change to consider is adding an options object.
// These rely on OptionalRestArgs / OptionalRestArgsOrSkip
// see https://github.com/get-convex/convex/pull/13978
describe("useQuery types", () => {
  test("Queries with arguments", () => {
    useQuery(api.module.args, { _arg: "asdf" });

    // @ts-expect-error extra args is an error
    useQuery(api.module.args, { _arg: "asdf", arg2: 123 });

    // @ts-expect-error wrong arg type is an error
    useQuery(api.module.args, { _arg: 1 });

    // @ts-expect-error eliding args object is an error
    useQuery(api.module.args);
  });

  test("Queries without arguments", () => {
    // empty args are allowed
    useQuery(api.module.noArgs, {});

    // eliding args object is allowed
    useQuery(api.module.noArgs);

    // @ts-expect-error adding args is not allowed
    useQuery(api.module.noArgs, { _arg: 1 });
  });
});
