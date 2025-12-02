import { test } from "vitest";
import { makeFunctionReference } from "../server/index.js";
import { EmptyObject } from "../server/registration.js";
import { ConvexReactClient } from "../react/client.js";
import { convexQueryOptions } from "./query_options.js";

const apiQueryFuncWithArgs = makeFunctionReference<
  "query",
  { name: string },
  string
>("jeans style");
const apiQueryFuncWithoutArgs = makeFunctionReference<
  "query",
  EmptyObject,
  string
>("jeans style");

test("convexQueryOptions", async () => {
  const _opts = convexQueryOptions({
    query: apiQueryFuncWithArgs,
    args: { name: "hey" },
  });

  // @ts-expect-error This should be an error
  const _opts2 = convexQueryOptions({
    query: apiQueryFuncWithArgs,
  });

  const _opts3 = convexQueryOptions({
    query: apiQueryFuncWithoutArgs,
    args: {},
  });

  // @ts-expect-error For now args are always required, even at the top level.
  const _opts4 = convexQueryOptions({
    query: apiQueryFuncWithoutArgs,
  });

  const _opts5 = convexQueryOptions({
    query: apiQueryFuncWithoutArgs,
    // @ts-expect-error This should be an error
    args: { name: "hey" },
  });
});

test("prewarmQuery types", async () => {
  const client = {
    prewarmQuery: () => {},
  } as unknown as ConvexReactClient;

  client.prewarmQuery({ query: apiQueryFuncWithArgs, args: { name: "hi" } });
});
